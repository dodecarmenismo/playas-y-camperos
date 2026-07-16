import {
  db,
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "./firebase.js";
import { getProfile } from "./profile.js";
import { renderStarsInto, averageOf, formatAvg } from "./stars.js";
import { openModal, closeModal } from "./modal.js";
import { avatarInnerHtml } from "./avatar.js";

// Punto medio entre Málaga capital y Coín
const CENTER = [36.69, -4.58];

let map;
let markers = new Map(); // beachId -> Leaflet marker
let placingMode = false;
let ratingsUnsub = null;

export function initMapView() {
  map = L.map("playas-map").setView(CENTER, 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19,
  }).addTo(map);

  const fab = document.getElementById("add-beach-btn");
  fab.addEventListener("click", () => {
    placingMode = !placingMode;
    fab.textContent = placingMode ? "Toca el mapa…" : "＋ Playa";
    fab.classList.toggle("btn-primary", placingMode);
  });

  map.on("click", (e) => {
    if (!placingMode) return;
    placingMode = false;
    fab.textContent = "＋ Playa";
    fab.classList.remove("btn-primary");
    openAddBeachModal(e.latlng);
  });

  onSnapshot(collection(db, "beaches"), (snap) => {
    snap.docChanges().forEach((change) => {
      const data = change.doc.data();
      const id = change.doc.id;
      if (change.type === "removed") {
        if (markers.has(id)) {
          map.removeLayer(markers.get(id));
          markers.delete(id);
        }
        return;
      }
      if (markers.has(id)) {
        markers.get(id).setLatLng([data.lat, data.lng]);
        return;
      }
      const marker = L.marker([data.lat, data.lng]).addTo(map);
      marker.bindPopup(buildPopupHtml(id, data.name));
      marker.on("popupopen", () => {
        const btn = document.getElementById(`beach-vote-${id}`);
        if (btn) btn.addEventListener("click", () => openBeachDetail(id, data.name));
      });
      markers.set(id, marker);
    });
  });
}

function buildPopupHtml(id, name) {
  return `<strong>${escapeHtml(name)}</strong><br/><button class="beach-popup-btn" id="beach-vote-${id}">Ver / votar</button>`;
}

function openAddBeachModal(latlng) {
  const el = openModal(`
    <h2>Nueva playa 🏖️</h2>
    <label class="field-label">Nombre de la playa</label>
    <input type="text" id="new-beach-name" placeholder="Ej. Playa de la Misericordia" />
    <button class="btn-primary btn-block" id="new-beach-save">Guardar</button>
  `);
  el.querySelector("#new-beach-save").addEventListener("click", async () => {
    const name = el.querySelector("#new-beach-name").value.trim();
    if (!name) return;
    const profile = getProfile();
    await addDoc(collection(db, "beaches"), {
      name,
      lat: latlng.lat,
      lng: latlng.lng,
      createdBy: profile?.uid || null,
      createdAt: serverTimestamp(),
    });
    closeModal();
  });
}

function openBeachDetail(beachId, name) {
  const el = openModal(`
    <h2>${escapeHtml(name)}</h2>
    <div id="beach-avg" class="muted">Cargando…</div>
    <div id="beach-votes" class="comment-list" style="margin-top:12px;"></div>
    <div style="margin-top:16px;">
      <label class="field-label">Tu voto</label>
      <div id="beach-my-stars"></div>
    </div>
  `);

  const profile = getProfile();
  const starsHost = el.querySelector("#beach-my-stars");
  const widget = renderStarsInto(starsHost, {
    value: 0,
    onChange: async (value) => {
      if (!profile) return;
      await setDoc(doc(db, "beaches", beachId, "ratings", profile.uid), {
        stars: value,
        name: profile.name,
        photo: profile.photo || null,
        updatedAt: serverTimestamp(),
      });
    },
  });

  if (ratingsUnsub) ratingsUnsub();
  ratingsUnsub = onSnapshot(collection(db, "beaches", beachId, "ratings"), (snap) => {
    const ratings = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const avg = averageOf(ratings, "stars");
    el.querySelector("#beach-avg").textContent = formatAvg(avg, ratings.length);

    const mine = ratings.find((r) => r.uid === profile?.uid);
    widget.setValue(mine ? mine.stars : 0);

    const votesHost = el.querySelector("#beach-votes");
    votesHost.innerHTML = "";
    ratings
      .slice()
      .sort((a, b) => b.stars - a.stars)
      .forEach((r) => {
        const row = document.createElement("div");
        row.className = "comment-item";
        row.innerHTML = `
          <div class="avatar-sm">${avatarInnerHtml(r.photo, r.name)}</div>
          <div class="comment-text-wrap">
            <div class="comment-author">${escapeHtml(r.name || "Anónimo")}</div>
            <div class="stars small readonly" data-stars="${r.stars}"></div>
          </div>`;
        votesHost.appendChild(row);
        renderStarsInto(row.querySelector(".stars"), { value: r.stars, readOnly: true, small: true });
      });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
