import {
  db,
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
} from "./firebase.js";
import { getProfile } from "./profile.js";
import { openModal, closeModal } from "./modal.js";
import { avatarInnerHtml } from "./avatar.js";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

let beachesCache = [];
let camperosCache = [];

// Carga las listas de playas/camperos para los desplegables del formulario.
export function initExperience() {
  onSnapshot(collection(db, "beaches"), (snap) => {
    beachesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  onSnapshot(collection(db, "camperos"), (snap) => {
    camperosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function nextTuesdayOrSunday() {
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === 2 || d.getDay() === 0) return d.toISOString().slice(0, 10);
  }
  return today.toISOString().slice(0, 10);
}

// Escucha todos los días que mencionan esta playa (field="beachId") o este
// campero (field="camperoId") y junta sus comentarios en una sola lista,
// ordenada por fecha. Devuelve una función para cancelar todo de una vez.
export function subscribeLocationComments(field, id, onChange) {
  const dayUnsubs = new Map();
  const daysMeta = new Map();
  const entriesById = new Map();

  function emit() {
    const combined = [];
    daysMeta.forEach((meta, dayId) => {
      (entriesById.get(dayId) || []).forEach((e) => combined.push({ ...e, date: meta.date }));
    });
    combined.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    onChange(combined);
  }

  const mainUnsub = onSnapshot(query(collection(db, "days"), where(field, "==", id)), (snap) => {
    const currentIds = new Set(snap.docs.map((d) => d.id));
    dayUnsubs.forEach((unsub, dayId) => {
      if (!currentIds.has(dayId)) {
        unsub();
        dayUnsubs.delete(dayId);
        entriesById.delete(dayId);
        daysMeta.delete(dayId);
      }
    });
    snap.docs.forEach((d) => {
      daysMeta.set(d.id, d.data());
      if (!dayUnsubs.has(d.id)) {
        const unsub = onSnapshot(collection(db, "days", d.id, "entries"), (esnap) => {
          entriesById.set(
            d.id,
            esnap.docs.map((ed) => ({ uid: ed.id, ...ed.data(), entryId: ed.id, dayId: d.id }))
          );
          emit();
        });
        dayUnsubs.set(d.id, unsub);
      }
    });
    emit();
  });

  return () => {
    mainUnsub();
    dayUnsubs.forEach((u) => u());
  };
}

export function renderCommentsInto(host, entries) {
  host.innerHTML = "";
  if (entries.length === 0) {
    host.innerHTML = `<div class="muted" style="font-size:0.8rem;">Nadie ha comentado todavía.</div>`;
    return;
  }
  const me = getProfile();
  entries.forEach((e) => {
    const item = document.createElement("div");
    item.className = "comment-item";
    const canDelete = me && e.uid === me.uid;
    item.innerHTML = `
      <div class="avatar-sm">${avatarInnerHtml(e.photo, e.name)}</div>
      <div class="comment-text-wrap">
        <div class="comment-author">${escapeHtml(e.name || "Anónimo")}<span class="comment-date"> · ${formatDateShort(e.date)}</span></div>
        <div class="comment-text">${escapeHtml(e.text)}</div>
      </div>
      ${canDelete ? `<button class="comment-delete" title="Borrar">✕</button>` : ""}`;
    if (canDelete) {
      item.querySelector(".comment-delete").addEventListener("click", async () => {
        if (!confirm("¿Borrar esta experiencia?")) return;
        await deleteDoc(doc(db, "days", e.dayId, "entries", e.entryId));
      });
    }
    host.appendChild(item);
  });
}

export function openAddExperienceModal({ presetBeachId, presetCamperoId } = {}) {
  const defaultDate = nextTuesdayOrSunday();
  const beachOptions = beachesCache
    .map((b) => `<option value="${b.id}" ${b.id === presetBeachId ? "selected" : ""}>${escapeHtml(b.name)}</option>`)
    .join("");
  const camperoOptions = camperosCache
    .map((c) => `<option value="${c.id}" ${c.id === presetCamperoId ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");

  const el = openModal(`
    <h2>Añadir experiencia 📓</h2>
    <label class="field-label">Fecha</label>
    <input type="date" id="new-day-date" value="${defaultDate}" />

    <label class="field-label" style="margin-top:10px;">Playa</label>
    <select id="new-day-beach">
      <option value="">— Sin playa —</option>
      ${beachOptions}
    </select>

    <label class="field-label" style="margin-top:10px;">Campero (si fue martes)</label>
    <select id="new-day-campero">
      <option value="">— Sin campero —</option>
      ${camperoOptions}
    </select>

    <label class="field-label" style="margin-top:10px;">Tu experiencia</label>
    <textarea id="new-day-text" placeholder="¿Qué tal fue el día?"></textarea>

    <button class="btn-primary btn-block" id="new-day-save">Guardar</button>
  `);

  el.querySelector("#new-day-save").addEventListener("click", async () => {
    const date = el.querySelector("#new-day-date").value;
    if (!date) return;
    const beachId = el.querySelector("#new-day-beach").value || null;
    const camperoId = el.querySelector("#new-day-campero").value || null;
    const text = el.querySelector("#new-day-text").value.trim();
    const profile = getProfile();

    // El id incluye la playa y el campero para que dos sitios distintos el
    // mismo día no se pisen el enlace (cada combinación es su propio "día").
    const dayId = `${date}__${beachId || "x"}__${camperoId || "x"}`;

    await setDoc(
      doc(db, "days", dayId),
      { date, beachId, camperoId, updatedAt: serverTimestamp() },
      { merge: true }
    );

    if (text && profile) {
      // addDoc: cada persona puede añadir tantas experiencias como quiera,
      // incluso varias el mismo día.
      await addDoc(collection(db, "days", dayId, "entries"), {
        uid: profile.uid,
        text,
        name: profile.name,
        photo: profile.photo || null,
        updatedAt: serverTimestamp(),
      });
    }
    closeModal();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
