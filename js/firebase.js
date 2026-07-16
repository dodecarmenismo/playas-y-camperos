import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
};

let signedInUser = null;
let signInPromiseResolvers = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    signedInUser = user;
    signInPromiseResolvers.forEach((resolve) => resolve(user));
    signInPromiseResolvers = [];
  }
});

signInAnonymously(auth).catch((err) => {
  console.error("Error al iniciar sesión anónima. ¿Está habilitado el proveedor Anónimo en Firebase Auth?", err);
});

export function ensureSignedIn() {
  if (signedInUser) return Promise.resolve(signedInUser);
  return new Promise((resolve) => signInPromiseResolvers.push(resolve));
}
