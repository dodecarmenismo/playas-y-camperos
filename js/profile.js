import { db, doc, setDoc, getDoc, ensureSignedIn } from "./firebase.js";

const LOCAL_KEY = "playas_profile_v1";
let cachedProfile = null; // { uid, name, photo }

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

function resizePhotoToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    const nameInput = document.getElementById("profile-name-input");
    const photoInput = document.getElementById("profile-photo-input");
    const preview = document.getElementById("profile-photo-preview");
    const placeholder = document.getElementById("profile-photo-placeholder");
    const saveBtn = document.getElementById("profile-save-btn");

    let pendingPhoto = existing?.photo || null;
    nameInput.value = existing?.name || "";
    if (pendingPhoto) {
      preview.src = pendingPhoto;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
    } else {
      preview.classList.add("hidden");
      placeholder.classList.remove("hidden");
    }

    overlay.classList.remove("hidden");

    const onPhotoChange = async () => {
      const file = photoInput.files[0];
      if (!file) return;
      pendingPhoto = await resizePhotoToDataUrl(file);
      preview.src = pendingPhoto;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
    };

    const onSave = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      saveBtn.disabled = true;
      await saveProfile(uid, name, pendingPhoto);
      cleanup();
      overlay.classList.add("hidden");
      resolve();
    };

    function cleanup() {
      photoInput.removeEventListener("change", onPhotoChange);
      saveBtn.removeEventListener("click", onSave);
      saveBtn.disabled = false;
    }

    photoInput.addEventListener("change", onPhotoChange);
    saveBtn.addEventListener("click", onSave);
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
