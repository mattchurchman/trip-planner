// Only this file imports from the Firebase CDN. Every other file imports from "./firebase.js".
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
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
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const isConfigured = Boolean(
  firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("YOUR_")
);

const app = isConfigured ? initializeApp(firebaseConfig) : null;

export const auth = isConfigured ? getAuth(app) : null;
export const db = isConfigured ? getFirestore(app) : null;

export {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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
};
