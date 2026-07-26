import {
  db,
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "./firebase.js";
import { getProfile } from "./profile.js";
import { renderStarsInto, averageOf, formatAvg } from "./stars.js";
import { openModal, closeModal } from "./modal.js";
import { avatarInnerHtml } from "./avatar.js";
import { subscribeLocationComments, renderCommentsInto, openAddExperienceModal } from "./diary.js";

const CATEGORIES = [
  { key: "overall", label: "Campero (global)" },
  { key: "place", label: "El sitio" },
  { key: "bread", label: "El pan" },
  { key: "toasted", label: "El tostado" },
];

let camperosCache = [];
const openUnsubs = new Map(); // camperoId -> unsub, solo para la tarjeta abierta en la lista

export function initCamperosView() {
  document.getElementById("add-campero-btn").addEventListener("click", openAddCamperoModal);

  onSnapshot(query(collection(db, "camperos"), orderBy("createdAt", "desc")), (snap) => {
    camperosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
  });
}

function renderList() {
  const host = document.getElementById("camperos-list");
  const openId = host.dataset.openId || null;
  host.innerHTML = "";

  if (camperosCache.length === 0) {
    host.innerHTML = `<div class="empty-state">Aún no hay sitios de campero. ¡Añade el primero! 🥪</div>`;
    return;
  }

  camperosCache.forEach((c) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title-row" data-id="${c.id}">
        <div>
          <div class="card-title">${escapeHtml(c.name)}</div>
          ${c.address ? `<div class="card-subtitle">${escapeHtml(c.address)}</div>` : ""}
        </div>
        <div class="card-avg" id="avg-${c.id}">…</div>
      </div>
      <div class="card-body hidden" id="body-${c.id}"></div>
    `;
    host.appendChild(card);

    card.querySelector(".card-title-row").addEventListener("click", () => toggleCard(c));
  });

  if (openId && camperosCache.some((c) => c.id === openId)) {
    const c = camperosCache.find((x) => x.id === openId);
    toggleCard(c, true);
  }
}

function toggleCard(campero, forceOpen) {
  const host = document.getElementById("camperos-list");
  const body = document.getElementById(`body-${campero.id}`);
  const isOpen = !body.classList.contains("hidden");

  // cerrar cualquier otra tarjeta abierta
  openUnsubs.forEach((unsub) => unsub());
  openUnsubs.clear();
  document.querySelectorAll(".card-body").forEach((b) => b.classList.add("hidden"));

  if (isOpen && !forceOpen) {
    host.dataset.openId = "";
    return;
  }

  host.dataset.openId = campero.id;
  body.classList.remove("hidden");
  const unsub = mountCamperoDetail(campero, body);
  openUnsubs.set(campero.id, unsub);
}

// Renderiza el detalle completo de un campero (ratings por categoría +
// comentarios + experiencia) dentro de `body`. Se usa tanto desde la
// tarjeta de la lista como desde el popup del mapa. Devuelve una función
// para cancelar todas las suscripciones abiertas.
export function mountCamperoDetail(campero, body) {
  const profile = getProfile();

  body.innerHTML = `
    <div id="cat-avgs-${campero.id}" style="display:flex;flex-direction:column;gap:6px;"></div>
    <div>
      <label class="field-label">Tu valoración</label>
      <div id="my-ratings-${campero.id}" style="display:flex;flex-direction:column;gap:8px;"></div>
      <textarea id="my-comment-${campero.id}" placeholder="¿Qué tal el campero de hoy?" style="margin-top:8px;"></textarea>
      <button class="btn-primary btn-block" id="save-rating-${campero.id}">Guardar mi voto</button>
    </div>
    <div>
      <label class="field-label">Comentarios</label>
      <div class="comment-list" id="comments-${campero.id}"></div>
    </div>
    <div>
      <div class="inline-header">
        <label class="field-label">Experiencia</label>
        <button class="btn-secondary" id="add-exp-${campero.id}">＋ Añadir</button>
      </div>
      <div class="comment-list" id="exp-${campero.id}"></div>
    </div>
  `;

  const myRatingsHost = body.querySelector(`#my-ratings-${campero.id}`);
  const starWidgets = {};
  CATEGORIES.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "rating-row";
    row.innerHTML = `<span class="rating-label">${cat.label}</span>`;
    const starsEl = document.createElement("div");
    row.appendChild(starsEl);
    myRatingsHost.appendChild(row);
    starWidgets[cat.key] = renderStarsInto(starsEl, { value: 0 });
  });

  body.querySelector(`#save-rating-${campero.id}`).addEventListener("click", async () => {
    if (!profile) return;
    const payload = { name: profile.name, photo: profile.photo || null, updatedAt: serverTimestamp() };
    CATEGORIES.forEach((cat) => {
      payload[cat.key] = starWidgets[cat.key].getValue();
    });
    payload.comment = body.querySelector(`#my-comment-${campero.id}`).value.trim();
    await setDoc(doc(db, "camperos", campero.id, "ratings", profile.uid), payload);
  });

  const avgHost = body.querySelector(`#cat-avgs-${campero.id}`);
  const commentsHost = body.querySelector(`#comments-${campero.id}`);
  const myCommentEl = body.querySelector(`#my-comment-${campero.id}`);

  const ratingsUnsub = onSnapshot(collection(db, "camperos", campero.id, "ratings"), (snap) => {
    const ratings = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

    avgHost.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const avg = averageOf(ratings, cat.key);
      const row = document.createElement("div");
      row.className = "rating-row";
      row.innerHTML = `<span class="rating-label">${cat.label}</span><span class="muted">${formatAvg(avg, ratings.filter((r) => typeof r[cat.key] === "number" && r[cat.key] > 0).length)}</span>`;
      avgHost.appendChild(row);
    });

    const avgEl = document.getElementById(`avg-${campero.id}`);
    if (avgEl) {
      avgEl.textContent = formatAvg(
        averageOf(ratings, "overall"),
        ratings.filter((r) => typeof r.overall === "number" && r.overall > 0).length
      );
    }

    const mine = ratings.find((r) => r.uid === profile?.uid);
    CATEGORIES.forEach((cat) => starWidgets[cat.key].setValue(mine ? mine[cat.key] || 0 : 0));
    if (mine?.comment && !myCommentEl.dataset.touched) myCommentEl.value = mine.comment;

    commentsHost.innerHTML = "";
    const withComments = ratings.filter((r) => r.comment && r.comment.trim());
    if (withComments.length === 0) {
      commentsHost.innerHTML = `<div class="muted" style="font-size:0.8rem;">Nadie ha comentado todavía.</div>`;
    }
    withComments.forEach((r) => {
      const item = document.createElement("div");
      item.className = "comment-item";
      item.innerHTML = `
        <div class="avatar-sm">${avatarInnerHtml(r.photo, r.name)}</div>
        <div class="comment-text-wrap">
          <div class="comment-author">${escapeHtml(r.name || "Anónimo")}</div>
          <div>${escapeHtml(r.comment)}</div>
        </div>`;
      commentsHost.appendChild(item);
    });
  });

  myCommentEl.addEventListener("input", () => (myCommentEl.dataset.touched = "1"));

  const expHost = body.querySelector(`#exp-${campero.id}`);
  const expUnsub = subscribeLocationComments("camperoId", campero.id, (entries) => renderCommentsInto(expHost, entries));
  body.querySelector(`#add-exp-${campero.id}`).addEventListener("click", () => {
    openAddExperienceModal({ presetCamperoId: campero.id });
  });

  return () => {
    ratingsUnsub();
    expUnsub();
  };
}

export async function geocode(searchQuery) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchQuery
    )}&viewbox=-5.6,37.4,-3.9,36.2&bounded=1&limit=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    console.error("Geocoding falló", err);
  }
  return null;
}

function openAddCamperoModal() {
  const el = openModal(`
    <h2>Nuevo sitio de campero 🥪</h2>
    <label class="field-label">Nombre</label>
    <input type="text" id="new-campero-name" placeholder="Ej. Bar El Rincón" />
    <label class="field-label" style="margin-top:10px;">Dirección / dónde está (opcional)</label>
    <input type="text" id="new-campero-address" placeholder="Ej. Coín, junto a la plaza" />
    <button class="btn-primary btn-block" id="new-campero-save">Guardar</button>
  `);
  el.querySelector("#new-campero-save").addEventListener("click", async () => {
    const name = el.querySelector("#new-campero-name").value.trim();
    if (!name) return;
    const address = el.querySelector("#new-campero-address").value.trim();
    const profile = getProfile();

    const saveBtn = el.querySelector("#new-campero-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Ubicando…";
    // Geocodificamos solo la dirección: el nombre del negocio casi nunca está
    // registrado en OpenStreetMap y arruinaría la búsqueda.
    const coords = address ? await geocode(`${address}, Málaga`) : null;

    await addDoc(collection(db, "camperos"), {
      name,
      address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      createdBy: profile?.uid || null,
      createdAt: serverTimestamp(),
    });
    closeModal();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
