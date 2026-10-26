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
import { mountComments } from "./comments.js";

const CATEGORIES = [
  { key: "overall", label: "Peli (global)" },
  { key: "script", label: "Guion" },
  { key: "narrative", label: "Narración" },
  { key: "photography", label: "Fotografía" },
  { key: "bso", label: "BSO / sonido" },
  { key: "acting", label: "Interpretaciones" },
  { key: "direction", label: "Dirección" },
];

let moviesCache = [];
let openUnsub = null;

export function initMoviesView() {
  document.getElementById("add-movie-btn").addEventListener("click", openAddMovieModal);

  onSnapshot(query(collection(db, "movies"), orderBy("createdAt", "desc")), (snap) => {
    moviesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
  });
}

function posterHtml(m, cls) {
  return m.poster
    ? `<img class="${cls}" src="${escapeAttr(m.poster)}" alt="" onerror="this.outerHTML='<div class=\\'${cls} poster-empty\\'>🎬</div>'" />`
    : `<div class="${cls} poster-empty">🎬</div>`;
}

function renderList() {
  const host = document.getElementById("movies-list");
  const openId = host.dataset.openId || null;
  if (openUnsub) {
    openUnsub();
    openUnsub = null;
  }
  host.innerHTML = "";

  if (moviesCache.length === 0) {
    host.innerHTML = `<div class="empty-state">Aún no hay pelis. ¡Añade la primera! 🎬</div>`;
    return;
  }

  moviesCache.forEach((m) => {
    const meta = [m.director, m.year, m.country].filter(Boolean).map(escapeHtml).join(" · ");
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title-row movie-row">
        ${posterHtml(m, "movie-poster-sm")}
        <div class="movie-info">
          <div class="card-title">${escapeHtml(m.title)}</div>
          ${meta ? `<div class="card-subtitle">${meta}</div>` : ""}
        </div>
        <div class="card-avg" id="movie-avg-${m.id}">…</div>
      </div>
      <div class="card-body hidden" id="movie-body-${m.id}"></div>
    `;
    host.appendChild(card);
    card.querySelector(".card-title-row").addEventListener("click", () => toggleCard(m));
  });

  if (openId) {
    const m = moviesCache.find((x) => x.id === openId);
    if (m) toggleCard(m, true);
  }
}

function toggleCard(movie, forceOpen) {
  const host = document.getElementById("movies-list");
  const body = document.getElementById(`movie-body-${movie.id}`);
  const isOpen = !body.classList.contains("hidden");

  if (openUnsub) {
    openUnsub();
    openUnsub = null;
  }
  host.querySelectorAll(".card-body").forEach((b) => b.classList.add("hidden"));

  if (isOpen && !forceOpen) {
    host.dataset.openId = "";
    return;
  }

  host.dataset.openId = movie.id;
  body.classList.remove("hidden");
  openUnsub = mountMovieDetail(movie, body);
}

function mountMovieDetail(movie, body) {
  const profile = getProfile();

  body.innerHTML = `
    <div class="movie-detail-head">
      ${posterHtml(movie, "movie-poster-lg")}
      <div class="movie-detail-meta">
        ${movie.director ? `<div><span class="muted">Director:</span> ${escapeHtml(movie.director)}</div>` : ""}
        ${movie.year ? `<div><span class="muted">Año:</span> ${escapeHtml(String(movie.year))}</div>` : ""}
        ${movie.country ? `<div><span class="muted">País:</span> ${escapeHtml(movie.country)}</div>` : ""}
      </div>
    </div>
    <div class="movie-avgs" style="display:flex;flex-direction:column;gap:6px;"></div>
    <div>
      <label class="field-label">Tu valoración</label>
      <div class="movie-my-ratings" style="display:flex;flex-direction:column;gap:8px;"></div>
      <button class="btn-primary btn-block movie-save">Guardar mi voto</button>
    </div>
    <div>
      <label class="field-label">Comentarios</label>
      <div class="movie-comments"></div>
    </div>
  `;

  const myRatingsHost = body.querySelector(".movie-my-ratings");
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

  body.querySelector(".movie-save").addEventListener("click", async (ev) => {
    const me = getProfile();
    if (!me) return;
    const payload = { name: me.name, photo: me.photo || null, updatedAt: serverTimestamp() };
    CATEGORIES.forEach((cat) => {
      payload[cat.key] = starWidgets[cat.key].getValue();
    });
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      await setDoc(doc(db, "movies", movie.id, "ratings", me.uid), payload);
      btn.textContent = "¡Guardado!";
      setTimeout(() => {
        btn.textContent = "Guardar mi voto";
      }, 1500);
    } finally {
      btn.disabled = false;
    }
  });

  const avgHost = body.querySelector(".movie-avgs");

  const ratingsUnsub = onSnapshot(collection(db, "movies", movie.id, "ratings"), (snap) => {
    const ratings = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const countOf = (key) => ratings.filter((r) => typeof r[key] === "number" && r[key] > 0).length;

    avgHost.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const row = document.createElement("div");
      row.className = "rating-row";
      row.innerHTML = `<span class="rating-label">${cat.label}</span><span class="muted">${formatAvg(
        averageOf(ratings, cat.key),
        countOf(cat.key)
      )}</span>`;
      avgHost.appendChild(row);
    });

    const avgEl = document.getElementById(`movie-avg-${movie.id}`);
    if (avgEl) avgEl.textContent = formatAvg(averageOf(ratings, "overall"), countOf("overall"));

    const mine = ratings.find((r) => r.uid === profile?.uid);
    CATEGORIES.forEach((cat) => starWidgets[cat.key].setValue(mine ? mine[cat.key] || 0 : 0));
  });

  const comments = mountComments(body.querySelector(".movie-comments"), ["movies", movie.id], {
    placeholder: "¿Qué te ha parecido?",
  });

  return () => {
    ratingsUnsub();
    comments.destroy();
  };
}

// Reduce la imagen elegida a un JPEG pequeño (≈30-60 KB) para guardarla
// directamente en Firestore sin necesitar Firebase Storage.
function fileToPosterDataUrl(file, maxWidth = 360) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

function openAddMovieModal() {
  const el = openModal(`
    <h2>Nueva peli 🎬</h2>
    <label class="field-label">Título</label>
    <input type="text" id="new-movie-title" placeholder="Ej. Perfect Days" />
    <label class="field-label" style="margin-top:10px;">Director/a</label>
    <input type="text" id="new-movie-director" placeholder="Ej. Wim Wenders" />
    <div class="two-cols">
      <div>
        <label class="field-label" style="margin-top:10px;">Año</label>
        <input type="number" id="new-movie-year" placeholder="2023" min="1880" max="2100" inputmode="numeric" />
      </div>
      <div>
        <label class="field-label" style="margin-top:10px;">País</label>
        <input type="text" id="new-movie-country" placeholder="Japón" />
      </div>
    </div>
    <label class="field-label" style="margin-top:10px;">Foto / póster</label>
    <input type="file" id="new-movie-file" accept="image/*" />
    <label class="field-label" style="margin-top:10px;">…o enlace a una imagen (opcional)</label>
    <input type="url" id="new-movie-url" placeholder="https://…" />
    <button class="btn-primary btn-block" id="new-movie-save">Guardar</button>
  `);

  el.querySelector("#new-movie-save").addEventListener("click", async () => {
    const title = el.querySelector("#new-movie-title").value.trim();
    if (!title) return;
    const director = el.querySelector("#new-movie-director").value.trim();
    const yearRaw = el.querySelector("#new-movie-year").value.trim();
    const country = el.querySelector("#new-movie-country").value.trim();
    const file = el.querySelector("#new-movie-file").files[0];
    const url = el.querySelector("#new-movie-url").value.trim();
    const profile = getProfile();

    const saveBtn = el.querySelector("#new-movie-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";

    let poster = null;
    try {
      if (file) poster = await fileToPosterDataUrl(file);
      else if (url) poster = url;
    } catch (err) {
      console.error(err);
      alert("No se pudo leer la imagen; la peli se guardará sin póster.");
    }

    await addDoc(collection(db, "movies"), {
      title,
      director,
      year: yearRaw ? Number(yearRaw) : null,
      country,
      poster,
      createdBy: profile?.uid || null,
      createdAt: serverTimestamp(),
    });
    closeModal();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
