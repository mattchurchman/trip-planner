// DEMO ONLY (docs/demo): an in-memory stand-in for js/firebase.js so screens can be checked signed in, with sample data. Never ship this.
import { seed } from "./demo-seed.js";

class Timestamp {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
  get seconds() { return Math.floor(this.ms / 1000); }
}
const SENT = { ts: Symbol("ts"), del: Symbol("del") };
export const serverTimestamp = () => ({ __s: SENT.ts });
export const deleteField = () => ({ __s: SENT.del });
export const arrayUnion = (...v) => ({ __u: v });
export const arrayRemove = (...v) => ({ __r: v });

const store = new Map(); // path -> data
const listeners = new Set();
let autoId = 1;
const newId = () => "auto" + autoId++;

export const db = {};
export const isConfigured = true;

export function doc(base, ...segs) {
  if (base && base.type === "col") {
    const id = segs[0] || newId();
    return { type: "doc", path: base.path + "/" + id, id };
  }
  const path = segs.join("/");
  return { type: "doc", path, id: segs[segs.length - 1] };
}
export function collection(base, ...segs) {
  const path = base && base.type === "doc" ? base.path + "/" + segs.join("/") : segs.join("/");
  return { type: "col", path };
}
export const where = (f, op, v) => ({ k: "where", f, op, v });
export const orderBy = (f, dir = "asc") => ({ k: "order", f, dir });
export const query = (col, ...c) => ({ type: "col", path: col.path, c });

function resolve(v) { return v && v.__s === SENT.ts ? new Timestamp(Date.now()) : v; }
function apply(target, key, value) {
  const parts = key.split(".");
  let o = target;
  for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] && typeof o[parts[i]] === "object" ? o[parts[i]] : {}; o = o[parts[i]]; }
  const last = parts[parts.length - 1];
  if (value && value.__s === SENT.del) delete o[last];
  else if (value && value.__u) o[last] = [...(o[last] || []), ...value.__u.filter((x) => !(o[last] || []).includes(x))];
  else if (value && value.__r) o[last] = (o[last] || []).filter((x) => !value.__r.some((r) => JSON.stringify(r) === JSON.stringify(x)));
  else o[last] = resolve(value);
}
function write(path, data, merge) {
  const cur = merge && store.has(path) ? store.get(path) : {};
  for (const [k, v] of Object.entries(data)) { if (merge === "update") apply(cur, k, v); else cur[k] = resolve(v); }
  store.set(path, cur);
}
function snapDoc(path) {
  const id = path.split("/").pop();
  const data = store.get(path);
  return { id, ref: { type: "doc", path, id }, exists: () => data !== undefined, data: () => (data ? { ...data } : undefined) };
}
function snapCol(ref) {
  const depth = ref.path.split("/").length + 1;
  let docs = [...store.keys()].filter((p) => p.startsWith(ref.path + "/") && p.split("/").length === depth).map(snapDoc);
  for (const c of ref.c || []) {
    if (c.k === "where") docs = docs.filter((d) => (c.op === "==" ? d.data()[c.f] === c.v : true));
  }
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}
function notify() { for (const l of listeners) l(); }

export function onSnapshot(ref, cb) {
  const fire = () => cb(ref.type === "doc" ? snapDoc(ref.path) : snapCol(ref));
  listeners.add(fire);
  setTimeout(fire, 0);
  return () => listeners.delete(fire);
}
export const getDoc = async (ref) => snapDoc(ref.path);
export const getDocs = async (ref) => snapCol(ref);
export async function setDoc(ref, data, opts) { write(ref.path, data, opts && opts.merge); notify(); }
export async function updateDoc(ref, data) { write(ref.path, data, "update"); notify(); }
export async function addDoc(col, data) { const ref = doc(col); write(ref.path, data); notify(); return ref; }
export async function deleteDoc(ref) { store.delete(ref.path); notify(); }
export function writeBatch() {
  const ops = [];
  return {
    set: (r, d, o) => ops.push(() => write(r.path, d, o && o.merge)),
    update: (r, d) => ops.push(() => write(r.path, d, "update")),
    delete: (r) => ops.push(() => store.delete(r.path)),
    commit: async () => { ops.forEach((f) => f()); notify(); },
  };
}

// --- auth ---
const user = {
  uid: "u-matt", email: "churchman.matt@gmail.com", displayName: "Matt Churchman", photoURL: null,
  emailVerified: true, providerData: [{ providerId: "google.com" }],
  reload: async () => {}, getIdToken: async () => "x",
};
const signedOut = new URLSearchParams(location.search).has("signedout");
export const auth = { currentUser: signedOut ? null : user };
export class GoogleAuthProvider {}
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(signedOut ? null : user), 0); return () => {}; };
const noop = async () => {};
export const signInWithPopup = noop, signInWithRedirect = noop, signInWithEmailAndPassword = noop,
  createUserWithEmailAndPassword = noop, sendPasswordResetEmail = noop, sendEmailVerification = noop, signOut = noop;
export const getRedirectResult = async () => null;

// seed
const T = (d) => new Timestamp(Date.parse(d));
for (const [path, data] of Object.entries(seed(T))) store.set(path, data);
