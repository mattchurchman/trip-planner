// Pure: reads chosen flights/stays off a trip doc, including the pre-2.0 shapes
// (§5.3). No DOM, no Firebase — store.js does the actual choose/unchoose writes.

/**
 * Flight ids chosen for one traveler. Handles a missing entry, the pre-2.0
 * shape (a single flight id string), and the current shape (an array).
 */
export function chosenFlightIds(trip, travelerId) {
  const value = trip && trip.selectedFlights && trip.selectedFlights[travelerId];
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [];
}

export function isFlightChosen(trip, travelerId, flightId) {
  return chosenFlightIds(trip, travelerId).includes(flightId);
}

/**
 * Chosen stay ids: the current `selectedStayIds` array merged with the pre-2.0
 * `selectedStayId` string field, deduplicated, with no null/empty entries.
 */
export function chosenStayIds(trip) {
  const ids = [];
  if (trip) {
    for (const id of trip.selectedStayIds || []) {
      if (id && !ids.includes(id)) ids.push(id);
    }
    if (trip.selectedStayId && !ids.includes(trip.selectedStayId)) ids.push(trip.selectedStayId);
  }
  return ids;
}

export function isStayChosen(trip, stayId) {
  return chosenStayIds(trip).includes(stayId);
}
