// All Firestore reads, writes and listeners live here (CLAUDE.md code rules).
import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  getDocs,
  deleteField,
  arrayUnion,
  arrayRemove,
} from "./firebase.js";
import { chosenStayIds } from "./lib/selection.js";

const TRIP_SUBCOLLECTIONS = ["candidates", "places", "flights", "stays", "costs", "days", "comments", "ideas", "options"];

export function checkAllowlist(email) {
  return getDoc(doc(db, "allowlist", email.toLowerCase()));
}

export function ensureUserDoc(user) {
  return setDoc(
    doc(db, "users", user.uid),
    {
      displayName: user.displayName || "",
      email: (user.email || "").toLowerCase(),
      photoURL: user.photoURL || null,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function watchTrips(onChange, onError) {
  const tripsQuery = query(collection(db, "trips"), orderBy("updatedAt", "desc"));
  return onSnapshot(
    tripsQuery,
    (snapshot) => onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    onError
  );
}

export function watchTrip(tripId, onChange, onError) {
  return onSnapshot(
    doc(db, "trips", tripId),
    (docSnap) => onChange(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null),
    onError
  );
}

export function createTrip(name, user) {
  return addDoc(collection(db, "trips"), {
    name,
    currency: "USD",
    notes: "",
    destination: null,
    destinationId: null,
    startDate: null,
    endDate: null,
    travelers: [
      {
        id: crypto.randomUUID(),
        name: user.displayName || user.email,
        uid: user.uid,
        homeCity: "",
        homeAirport: "",
      },
    ],
    selectedFlights: {},
    selectedStayIds: [],
    albumUrl: null,
    actualSpendCents: {},
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function deleteCollectionInBatches(colRef) {
  const snapshot = await getDocs(colRef);
  const docs = snapshot.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    for (const docSnap of docs.slice(i, i + 400)) batch.delete(docSnap.ref);
    await batch.commit();
  }
}

/** Deletes a trip's subcollections, its public recap (if any), then the trip itself (§7.2). */
export async function deleteTrip(tripId) {
  for (const name of TRIP_SUBCOLLECTIONS) {
    await deleteCollectionInBatches(collection(db, "trips", tripId, name));
  }
  const publicRecapRef = doc(db, "publicRecaps", tripId);
  const publicRecapSnap = await getDoc(publicRecapRef);
  if (publicRecapSnap.exists()) await deleteDoc(publicRecapRef);
  await deleteDoc(doc(db, "trips", tripId));
}

export function watchUsers(onChange, onError) {
  return onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      const usersById = {};
      for (const docSnap of snapshot.docs) usersById[docSnap.id] = docSnap.data();
      onChange(usersById);
    },
    onError
  );
}

/** Updates one or more top-level trip fields and bumps updatedAt (§5, §8). */
export function updateTripFields(tripId, fields) {
  return updateDoc(doc(db, "trips", tripId), { ...fields, updatedAt: serverTimestamp() });
}

/** Replaces the whole travelers array — the one field allowed to be read-modify-written (§5). */
export function updateTravelers(tripId, travelers) {
  return updateTripFields(tripId, { travelers });
}

/** One-time read of a traveler's flight options, used when removing them (§7.5). */
export async function getTravelerFlights(tripId, travelerId) {
  const flightsQuery = query(collection(db, "trips", tripId, "flights"), where("travelerId", "==", travelerId));
  const snapshot = await getDocs(flightsQuery);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

/** Removes a traveler, dropping only their own selectedFlights entry in the same
 * write so a teammate's concurrent Choose elsewhere in the map isn't clobbered (§7.5). */
export function removeTraveler(tripId, travelers, travelerId) {
  return updateTripFields(tripId, {
    travelers,
    [`selectedFlights.${travelerId}`]: deleteField(),
  });
}

// Generic helpers shared by the ranked, commentable subcollections (candidates, places, ...).
function watchSubcollection(tripId, name, onChange, onError) {
  return onSnapshot(
    collection(db, "trips", tripId, name),
    (snapshot) => onChange(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))),
    onError
  );
}

function addSubDoc(tripId, name, fields, uid) {
  return addDoc(collection(db, "trips", tripId, name), {
    ...fields,
    addedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function updateSubDoc(tripId, name, docId, fields) {
  return updateDoc(doc(db, "trips", tripId, name, docId), { ...fields, updatedAt: serverTimestamp() });
}

function deleteSubDoc(tripId, name, docId) {
  return deleteDoc(doc(db, "trips", tripId, name, docId));
}

function voteOnSubDoc(tripId, name, docId, uid, choice) {
  return updateDoc(doc(db, "trips", tripId, name, docId), {
    [`votes.${uid}`]: choice === null ? deleteField() : choice,
    updatedAt: serverTimestamp(),
  });
}

export function watchCandidates(tripId, onChange, onError) {
  return watchSubcollection(tripId, "candidates", onChange, onError);
}

export function addCandidate(tripId, fields, uid) {
  return addSubDoc(
    tripId,
    "candidates",
    {
      city: fields.city,
      country: fields.country,
      why: fields.why || "",
      roughPriceNote: fields.roughPriceNote || "",
      dateIdea: fields.dateIdea || "",
      link: fields.link || null,
      lat: null,
      lng: null,
      airport: fields.airport || "",
      votes: {},
    },
    uid
  );
}

export function updateCandidate(tripId, candidateId, fields) {
  return updateSubDoc(tripId, "candidates", candidateId, fields);
}

export function deleteCandidate(tripId, candidateId) {
  return deleteSubDoc(tripId, "candidates", candidateId);
}

export function voteOnCandidate(tripId, candidateId, uid, choice) {
  return voteOnSubDoc(tripId, "candidates", candidateId, uid, choice);
}

/** Single-field write of a candidate's looked-up destination photo (§5.4, §7.5):
 * `{ url, pageUrl }` when one was found, or `null` when the lookup ran and
 * found nothing usable. A missing `photo` field (not yet looked up) is never
 * written here — see findPhoto() in candidates.js. */
export function setCandidatePhoto(tripId, candidateId, photo) {
  return updateSubDoc(tripId, "candidates", candidateId, { photo });
}

export function watchPlaces(tripId, onChange, onError) {
  return watchSubcollection(tripId, "places", onChange, onError);
}

export function addPlace(tripId, fields, uid) {
  return addSubDoc(
    tripId,
    "places",
    {
      name: fields.name,
      destinationId: fields.destinationId ?? null,
      category: fields.category,
      neighborhood: fields.neighborhood || "",
      note: fields.note || "",
      lat: fields.lat ?? null,
      lng: fields.lng ?? null,
      googleMapsUrl: fields.googleMapsUrl || null,
      link: fields.link || null,
      eventStart: fields.eventStart || null,
      eventEnd: fields.eventEnd || null,
      dayId: null,
      dayOrder: null,
      votes: {},
    },
    uid
  );
}

export function updatePlace(tripId, placeId, fields) {
  return updateSubDoc(tripId, "places", placeId, fields);
}

export function deletePlace(tripId, placeId) {
  return deleteSubDoc(tripId, "places", placeId);
}

export function voteOnPlace(tripId, placeId, uid, choice) {
  return voteOnSubDoc(tripId, "places", placeId, uid, choice);
}

function commentTimeMillis(value) {
  return value && typeof value.toMillis === "function" ? value.toMillis() : 0;
}

/** Comments for one target, sorted oldest-first client-side to avoid a composite index (§7.4). */
export function watchComments(tripId, targetType, targetId, onChange, onError) {
  const commentsQuery = query(
    collection(db, "trips", tripId, "comments"),
    where("targetType", "==", targetType),
    where("targetId", "==", targetId)
  );
  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      comments.sort((a, b) => commentTimeMillis(a.createdAt) - commentTimeMillis(b.createdAt));
      onChange(comments);
    },
    onError
  );
}

export function addComment(tripId, { targetType, targetId, text, uid }) {
  return addDoc(collection(db, "trips", tripId, "comments"), {
    targetType,
    targetId,
    text,
    addedBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function deleteComment(tripId, commentId) {
  return deleteDoc(doc(db, "trips", tripId, "comments", commentId));
}

export function watchFlights(tripId, onChange, onError) {
  return watchSubcollection(tripId, "flights", onChange, onError);
}

// Shared by addFlight and addPastedFlight (V4 §4.2, §4.5). A flight added from
// the pre-V4 "Flights & stays" tab passes no `role`, so it stays absent —
// route.js reads a missing role as "a flight from before V4" and leaves it
// off the rail, as an "Earlier flight".
function flightDocFields(fields) {
  return {
    travelerId: fields.travelerId ?? null,
    label: fields.label || "",
    fromCity: fields.fromCity || "",
    fromAirport: fields.fromAirport || "",
    toCity: fields.toCity || "",
    toAirport: fields.toAirport || "",
    outboundDate: fields.outboundDate || null,
    outboundDetails: fields.outboundDetails || "",
    returnDate: fields.returnDate || null,
    returnDetails: fields.returnDetails || "",
    legs: Array.isArray(fields.legs) ? fields.legs : [],
    link: fields.link || null,
    notes: fields.notes || "",
    // Optional "Price you saw" from the add form (§7.7), already a full PriceEntry
    // built by the caller (same shape as pricePanel.js's Log price).
    prices: fields.firstPriceEntry ? [fields.firstPriceEntry] : [],
    ...(fields.role ? { role: fields.role } : {}),
    ...(fields.role ? { ideaId: fields.ideaId ?? null } : {}),
    ...(fields.role === "hop" ? { optionId: fields.optionId ?? null } : {}),
    ...(fields.role === "home" ? { direction: fields.direction ?? null } : {}),
    ...(fields.role === "home" ? { landsDate: fields.landsDate ?? null } : {}),
    ...(fields.role === "home" ? { picked: fields.picked ?? true } : {}),
  };
}

export function addFlight(tripId, fields, uid) {
  return addSubDoc(tripId, "flights", flightDocFields(fields), uid);
}

/**
 * Saves a pasted flight (V4 §4.5) in one batch, creating its idea and/or
 * option alongside it when either is new — so a dropped connection never
 * leaves a flight pointing at an idea or option that was never written.
 * `idea` is `{ id }` to join an existing idea, or `{ name, order }` to create
 * one. `option` (hops only) is the same shape, or omitted for a home flight.
 * Resolves `{ ideaId, optionId, flightId }`.
 */
export async function addPastedFlight(tripId, { flight, idea, option }, uid) {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  const ideaRef = idea.id ? doc(db, "trips", tripId, "ideas", idea.id) : doc(collection(db, "trips", tripId, "ideas"));
  if (!idea.id) {
    batch.set(ideaRef, { name: idea.name, nameEdited: false, order: idea.order, addedBy: uid, createdAt: now, updatedAt: now });
  }

  let optionRef = null;
  if (option) {
    optionRef = option.id ? doc(db, "trips", tripId, "options", option.id) : doc(collection(db, "trips", tripId, "options"));
    if (!option.id) {
      batch.set(optionRef, { ideaId: ideaRef.id, name: option.name, nameEdited: false, order: option.order, addedBy: uid, createdAt: now, updatedAt: now });
    }
  }

  const flightRef = doc(collection(db, "trips", tripId, "flights"));
  batch.set(flightRef, {
    ...flightDocFields({ ...flight, ideaId: ideaRef.id, optionId: optionRef ? optionRef.id : null }),
    addedBy: uid,
    createdAt: now,
    updatedAt: now,
  });

  await batch.commit();
  return { ideaId: ideaRef.id, optionId: optionRef ? optionRef.id : null, flightId: flightRef.id };
}

export function updateFlight(tripId, flightId, fields) {
  return updateSubDoc(tripId, "flights", flightId, fields);
}

export function deleteFlight(tripId, flightId) {
  return deleteSubDoc(tripId, "flights", flightId);
}

/** Sets a home flight's `picked` field directly (§7.9/V4 §4.6's Use this / Using
 * control) — unlike chooseFlight/unchooseFlight, this isn't a per-traveler trip
 * field, it's a field on the flight doc itself. */
export function setFlightPicked(tripId, flightId, picked) {
  return updateSubDoc(tripId, "flights", flightId, { picked });
}

async function deleteFlightsWhere(tripId, field, value) {
  const flightsQuery = query(collection(db, "trips", tripId, "flights"), where(field, "==", value));
  const snapshot = await getDocs(flightsQuery);
  for (const docSnap of snapshot.docs) await deleteDoc(docSnap.ref);
}

export function watchIdeas(tripId, onChange, onError) {
  return watchSubcollection(tripId, "ideas", onChange, onError);
}

export function addIdea(tripId, fields, uid) {
  return addSubDoc(tripId, "ideas", { name: fields.name, nameEdited: Boolean(fields.nameEdited), order: fields.order }, uid);
}

export function updateIdea(tripId, ideaId, fields) {
  return updateSubDoc(tripId, "ideas", ideaId, fields);
}

/** Deletes an idea along with its options and every flight that belongs to it
 * (V4 §4.6 — "deleting asks first and deletes their flights"). Options are
 * removed first so their hop flights go with them before the idea's own
 * (home) flights are cleared by `ideaId`. */
export async function deleteIdea(tripId, ideaId) {
  const optionsSnap = await getDocs(query(collection(db, "trips", tripId, "options"), where("ideaId", "==", ideaId)));
  for (const optionDoc of optionsSnap.docs) {
    await deleteFlightsWhere(tripId, "optionId", optionDoc.id);
    await deleteDoc(optionDoc.ref);
  }
  await deleteFlightsWhere(tripId, "ideaId", ideaId);
  return deleteSubDoc(tripId, "ideas", ideaId);
}

export function watchOptions(tripId, onChange, onError) {
  return watchSubcollection(tripId, "options", onChange, onError);
}

export function addOption(tripId, fields, uid) {
  return addSubDoc(
    tripId,
    "options",
    { ideaId: fields.ideaId, name: fields.name, nameEdited: Boolean(fields.nameEdited), order: fields.order },
    uid
  );
}

export function updateOption(tripId, optionId, fields) {
  return updateSubDoc(tripId, "options", optionId, fields);
}

/** Deletes an option and its hop flights (V4 §4.6). */
export async function deleteOption(tripId, optionId) {
  await deleteFlightsWhere(tripId, "optionId", optionId);
  return deleteSubDoc(tripId, "options", optionId);
}

/** Sets or clears the trip's chosen route option (V4 §4.6's Choose this option /
 * Unchoose). Unlike chooseFlight, there is only ever one at a time. */
export function setChosenOption(tripId, optionId) {
  return updateTripFields(tripId, { chosenOptionId: optionId });
}

/**
 * Choose/unchoose a flight option for one traveler (§5.3, §7.7). A traveler may
 * choose any number of options. `trip` is the current trip doc, needed to detect
 * the pre-2.0 shape (a single flight id string): the first time a legacy value
 * changes, the whole list is written instead of arrayUnion/arrayRemove, because
 * arrayUnion on a string would silently discard the old choice.
 */
export function chooseFlight(tripId, trip, travelerId, flightId) {
  const current = trip.selectedFlights && trip.selectedFlights[travelerId];
  if (typeof current === "string") {
    const merged = current === flightId ? [current] : [current, flightId];
    return updateTripFields(tripId, { [`selectedFlights.${travelerId}`]: merged });
  }
  return updateTripFields(tripId, { [`selectedFlights.${travelerId}`]: arrayUnion(flightId) });
}

export function unchooseFlight(tripId, trip, travelerId, flightId) {
  const current = trip.selectedFlights && trip.selectedFlights[travelerId];
  if (typeof current === "string") {
    const remaining = current === flightId ? [] : [current];
    return updateTripFields(tripId, { [`selectedFlights.${travelerId}`]: remaining });
  }
  return updateTripFields(tripId, { [`selectedFlights.${travelerId}`]: arrayRemove(flightId) });
}

export function watchStays(tripId, onChange, onError) {
  return watchSubcollection(tripId, "stays", onChange, onError);
}

export function addStay(tripId, fields, uid) {
  return addSubDoc(
    tripId,
    "stays",
    {
      name: fields.name,
      provider: fields.provider || "other",
      link: fields.link || null,
      neighborhood: fields.neighborhood || "",
      lat: fields.lat ?? null,
      lng: fields.lng ?? null,
      checkIn: fields.checkIn || null,
      checkOut: fields.checkOut || null,
      guests: fields.guests || 1,
      note: fields.note || "",
      // Optional "Price you saw" from the add form (§7.7), already a full PriceEntry
      // built by the caller (same shape as pricePanel.js's Log price).
      prices: fields.firstPriceEntry ? [fields.firstPriceEntry] : [],
      votes: {},
    },
    uid
  );
}

export function updateStay(tripId, stayId, fields) {
  return updateSubDoc(tripId, "stays", stayId, fields);
}

export function deleteStay(tripId, stayId) {
  return deleteSubDoc(tripId, "stays", stayId);
}

export function voteOnStay(tripId, stayId, uid, choice) {
  return voteOnSubDoc(tripId, "stays", stayId, uid, choice);
}

/**
 * Choose/unchoose a stay (§5.3, §7.7). Any number of stays may be chosen.
 * `trip` is the current trip doc, needed to detect the pre-2.0 shape (a single
 * `selectedStayId` string): the first time a legacy value changes, the whole
 * `selectedStayIds` list is written (merging in the legacy id) and
 * `selectedStayId` is cleared, instead of using arrayUnion/arrayRemove, because
 * arrayUnion on a value living in the wrong field wouldn't touch it at all.
 */
export function chooseStay(tripId, trip, stayId) {
  if (trip.selectedStayId) {
    const merged = chosenStayIds(trip);
    if (!merged.includes(stayId)) merged.push(stayId);
    return updateTripFields(tripId, { selectedStayIds: merged, selectedStayId: deleteField() });
  }
  return updateTripFields(tripId, { selectedStayIds: arrayUnion(stayId) });
}

export function unchooseStay(tripId, trip, stayId) {
  if (trip.selectedStayId) {
    const remaining = chosenStayIds(trip).filter((id) => id !== stayId);
    return updateTripFields(tripId, { selectedStayIds: remaining, selectedStayId: deleteField() });
  }
  return updateTripFields(tripId, { selectedStayIds: arrayRemove(stayId) });
}

export function watchCosts(tripId, onChange, onError) {
  return watchSubcollection(tripId, "costs", onChange, onError);
}

export function addCost(tripId, fields, uid) {
  return addSubDoc(tripId, "costs", { label: fields.label, amountCents: fields.amountCents, note: fields.note || "" }, uid);
}

export function updateCost(tripId, costId, fields) {
  return updateSubDoc(tripId, "costs", costId, fields);
}

export function deleteCost(tripId, costId) {
  return deleteSubDoc(tripId, "costs", costId);
}

/** Appends a PriceEntry to a flight or stay's prices array (§7.8). */
export function logPriceEntry(tripId, subcollection, docId, entry) {
  return updateDoc(doc(db, "trips", tripId, subcollection, docId), {
    prices: arrayUnion(entry),
    updatedAt: serverTimestamp(),
  });
}

/** Removes one exact PriceEntry object from a flight or stay's prices array. */
export function deletePriceEntry(tripId, subcollection, docId, entry) {
  return updateDoc(doc(db, "trips", tripId, subcollection, docId), {
    prices: arrayRemove(entry),
    updatedAt: serverTimestamp(),
  });
}

export function watchDays(tripId, onChange, onError) {
  return watchSubcollection(tripId, "days", onChange, onError);
}

export function addDay(tripId, fields, uid) {
  return addSubDoc(
    tripId,
    "days",
    { date: fields.date ?? null, title: fields.title || "", focus: fields.focus || "", notes: fields.notes || "", order: fields.order },
    uid
  );
}

export function updateDay(tripId, dayId, fields) {
  return updateSubDoc(tripId, "days", dayId, fields);
}

/** Deletes a day and moves its places back to Unplanned (§7.9). `placeIds` are the
 * day's current places, computed by the caller from its already-loaded place list. */
export async function deleteDayAndUnassignPlaces(tripId, dayId, placeIds) {
  for (const placeId of placeIds) {
    await updateSubDoc(tripId, "places", placeId, { dayId: null, dayOrder: null });
  }
  await deleteSubDoc(tripId, "days", dayId);
}

/** Sets or clears the current user's reaction on a place (§7.11). Writes only recap.<uid>. */
export function setPlaceReaction(tripId, placeId, uid, reaction) {
  return updateDoc(doc(db, "trips", tripId, "places", placeId), {
    [`recap.${uid}`]: reaction === null ? deleteField() : reaction,
    updatedAt: serverTimestamp(),
  });
}

/** Stamps any of this trip's places that don't yet have a destinationId (i.e. only ones
 * copied in via "Copy to a new trip", since Places is otherwise inaccessible without one)
 * with the newly chosen destinationId, so they become visible once a destination is picked. */
export async function adoptUnassignedPlaces(tripId, destinationId) {
  const snapshot = await getDocs(collection(db, "trips", tripId, "places"));
  for (const docSnap of snapshot.docs) {
    if (!docSnap.data().destinationId) {
      await updateDoc(docSnap.ref, { destinationId, updatedAt: serverTimestamp() });
    }
  }
}

/** Copies places into a brand-new "exploring" trip (§7.11): new ids, votes and recap
 * cleared, no day assignment, no destination yet (adopted once one is chosen). */
export async function copyPlacesToNewTrip(name, user, places) {
  const newTripRef = await createTrip(name, user);
  for (const place of places) {
    await addPlace(
      newTripRef.id,
      {
        name: place.name,
        category: place.category,
        neighborhood: place.neighborhood,
        note: place.note,
        lat: place.lat,
        lng: place.lng,
        googleMapsUrl: place.googleMapsUrl,
        link: place.link,
        eventStart: place.eventStart,
        eventEnd: place.eventEnd,
      },
      user.uid
    );
  }
  return newTripRef.id;
}

/** Writes publicRecaps/{tripId} (§5.5). `recapData` should come from lib/recap.js's buildPublicRecap. */
export function publishRecap(tripId, recapData) {
  return setDoc(doc(db, "publicRecaps", tripId), { ...recapData, publishedAt: serverTimestamp() });
}

export function unpublishRecap(tripId) {
  return deleteDoc(doc(db, "publicRecaps", tripId));
}

export function watchPublicRecap(tripId, onChange, onError) {
  return onSnapshot(
    doc(db, "publicRecaps", tripId),
    (docSnap) => onChange(docSnap.exists() ? docSnap.data() : null),
    onError
  );
}

/** One-time read for the public recap.html page, which needs no live listener. */
export async function getPublicRecap(tripId) {
  const snap = await getDoc(doc(db, "publicRecaps", tripId));
  return snap.exists() ? snap.data() : null;
}

/** Sets or clears (cents === null) one traveler's actual spend (§7.11). */
export function setActualSpend(tripId, travelerId, cents) {
  return updateTripFields(tripId, { [`actualSpendCents.${travelerId}`]: cents === null ? deleteField() : cents });
}
