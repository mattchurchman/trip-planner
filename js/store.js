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
} from "./firebase.js";

const TRIP_SUBCOLLECTIONS = ["candidates", "places", "flights", "stays", "costs", "days", "comments"];

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
    status: "exploring",
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
    selectedStayId: null,
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
