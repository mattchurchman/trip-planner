// Pure: reads the chosen stays off a trip doc, including the pre-2.0 shape
// (§5.3). No DOM, no Firebase — store.js does the actual choose/unchoose writes.
// Chosen flights are a `picked` flag on each flight now (V4 §4.2), not a trip field.

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
