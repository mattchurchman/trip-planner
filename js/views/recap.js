import {
  watchTrip,
  watchUsers,
  watchPlaces,
  watchFlights,
  watchStays,
  watchCosts,
  watchPublicRecap,
  updateTripFields,
  setPlaceReaction,
  setActualSpend,
  copyPlacesToNewTrip,
  publishRecap,
  unpublishRecap,
} from "../store.js";
import { el, setPending, confirmDialog, promptDialog, friendlyError, copyLinkButton } from "../ui.js";
import { safeUrl } from "../lib/links.js";
import { parseMoney, formatMoney } from "../lib/money.js";
import { computeTotals } from "../lib/totals.js";
import { buildPublicRecap, nextTimePlaces, noOneReacted } from "../lib/recap.js";

const REACTIONS = ["loved", "fine", "skipped"];
const REACTION_LABELS = { loved: "Loved", fine: "Fine", skipped: "Skipped" };

function isEditingInside(container) {
  const active = document.activeElement;
  return container.contains(active) && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

function publicRecapUrl(tripId) {
  const root = `${location.origin}/${location.pathname.split("/")[1]}/`;
  return `${root}recap.html?trip=${encodeURIComponent(tripId)}`;
}

function reactionSummaryText(recap) {
  const counts = { loved: 0, fine: 0, skipped: 0 };
  for (const r of Object.values(recap || {})) {
    if (counts[r.rating] !== undefined) counts[r.rating] += 1;
  }
  const parts = [];
  if (counts.loved) parts.push(`${counts.loved} loved`);
  if (counts.fine) parts.push(`${counts.fine} fine`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  return parts.join(" · ") || "No reactions yet";
}

/** Renders the Recap tab (§7.11). Returns a single unsubscribe function. */
export function renderRecapPage(container, tripId, myUid) {
  let trip = null;
  let usersById = {};
  let places = [];
  let flights = [];
  let stays = [];
  let costs = [];
  let publicRecap = null;

  const loadErrorEl = el("div", { className: "field-error-holder" });
  const albumSectionEl = el("div", { className: "recap-album card" });
  const reactionsListEl = el("div", { className: "recap-places-list" });
  const nextTimeEl = el("div", { className: "recap-next-time card" });
  const actualSpendEl = el("div", { className: "recap-actuals card" });
  const publishEl = el("div", { className: "recap-publish card" });

  container.replaceChildren(
    loadErrorEl,
    el("h2", { textContent: "Recap" }),
    albumSectionEl,
    el("h3", { textContent: "Place reactions" }),
    reactionsListEl,
    nextTimeEl,
    actualSpendEl,
    publishEl
  );

  function renderAlbum() {
    if (isEditingInside(albumSectionEl)) return;
    const input = el("input", { type: "text", value: trip.albumUrl || "", placeholder: "Paste a Google Photos or iCloud shared album link" });
    const errorHolder = el("div", { className: "field-error-holder" });
    input.addEventListener("change", () => {
      errorHolder.replaceChildren();
      const value = input.value.trim();
      if (!value) {
        updateTripFields(tripId, { albumUrl: null }).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        );
        return;
      }
      const safe = safeUrl(value);
      if (!safe) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "That doesn't look like a valid link." }));
        return;
      }
      updateTripFields(tripId, { albumUrl: safe }).catch((err) =>
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
      );
    });
    const safeLink = trip.albumUrl ? safeUrl(trip.albumUrl) : null;
    albumSectionEl.replaceChildren(
      el("h3", { textContent: "Photo album" }),
      input,
      errorHolder,
      safeLink ? el("a", { href: safeLink, target: "_blank", rel: "noopener noreferrer", textContent: "Open shared album" }) : null
    );
  }

  function buildReactionRow(place) {
    const myReaction = (place.recap || {})[myUid] || null;
    const errorHolder = el("div", { className: "field-error-holder" });

    const ratingButtons = el(
      "div",
      { className: "rank-buttons" },
      REACTIONS.map((r) => {
        const pressed = myReaction?.rating === r;
        const btn = el("button", {
          type: "button",
          className: `btn btn-small rank-btn${pressed ? " rank-btn-pressed" : ""}`,
          textContent: REACTION_LABELS[r],
          attrs: { "aria-pressed": pressed ? "true" : "false" },
        });
        btn.addEventListener("click", () => {
          const reaction = pressed ? null : { rating: r, note: myReaction?.note || "", photoUrl: myReaction?.photoUrl || null };
          setPlaceReaction(tripId, place.id, myUid, reaction).catch((err) =>
            errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
          );
        });
        return btn;
      })
    );

    const noteInput = el("input", { type: "text", placeholder: "Note (optional)", value: myReaction?.note || "", disabled: !myReaction });
    const photoInput = el("input", { type: "text", placeholder: "Photo link (optional)", value: myReaction?.photoUrl || "", disabled: !myReaction });
    function saveDetails() {
      if (!myReaction) return;
      setPlaceReaction(tripId, place.id, myUid, {
        rating: myReaction.rating,
        note: noteInput.value.trim(),
        photoUrl: photoInput.value.trim() || null,
      }).catch((err) => errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) })));
    }
    noteInput.addEventListener("change", saveDetails);
    photoInput.addEventListener("change", saveDetails);

    return el("div", { className: "reaction-row" }, [ratingButtons, noteInput, photoInput, errorHolder]);
  }

  function renderReactions() {
    if (isEditingInside(reactionsListEl)) return;
    if (places.length === 0) {
      reactionsListEl.replaceChildren(el("p", { className: "empty-state", textContent: "No places to react to yet." }));
      return;
    }
    reactionsListEl.replaceChildren(
      ...places.map((place) => {
        const otherNotes = Object.entries(place.recap || {})
          .filter(([uid, r]) => uid !== myUid && r.note)
          .map(([uid, r]) => el("li", { textContent: `${(usersById[uid] && usersById[uid].displayName) || "Someone"}: ${r.note}` }));

        return el(
          "article",
          { className: "card recap-place-card" },
          [
            el("strong", { textContent: place.name }),
            el("p", { className: "muted", textContent: `${place.category} · ${reactionSummaryText(place.recap)}` }),
            buildReactionRow(place),
            otherNotes.length > 0 ? el("ul", { className: "recap-other-notes" }, otherNotes) : null,
          ].filter(Boolean)
        );
      })
    );
  }

  function renderNextTime() {
    const list = nextTimePlaces(places);
    const copyBtn = el("button", { type: "button", className: "btn btn-small", textContent: "Copy to a new trip", disabled: list.length === 0 });
    const errorHolder = el("div", { className: "field-error-holder" });
    copyBtn.addEventListener("click", async () => {
      const name = await promptDialog("Name the new trip", `${trip.name} — next time`);
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      setPending(copyBtn, true, "Copying…");
      try {
        const me = { uid: myUid, displayName: (usersById[myUid] && usersById[myUid].displayName) || "", email: (usersById[myUid] && usersById[myUid].email) || "" };
        const newTripId = await copyPlacesToNewTrip(trimmed, me, list);
        location.hash = `#/trip/${newTripId}`;
      } catch (err) {
        errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
      } finally {
        setPending(copyBtn, false);
      }
    });

    const rows = list.map((place) =>
      el("li", { textContent: `${place.name} — ${noOneReacted(place) ? "Didn't get to" : "Skipped"}` })
    );

    nextTimeEl.replaceChildren(
      el("h3", { textContent: "Next time" }),
      list.length === 0 ? el("p", { className: "empty-state", textContent: "Nothing to carry forward." }) : el("ul", { className: "next-time-list" }, rows),
      copyBtn,
      errorHolder
    );
  }

  function renderActualSpend() {
    if (isEditingInside(actualSpendEl)) return;
    const flightsById = Object.fromEntries(flights.map((f) => [f.id, f]));
    const stay = stays.find((s) => s.id === trip.selectedStayId) || null;
    const result = computeTotals({
      travelers: trip.travelers || [],
      selectedFlights: trip.selectedFlights || {},
      flightsById,
      stay,
      sharedCosts: costs,
    });

    const rows = (trip.travelers || []).map((traveler) => {
      const plannedCents = result.travelerTotals.find((t) => t.travelerId === traveler.id)?.totalCents || 0;
      const actualCents = (trip.actualSpendCents || {})[traveler.id];
      const actualInput = el("input", { type: "text", placeholder: "Actual spend", value: actualCents != null ? (actualCents / 100).toFixed(2) : "" });
      const errorHolder = el("div", { className: "field-error-holder" });
      actualInput.addEventListener("change", () => {
        errorHolder.replaceChildren();
        const text = actualInput.value.trim();
        if (!text) {
          setActualSpend(tripId, traveler.id, null).catch((err) =>
            errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
          );
          return;
        }
        const cents = parseMoney(text);
        if (cents === null) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: "Enter a valid amount." }));
          return;
        }
        setActualSpend(tripId, traveler.id, cents).catch((err) =>
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
        );
      });
      return el("div", { className: "totals-row" }, [
        el("span", { textContent: traveler.name }),
        el("span", { className: "muted", textContent: `Planned: ${formatMoney(plannedCents, trip.currency)}` }),
        actualInput,
        errorHolder,
      ]);
    });

    actualSpendEl.replaceChildren(el("h3", { textContent: "Planned vs actual" }), ...rows);
  }

  function renderPublish() {
    const errorHolder = el("div", { className: "field-error-holder" });
    if (publicRecap) {
      const url = publicRecapUrl(tripId);
      const unpublishBtn = el("button", { type: "button", className: "btn btn-danger btn-small", textContent: "Unpublish" });
      unpublishBtn.addEventListener("click", async () => {
        const confirmed = await confirmDialog("Unpublish this recap? The public link will stop working.");
        if (!confirmed) return;
        try {
          await unpublishRecap(tripId);
        } catch (err) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        }
      });
      publishEl.replaceChildren(
        el("h3", { textContent: "Published" }),
        el("p", {}, [el("a", { href: url, target: "_blank", rel: "noopener noreferrer", textContent: url })]),
        copyLinkButton(url),
        unpublishBtn,
        errorHolder
      );
    } else {
      const publishBtn = el("button", { type: "button", className: "btn btn-primary btn-small", textContent: "Publish recap" });
      publishBtn.addEventListener("click", async () => {
        const confirmed = await confirmDialog(
          "Publish this recap? This makes public: trip name, city, dates, album link, place names and locations, reaction counts, notes (first names only), and photo links. Never emails, uids or prices."
        );
        if (!confirmed) return;
        setPending(publishBtn, true, "Publishing…");
        try {
          await publishRecap(tripId, buildPublicRecap(trip, places, usersById));
        } catch (err) {
          errorHolder.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }));
        } finally {
          setPending(publishBtn, false);
        }
      });
      publishEl.replaceChildren(el("h3", { textContent: "Publish" }), publishBtn, errorHolder);
    }
  }

  function rerenderAll() {
    if (!trip) return;
    renderAlbum();
    renderReactions();
    renderNextTime();
    renderActualSpend();
    renderPublish();
  }

  const unsubTrip = watchTrip(
    tripId,
    (t) => {
      trip = t;
      rerenderAll();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubUsers = watchUsers(
    (u) => {
      usersById = u;
      rerenderAll();
    },
    () => {}
  );
  const unsubPlaces = watchPlaces(
    tripId,
    (p) => {
      places = trip ? p.filter((place) => place.destinationId === trip.destinationId) : p;
      rerenderAll();
    },
    (err) => loadErrorEl.replaceChildren(el("p", { className: "field-error", textContent: friendlyError(err) }))
  );
  const unsubFlights = watchFlights(
    tripId,
    (f) => {
      flights = f;
      if (trip) renderActualSpend();
    },
    () => {}
  );
  const unsubStays = watchStays(
    tripId,
    (s) => {
      stays = s;
      if (trip) renderActualSpend();
    },
    () => {}
  );
  const unsubCosts = watchCosts(
    tripId,
    (c) => {
      costs = c;
      if (trip) renderActualSpend();
    },
    () => {}
  );
  const unsubPublicRecap = watchPublicRecap(
    tripId,
    (r) => {
      publicRecap = r;
      if (trip) renderPublish();
    },
    () => {}
  );

  return () => {
    unsubTrip();
    unsubUsers();
    unsubPlaces();
    unsubFlights();
    unsubStays();
    unsubCosts();
    unsubPublicRecap();
  };
}
