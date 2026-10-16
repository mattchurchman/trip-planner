// DEMO STUB: sample trip data for UX review screenshots.
export function seed(T) {
  const now = T("2026-10-12T18:00:00Z");
  const meta = (by = "u-matt") => ({ addedBy: by, createdAt: now, updatedAt: now });
  const price = (c, d, by = "u-matt") => ({ id: "p" + c + d, amountCents: c, checkedAt: d, byUid: by, note: "" });
  const out = {};
  out["allowlist/churchman.matt@gmail.com"] = { name: "Matt" };
  out["users/u-matt"] = { displayName: "Matt Churchman", email: "churchman.matt@gmail.com", photoURL: null };
  out["users/u-sam"] = { displayName: "Sam Ortiz", email: "sam@example.com", photoURL: null };
  out["users/u-priya"] = { displayName: "Priya Shah", email: "priya@example.com", photoURL: null };

  const travelers = [
    { id: "tr-matt", name: "Matt", uid: "u-matt", homeCity: "Denver", homeAirport: "DEN" },
    { id: "tr-sam", name: "Sam", uid: "u-sam", homeCity: "San Francisco", homeAirport: "SFO" },
    { id: "tr-priya", name: "Priya", uid: "u-priya", homeCity: "Denver", homeAirport: "DEN" },
  ];
  const choice = { ideaId: "i1", optionId: "o1", localIdeaIds: [] };
  out["trips/t1"] = {
    name: "Italy & Spain", currency: "USD", notes: "", startDate: "2027-04-10", endDate: "2027-04-22",
    travelers, choices: { "tr-matt": choice, "tr-sam": choice, "tr-priya": { ideaId: "i1", optionId: "o2", localIdeaIds: [] } },
    selectedStayIds: ["s1", "s3"], albumUrl: null,
    myMapsUrl: "https://www.google.com/maps/d/edit?mid=1ZyXwVuTsRqPoNmLkJiHgFe",
    createdBy: "u-matt", createdAt: now, updatedAt: now,
  };
  out["trips/t2"] = {
    name: "Japan cherry blossoms", currency: "USD", notes: "", startDate: "2027-03-28", endDate: "2027-04-08",
    travelers: travelers.slice(0, 2), choices: {}, selectedStayIds: [], albumUrl: null, createdBy: "u-matt",
    createdAt: T("2026-09-01T00:00:00Z"), updatedAt: T("2026-10-01T00:00:00Z"),
  };
  out["trips/t3"] = {
    name: "Moab long weekend", currency: "USD", notes: "", startDate: null, endDate: null,
    travelers: travelers.slice(0, 1), choices: {}, selectedStayIds: [], albumUrl: null, createdBy: "u-matt",
    createdAt: T("2026-08-01T00:00:00Z"), updatedAt: T("2026-08-03T00:00:00Z"),
  };

  const t = "trips/t1/";
  out[t + "ideas/i1"] = { name: "Rome round trip", nameEdited: false, order: 0, ...meta() };
  out[t + "ideas/i2"] = { name: "Lisbon in, Madrid out", nameEdited: false, order: 1, ...meta() };
  out[t + "options/o1"] = { ideaId: "i1", name: "Barcelona", nameEdited: false, order: 0, ...meta() };
  out[t + "options/o2"] = { ideaId: "i1", name: "Palermo", nameEdited: false, order: 1, ...meta() };

  const base = { forTravelerIds: null, label: "", outboundDetails: "", returnDetails: "", legs: [], link: "https://www.google.com/travel/flights", notes: "" };
  const home = (id, tr, from, c, c2) => {
    out[t + "flights/" + id] = {
      ...base, role: "home", ideaId: "i1", travelerId: tr, direction: "both", landsDate: "2027-04-11", picked: true,
      label: "United + Lufthansa · 1 stop", fromCity: from === "DEN" ? "Denver" : "San Francisco", fromAirport: from,
      toCity: "Rome", toAirport: "FCO", outboundDate: "2027-04-10", returnDate: "2027-04-22",
      outboundDetails: "Leaves 4:15 PM, lands 1:40 PM +1", returnDetails: "Leaves 10:05 AM, lands 6:20 PM",
      prices: [price(c, "2026-10-01T15:00:00Z"), price(c2, "2026-10-12T15:00:00Z")], ...meta(),
    };
  };
  home("f1", "tr-matt", "DEN", 112400, 108900);
  home("f2", "tr-sam", "SFO", 98700, 101200);
  home("f3", "tr-priya", "DEN", 112400, 108900);
  out[t + "flights/f4"] = { ...base, role: "home", ideaId: "i1", travelerId: "tr-matt", direction: "both", landsDate: "2027-04-11", picked: false,
    label: "Delta · 2 stops", fromCity: "Denver", fromAirport: "DEN", toCity: "Rome", toAirport: "FCO",
    outboundDate: "2027-04-10", returnDate: "2027-04-22", prices: [price(94100, "2026-10-08T15:00:00Z")], ...meta() };
  const hop = (id, opt, from, fc, to, tc, d, c) => {
    out[t + "flights/" + id] = { ...base, role: "hop", ideaId: "i1", optionId: opt, travelerId: null,
      label: "Vueling · Nonstop", fromCity: fc, fromAirport: from, toCity: tc, toAirport: to, outboundDate: d, returnDate: null,
      prices: [price(c, "2026-10-10T15:00:00Z")], ...meta() };
  };
  hop("h1", "o1", "FCO", "Rome", "BCN", "Barcelona", "2027-04-16", 8900);
  hop("h2", "o1", "BCN", "Barcelona", "FCO", "Rome", "2027-04-20", 9600);
  hop("h3", "o2", "FCO", "Rome", "PMO", "Palermo", "2027-04-15", 6400);
  hop("h4", "o2", "PMO", "Palermo", "FCO", "Rome", "2027-04-19", 7100);

  const place = (id, name, category, hood, lat, lng, stopKey, votes, dayId = null, dayOrder = null) => {
    out[t + "places/" + id] = { name, category, neighborhood: hood, note: "", lat, lng, googleMapsUrl: "https://maps.google.com/?q=" + encodeURIComponent(name),
      link: null, stopKey, layer: "", dayId, dayOrder, votes, ...meta() };
  };
  place("pl1", "Roscioli Salumeria", "Food", "Centro Storico", 41.8937, 12.4729, "Rome, IT", { "u-matt": "love", "u-sam": "love" }, "d1", 1);
  place("pl2", "Sant'Eustachio Il Caffè", "Coffee & cafés", "Pantheon", 41.8984, 12.4755, "Rome, IT", { "u-priya": "like" }, "d1", 0);
  place("pl3", "Galleria Borghese", "Museum & history", "Villa Borghese", 41.9142, 12.4921, "Rome, IT", { "u-matt": "love", "u-priya": "love", "u-sam": "like" }, "d2", 0);
  place("pl4", "Trastevere evening walk", "Neighborhood walk", "Trastevere", 41.8894, 12.4700, "Rome, IT", { "u-sam": "love" });
  place("pl5", "Pantheon", "Sight", "Centro Storico", 41.8986, 12.4769, "Rome, IT", { "u-matt": "like" }, "d1", 2);
  place("pl6", "Sagrada Família", "Sight", "Eixample", 41.4036, 2.1744, "Barcelona, ES", { "u-matt": "love", "u-priya": "love" });
  place("pl7", "Bar Cañete", "Food", "El Raval", 41.3797, 2.1736, "Barcelona, ES", { "u-sam": "love" });
  place("pl8", "Paradiso", "Drinks & nightlife", "El Born", 41.3853, 2.1832, "Barcelona, ES", { "u-sam": "like", "u-matt": "pass" });
  place("pl9", "Montserrat", "Day trip", "", 41.5933, 1.8376, "Barcelona, ES", {});

  const stay = (id, name, provider, hood, lat, lng, ci, co, stopKey, c, outFlag = false) => {
    out[t + "stays/" + id] = { name, provider, link: "https://www.booking.com/", neighborhood: hood, lat, lng, checkIn: ci, checkOut: co, guests: 3,
      note: "", stopKey, out: outFlag, forTravelerIds: null, prices: [price(c, "2026-10-11T15:00:00Z")], ...meta() };
  };
  stay("s1", "Hotel Campo de' Fiori", "booking", "Centro Storico", 41.8956, 12.4722, "2027-04-11", "2027-04-16", "Rome, IT", 142000);
  stay("s2", "Trastevere loft", "airbnb", "Trastevere", 41.8890, 12.4693, "2027-04-11", "2027-04-16", "Rome, IT", 118500, true);
  stay("s3", "Casa Bonay", "hotel_direct", "Eixample", 41.3937, 2.1756, "2027-04-16", "2027-04-20", "Barcelona, ES", 98000);

  out[t + "costs/c1"] = { label: "Train Rome ⇄ Florence", amountCents: 21000, forTravelerIds: null, note: "", ...meta() };
  out[t + "costs/c2"] = { label: "Food estimate", amountCents: 180000, forTravelerIds: null, note: "", ...meta() };

  out[t + "days/d1"] = { date: "2027-04-11", title: "Rome", focus: "Centro Storico", notes: "", order: 0, ...meta() };
  out[t + "days/d2"] = { date: "2027-04-12", title: "Rome", focus: "Villa Borghese + Monti", notes: "", order: 1, ...meta() };
  out[t + "days/d3"] = { date: "2027-04-13", title: "Rome", focus: "", notes: "", order: 2, ...meta() };

  out[t + "comments/cm1"] = { targetType: "trip", targetId: "t1", text: "Can we book the Borghese tickets this week? They sell out.", ...meta("u-priya") };
  out[t + "comments/cm2"] = { targetType: "trip", targetId: "t1", text: "On it — I'll grab Saturday morning.", ...meta() };
  return out;
}
