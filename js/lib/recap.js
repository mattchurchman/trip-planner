// Pure: builds the public recap snapshot (§5.5) and the Next-time list (§7.11).
// No DOM, no Firebase. Never include uids, emails or prices -- first names only.

function firstName(user) {
  const name = (user && user.displayName) || "";
  return name.trim().split(/\s+/)[0] || "Someone";
}

/**
 * The exact object written to publicRecaps/{tripId}. Counts loved/fine/skipped
 * per place, collapses notes to { by: firstName, text }, and keeps only the
 * first non-null photo link. No uid, email or price ever appears in the output.
 */
export function buildPublicRecap(trip, places, usersById) {
  const recapPlaces = (places || []).map((place) => {
    const reactions = Object.entries(place.recap || {});
    let loved = 0;
    let fine = 0;
    let skipped = 0;
    const notes = [];
    let photoUrl = null;
    for (const [uid, reaction] of reactions) {
      if (reaction.rating === "loved") loved += 1;
      else if (reaction.rating === "fine") fine += 1;
      else if (reaction.rating === "skipped") skipped += 1;
      if (reaction.note) notes.push({ by: firstName(usersById[uid]), text: reaction.note });
      if (!photoUrl && reaction.photoUrl) photoUrl = reaction.photoUrl;
    }
    return {
      name: place.name,
      category: place.category,
      neighborhood: place.neighborhood || "",
      lat: place.lat ?? null,
      lng: place.lng ?? null,
      loved,
      fine,
      skipped,
      notes,
      photoUrl,
    };
  });

  return {
    tripName: trip.name,
    city: trip.destination ? trip.destination.city : "",
    country: trip.destination ? trip.destination.country : "",
    startDate: trip.startDate ?? null,
    endDate: trip.endDate ?? null,
    albumUrl: trip.albumUrl ?? null,
    places: recapPlaces,
  };
}

/** Places with no reaction from anyone ("Didn't get to"), plus places marked Skipped by anyone. */
export function nextTimePlaces(places) {
  return (places || []).filter((place) => {
    const reactions = Object.values(place.recap || {});
    if (reactions.length === 0) return true;
    return reactions.some((r) => r.rating === "skipped");
  });
}

/** True when `place` got no reaction from anyone -- the "Didn't get to" case specifically. */
export function noOneReacted(place) {
  return Object.keys(place.recap || {}).length === 0;
}
