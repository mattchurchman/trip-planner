// Pure: who chose what, who each price is for, the merged route, and the
// budget that falls out of all three (SPEC §5.3, §11). No DOM, no Firebase.
//
// Every traveler chooses their own idea and their own option, separately, so
// nothing here ever reads "the" chosen option — it reads each traveler's and
// merges the results.

import { split } from "./money.js";
import { latestEntry } from "./totals.js";
import { nightsBetween } from "./dates.js";
import { stayNights } from "./coverage.js";
import { stopsFor, ideaEndpoints, ideaWindow } from "./route.js";

// Sorts after every real "YYYY-MM-DD", so undated stops land at the end.
const UNDATED = "￿";

/** "YYYY-MM-DD" plus `n` days, in UTC. */
function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/**
 * One traveler's choice: `{ ideaId, optionId }`, either of which may be null.
 * A traveler with no `choices` entry inherits the retired `chosenOptionId`
 * and that option's idea, so trips from before 4.1 look unchanged (§5.3).
 * When someone has chosen an option but no idea, the option's own idea stands
 * in — it's the only idea their home flights could sensibly come from.
 */
export function choiceFor(trip, travelerId, options) {
  const list = options || [];
  const ideaOf = (optionId) => {
    const option = optionId ? list.find((o) => o.id === optionId) : null;
    return option ? option.ideaId || null : null;
  };
  const entry = trip && trip.choices ? trip.choices[travelerId] : null;
  if (entry) {
    const optionId = entry.optionId || null;
    return { ideaId: entry.ideaId || ideaOf(optionId), optionId };
  }
  const legacyOptionId = (trip && trip.chosenOptionId) || null;
  return { ideaId: ideaOf(legacyOptionId), optionId: legacyOptionId };
}

/** True once anybody has chosen an option — what "route chosen" means now (§11). */
export function hasAnyOption(trip) {
  const choices = (trip && trip.choices) || {};
  for (const key of Object.keys(choices)) {
    if (choices[key] && choices[key].optionId) return true;
  }
  return Boolean(trip && trip.chosenOptionId);
}

/** Every traveler's resolved choice, keyed by traveler id. */
export function resolveChoices(trip, travelers, options) {
  const map = {};
  for (const traveler of travelers || []) map[traveler.id] = choiceFor(trip, traveler.id, options);
  return map;
}

/** Every home flight anyone has saved under one idea. */
function ideaHomeFlights(flights, ideaId) {
  if (!ideaId) return [];
  return (flights || []).filter((f) => f.role === "home" && f.ideaId === ideaId);
}

/** The ideas a traveler has ticked "I live here" on (§5.3). */
function handPickedLocalIdeas(trip, travelerId) {
  const entry = trip && trip.choices ? trip.choices[travelerId] : null;
  const list = entry && entry.localIdeaIds;
  return Array.isArray(list) ? list : [];
}

/**
 * Does this traveler live in the idea's city, so they need no flight from home
 * (§7.6)? `auto` is true when their home airport is in the city the idea flies
 * into — read from anyone's home flights on it, and not something they can
 * switch off — and `byHand` when they ticked **I live here**. `city` and `code`
 * name the city they're in, for the screen and for their stops.
 */
export function localIdeaInfo({ traveler, trip, ideaId, flights, airports }) {
  if (!traveler || !airports) return { local: false, auto: false, byHand: false, city: "", code: "" };
  const { inCode } = ideaEndpoints(ideaHomeFlights(flights, ideaId));
  const home = String(traveler.homeAirport || "").trim().toUpperCase();
  const auto = Boolean(ideaId && inCode && home && airports.cityKey(inCode) === airports.cityKey(home));
  const byHand = Boolean(ideaId) && handPickedLocalIdeas(trip, traveler.id).includes(ideaId);
  // The idea's own arrival city when we know it — for someone local, that is
  // their city — otherwise whatever their home fields say.
  const code = inCode || home;
  const city = (code && String(airports.cityName(code) || "")) || traveler.homeCity || "";
  return { local: auto || byHand, auto, byHand, city, code };
}

/** True when a traveler needs no flight from home for this idea (§7.6). */
export function isLocalToIdea(args) {
  return localIdeaInfo(args).local;
}

/**
 * How a local traveler's route starts and ends (§7.6), standing in for the
 * flights they don't need: their city, from the earliest the others on this
 * idea land to the latest they leave, or else the trip's own dates. Null for
 * anyone who isn't local, who reads their own flights as before.
 */
export function localRoute({ traveler, trip, ideaId, flights, airports }) {
  const info = localIdeaInfo({ traveler, trip, ideaId, flights, airports });
  if (!info.local) return null;
  const others = ideaHomeFlights(flights, ideaId).filter((f) => f.travelerId !== traveler.id);
  const { from, to } = ideaWindow(others);
  return {
    info,
    arrival: { code: info.code, date: from || (trip && trip.startDate) || null },
    departure: { code: null, date: to || (trip && trip.endDate) || null },
  };
}

/** Each night a traveler sleeps somewhere, as "YYYY-MM-DD" check-in dates. */
function nightDatesOf(stops) {
  const dates = [];
  for (const stop of stops || []) {
    const nights = nightsBetween(stop && stop.from, stop && stop.to);
    if (nights === null) continue;
    for (let i = 0; i < nights; i++) dates.push(addDays(stop.from, i));
  }
  return dates;
}

function stopsOf(ctx, travelerId) {
  const entry = (ctx.perTravelerStops || []).find((e) => e.travelerId === travelerId);
  return (entry && entry.stops) || [];
}

/**
 * Who a flight, stay or cost is for (§11). `kind` is "home", "hop", "stay" or
 * "cost"; `ctx` comes from `budgetContext`. A `forTravelerIds` list on the item
 * wins over everything, narrowed to travelers who still exist. The result is
 * always in `travelers` array order, which is the order equal splits use (§11).
 */
export function forTravelers(item, kind, ctx) {
  const ids = (ctx.travelers || []).map((t) => t.id);
  const override = item && item.forTravelerIds;
  if (Array.isArray(override)) return ids.filter((id) => override.includes(id));

  if (kind === "home") {
    const owner = item && item.travelerId;
    return owner && ids.includes(owner) ? [owner] : [];
  }
  if (kind === "hop") {
    const optionId = item && item.optionId;
    if (!optionId) return [];
    return ids.filter((id) => ctx.choices && ctx.choices[id] && ctx.choices[id].optionId === optionId);
  }
  if (kind === "stay") {
    const nights = new Set(stayNights(item));
    const present = ids.filter((id) => nightDatesOf(stopsOf(ctx, id)).some((date) => nights.has(date)));
    // Nobody placed there — no dates, or no stops worked out yet — is everyone's,
    // so a stay's price is never left with nobody to pay it.
    return present.length > 0 ? present : ids;
  }
  return ids;
}

/**
 * Each traveler's own stops as `[{ travelerId, stops }]`: their chosen idea's
 * picked home flights plus their chosen option's hops, through `stopsFor`.
 * A traveler who hasn't chosen an option contributes nothing (§11) — unless
 * they live in the idea's city, where the group's dates give them stops with
 * no flights at all (§7.6).
 */
export function stopsByTraveler({ travelers, trip, options, flights, airports }) {
  const list = travelers || [];
  const choices = resolveChoices(trip, list, options);
  return list.map((traveler) => {
    const choice = choices[traveler.id];
    const option = choice.optionId ? (options || []).find((o) => o.id === choice.optionId) : null;
    if (!airports) return { travelerId: traveler.id, stops: [] };
    const hopFlights = option ? (flights || []).filter((f) => f.role === "hop" && f.optionId === option.id) : [];

    const local = localRoute({ traveler, trip, ideaId: choice.ideaId, flights, airports });
    if (local) {
      const stops = stopsFor({ homeFlights: [], hopFlights, airports, arrival: local.arrival, departure: local.departure });
      return { travelerId: traveler.id, stops };
    }

    if (!option) return { travelerId: traveler.id, stops: [] };
    const homeFlights = ideaHomeFlights(flights, choice.ideaId).filter(
      (f) => f.picked !== false && f.travelerId === traveler.id
    );
    return { travelerId: traveler.id, stops: stopsFor({ homeFlights, hopFlights, airports }) };
  });
}

/** Does a visit starting on `from` carry on from a stop that ends on `end`?
 * A null `end` is an open-ended stop (no flight home yet), which swallows
 * everything after it. Ends are inclusive, so arriving the day someone else
 * leaves is the same stop. */
function carriesOn(end, from) {
  return end === null || from <= end;
}

/** The later of two stop ends, where null (open-ended) beats any date. */
function laterEnd(a, b) {
  if (a === null || b === null) return null;
  return a > b ? a : b;
}

/**
 * One city's visits split into separate stops (§11): visits merge only while
 * their dates overlap or touch — two travelers in the city at once, or one
 * arriving as another leaves — so a city you come back to later in the trip
 * becomes a stop of its own. Undated visits join the city's first stop, or
 * make one of their own when every visit is undated.
 */
function visitGroups(visits) {
  const dated = visits
    .filter((v) => v.stop.from)
    .sort((a, b) => (a.stop.from === b.stop.from ? a.order - b.order : a.stop.from < b.stop.from ? -1 : 1));
  const groups = [];
  const ends = [];
  for (const visit of dated) {
    const last = groups.length - 1;
    if (last >= 0 && carriesOn(ends[last], visit.stop.from)) {
      groups[last].push(visit);
      ends[last] = laterEnd(ends[last], visit.stop.to || null);
    } else {
      groups.push([visit]);
      ends.push(visit.stop.to || null);
    }
  }
  const undated = visits.filter((v) => !v.stop.from);
  if (undated.length > 0) {
    if (groups.length > 0) groups[0].push(...undated);
    else groups.push(undated);
  }
  return groups;
}

/** One merged stop from one city's group of visits, in the order the visits
 * were collected (travelers in `travelers` order, each traveler's stops in
 * route order) so `travelerIds` reads the same way everywhere. */
function mergedStop(cityKey, stopKey, group) {
  const merged = { stopKey, cityKey, city: "", code: "", from: null, to: null, travelerIds: [], order: Infinity, nightsByDate: new Map() };
  for (const visit of [...group].sort((a, b) => a.order - b.order)) {
    const { stop, travelerId } = visit;
    if (!merged.city && stop.city) merged.city = stop.city;
    if (!merged.code && stop.code) merged.code = stop.code;
    if (stop.from && (!merged.from || stop.from < merged.from)) merged.from = stop.from;
    if (stop.to && (!merged.to || stop.to > merged.to)) merged.to = stop.to;
    if (travelerId && !merged.travelerIds.includes(travelerId)) merged.travelerIds.push(travelerId);
    if (visit.order < merged.order) merged.order = visit.order;
    for (const date of nightDatesOf([stop])) {
      if (!merged.nightsByDate.has(date)) merged.nightsByDate.set(date, []);
      const who = merged.nightsByDate.get(date);
      if (travelerId && !who.includes(travelerId)) who.push(travelerId);
    }
  }
  return merged;
}

/**
 * Everyone's stops merged into one route (§11): one entry per visit to a city
 * — visits merge only when their dates overlap or touch (`visitGroups`) — in
 * order of first arrival (undated last), with `from` the earliest and `to` the
 * latest, `travelerIds` for the stop as a whole and `nights: [{ date,
 * travelerIds }]` for who sleeps there each night.
 *
 * Each stop also carries a `stopKey`: the `cityKey` for a city's first visit,
 * then `cityKey#2`, `cityKey#3` for later ones, so a stay saved against the
 * first visit keeps matching while a return visit is its own group.
 *
 * Note `nights` is a list here, where a single traveler's stop from `stopsFor`
 * carries a night *count* — a merged stop has a different night per person.
 * Per-traveler warnings stay on the Routes rail and aren't merged.
 */
export function mergeStops(perTravelerStops) {
  const byCity = new Map();
  let seen = 0;

  for (const entry of perTravelerStops || []) {
    const travelerId = (entry && entry.travelerId) || null;
    for (const stop of (entry && entry.stops) || []) {
      const key = stop.cityKey || stop.code || "";
      if (!key) continue;
      if (!byCity.has(key)) byCity.set(key, []);
      byCity.get(key).push({ stop, travelerId, order: seen++ });
    }
  }

  const merged = [];
  for (const [cityKey, visits] of byCity) {
    visitGroups(visits).forEach((group, index) => {
      merged.push(mergedStop(cityKey, index === 0 ? cityKey : `${cityKey}#${index + 1}`, group));
    });
  }

  return merged
    .sort((a, b) => {
      const left = a.from || UNDATED;
      const right = b.from || UNDATED;
      if (left !== right) return left < right ? -1 : 1;
      return a.order - b.order;
    })
    .map(({ order, nightsByDate, ...stop }) => ({
      ...stop,
      nights: [...nightsByDate.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([date, travelerIds]) => ({ date, travelerIds })),
    }));
}

/** The one route Map, Stays and Days read: everyone's stops, merged (§11). */
export function mergedStops(args) {
  return mergeStops(stopsByTraveler(args));
}

/** Everything the budget and `forTravelers` need, worked out once per render.
 * `local` says, per traveler, whether their chosen idea is one they live in —
 * so no flight from home is counted or missing for them (§7.6). */
export function budgetContext({ trip, travelers, options, flights, airports }) {
  const list = travelers || [];
  const choices = resolveChoices(trip, list, options);
  const local = {};
  for (const traveler of list) {
    local[traveler.id] = isLocalToIdea({ traveler, trip, ideaId: choices[traveler.id].ideaId, flights, airports });
  }
  return {
    travelers: list,
    choices,
    local,
    perTravelerStops: stopsByTraveler({ travelers: list, trip, options, flights, airports }),
  };
}

/**
 * What the trip costs one traveler (§11): their picked home flights under
 * their own chosen idea, every hop they're for, and their share of each
 * chosen stay and each split cost. Missing prices count as 0 but are named in
 * `missing`, so a partial total is never labeled complete ("at least $X").
 */
export function travelerBreakdown({ travelerId, ctx, flights, stays, costs }) {
  const traveler = (ctx.travelers || []).find((t) => t.id === travelerId) || null;
  const name = (traveler && traveler.name) || "this traveler";
  const choice = (ctx.choices && ctx.choices[travelerId]) || { ideaId: null, optionId: null };
  const missing = [];

  function priceOf(item, label) {
    const latest = latestEntry(item.prices);
    if (!latest || typeof latest.amountCents !== "number") {
      missing.push(label);
      return 0;
    }
    return latest.amountCents;
  }

  // Someone who lives in their idea's city needs no flight from home, so
  // nothing counts for them there and nothing is missing — including any
  // flight they saved before they were local, which stays put, uncounted (§7.6).
  const local = Boolean(ctx.local && ctx.local[travelerId]);

  // The price of a home flight or a hop is per person, so it isn't split.
  const homeFlights = local
    ? []
    : (flights || []).filter(
        (f) => f.role === "home" && f.picked !== false && f.ideaId === choice.ideaId && forTravelers(f, "home", ctx).includes(travelerId)
      );
  if (!local && homeFlights.length === 0) missing.push(`No flight chosen for ${name}`);
  const homeCents = homeFlights.reduce(
    (sum, f) => sum + priceOf(f, `No price logged for ${name}'s flight "${f.label || "flight"}"`),
    0
  );

  const hopCents = (flights || [])
    .filter((f) => f.role === "hop" && forTravelers(f, "hop", ctx).includes(travelerId))
    .reduce((sum, f) => sum + priceOf(f, `No price logged for "${f.label || "a flight"}"`), 0);

  // A stay or a cost is one amount split equally between the travelers it's
  // for, in travelers-array order, so the shares always add up exactly (§11).
  const shareOf = (amountCents, ids) => {
    const index = ids.indexOf(travelerId);
    return index < 0 ? 0 : split(amountCents, ids.length)[index];
  };

  let stayCents = 0;
  for (const stay of stays || []) {
    const ids = forTravelers(stay, "stay", ctx);
    if (!ids.includes(travelerId)) continue;
    const latest = latestEntry(stay.prices);
    if (!latest) {
      missing.push(`No price logged for ${stay.name}`);
      continue;
    }
    stayCents += shareOf(latest.amountCents, ids);
  }

  let costCents = 0;
  for (const cost of costs || []) {
    const ids = forTravelers(cost, "cost", ctx);
    if (!ids.includes(travelerId)) continue;
    costCents += shareOf(cost.amountCents || 0, ids);
  }

  return {
    travelerId,
    name,
    homeCents,
    hopCents,
    stayCents,
    costCents,
    totalCents: homeCents + hopCents + stayCents + costCents,
    complete: missing.length === 0,
    missing,
  };
}

/**
 * Overview's budget card (§7.5): one breakdown per traveler plus the combined
 * total. `stays` is the chosen stays; `missing` is every traveler's missing
 * list, deduplicated, and `complete` is false whenever anything is missing.
 */
export function tripBudget({ trip, travelers, options, flights, stays, costs, airports }) {
  const ctx = budgetContext({ trip, travelers, options, flights, airports });
  const travelerTotals = (travelers || []).map((traveler) =>
    travelerBreakdown({ travelerId: traveler.id, ctx, flights, stays, costs })
  );
  const missing = [];
  for (const entry of travelerTotals) {
    for (const note of entry.missing) if (!missing.includes(note)) missing.push(note);
  }
  const combinedCents = travelerTotals.reduce((sum, entry) => sum + entry.totalCents, 0);
  return { travelerTotals, combinedCents, complete: missing.length === 0, missing };
}
