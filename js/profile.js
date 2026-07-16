import { db, doc, setDoc, getDoc, ensureSignedIn } from "./firebase.js";
import { avatarInnerHtml } from "./avatar.js";

const LOCAL_KEY = "playas_profile_v1";
let cachedProfile = null; // { uid, name, photo }

const ROSTER = [
  { name: "Dani", photo: "assets/avatars/dani.jpeg" },
  { name: "Carmen", photo: "assets/avatars/carmen.jpeg" },
  { name: "Jacinto", photo: "assets/avatars/jacinto.jpeg" },
  { name: "Ernesto", photo: "assets/avatars/ernesto.jpeg" },
  { name: "Guest", photo: null },
];

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY));
  } catch {
    return null;
  }
}

function writeLocal(profile) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(profile));
}

export function getProfile() {
  return cachedProfile;
}

function updateHeaderBadge() {
  const img = document.getElementById("profile-badge-img");
  const initial = document.getElementById("profile-badge-initial");
  if (!cachedProfile) return;
  if (cachedProfile.photo) {
    img.src = cachedProfile.photo;
    img.classList.remove("hidden");
    initial.classList.add("hidden");
  } else {
    initial.textContent = cachedProfile.name ? cachedProfile.name[0].toUpperCase() : "?";
    initial.classList.remove("hidden");
    img.classList.add("hidden");
  }
}

async function saveProfile(uid, name, photo) {
  const profile = { uid, name, photo: photo || null };
  cachedProfile = profile;
  writeLocal(profile);
  updateHeaderBadge();
  await setDoc(doc(db, "users", uid), {
    name,
    photo: photo || null,
    updatedAt: Date.now(),
  });
  return profile;
}

function openSetupModal(uid, existing) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("profile-setup");
    const grid = document.getElementById("roster-grid");

    grid.innerHTML = "";
    ROSTER.forEach((entry) => {
      const item = document.createElement("button");
      item.className = "roster-item";
      if (existing && existing.name === entry.name) item.classList.add("selected");
      item.innerHTML = `
        <span class="roster-avatar">${avatarInnerHtml(entry.photo, entry.name)}</span>
        <span class="roster-name">${entry.name}</span>
      `;
      item.addEventListener("click", async () => {
        grid.querySelectorAll(".roster-item").forEach((el) => (el.disabled = true));
        await saveProfile(uid, entry.name, entry.photo);
        overlay.classList.add("hidden");
        resolve();
      });
      grid.appendChild(item);
    });

    overlay.classList.remove("hidden");
  });
}

export async function initProfile() {
  const user = await ensureSignedIn();
  const local = readLocal();

  if (local && local.uid === user.uid) {
    cachedProfile = local;
    updateHeaderBadge();
  } else {
    // Puede que ya exista un perfil en Firestore (mismo dispositivo, storage borrado)
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      cachedProfile = { uid: user.uid, ...snap.data() };
      writeLocal(cachedProfile);
      updateHeaderBadge();
    } else {
      await openSetupModal(user.uid, null);
    }
  }

  document.getElementById("profile-badge").addEventListener("click", () => {
    openSetupModal(user.uid, cachedProfile);
  });
}
