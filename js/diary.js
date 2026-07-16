import {
  db,
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "./firebase.js";
import { getProfile } from "./profile.js";
import { openModal, closeModal } from "./modal.js";

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

let beachesCache = [];
let camperosCache = [];
let daysCache = [];
const entriesUnsubs = new Map();

export function initDiaryView() {
  document.getElementById("add-day-btn").addEventListener("click", openAddDayModal);

  onSnapshot(collection(db, "beaches"), (snap) => {
    beachesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });
  onSnapshot(collection(db, "camperos"), (snap) => {
    camperosCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  });

  onSnapshot(query(collection(db, "days"), orderBy("date", "desc")), (snap) => {
    daysCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderList();
  });
}

function weekdayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAYS[d.getDay()];
}

function formatDateHuman(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function renderList() {
  const host = document.getElementById("days-list");
  const openId = host.dataset.openId || null;
  host.innerHTML = "";

  if (daysCache.length === 0) {
    host.innerHTML = `<div class="empty-state">Todavía no hay días registrados. ¡Añade el primero! 📓</div>`;
    return;
  }

  daysCache.forEach((day) => {
    const beach = beachesCache.find((b) => b.id === day.beachId);
    const campero = camperosCache.find((c) => c.id === day.camperoId);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-title-row" data-id="${day.id}">
        <div>
          <div class="card-title">${capitalize(weekdayLabel(day.date))} ${formatDateHuman(day.date)}</div>
          <div class="day-meta">
            ${beach ? `<span class="day-tag">🏖️ ${escapeHtml(beach.name)}</span>` : ""}
            ${campero ? `<span class="day-tag">🥪 ${escapeHtml(campero.name)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="card-body hidden" id="day-body-${day.id}"></div>
    `;
    host.appendChild(card);
    card.querySelector(".card-title-row").addEventListener("click", () => toggleDayCard(day));
  });

  if (openId && daysCache.some((d) => d.id === openId)) {
    toggleDayCard(daysCache.find((d) => d.id === openId), true);
  }
}

function toggleDayCard(day, forceOpen) {
  const host = document.getElementById("days-list");
  const body = document.getElementById(`day-body-${day.id}`);
  const isOpen = !body.classList.contains("hidden");

  entriesUnsubs.forEach((unsub) => unsub());
  entriesUnsubs.clear();
  document.querySelectorAll(".card-body").forEach((b) => b.classList.add("hidden"));

  if (isOpen && !forceOpen) {
    host.dataset.openId = "";
    return;
  }
  host.dataset.openId = day.id;
  body.classList.remove("hidden");
  mountDayDetail(day, body);
}

function mountDayDetail(day, body) {
  const profile = getProfile();
  body.innerHTML = `
    <div class="comment-list" id="entries-${day.id}"></div>
    <div>
      <label class="field-label">Tu experiencia ese día</label>
      <textarea id="my-entry-${day.id}" placeholder="¿Qué tal fue?"></textarea>
      <button class="btn-primary btn-block" id="save-entry-${day.id}">Guardar</button>
    </div>
  `;

  const entriesHost = body.querySelector(`#entries-${day.id}`);
  const myEntryEl = body.querySelector(`#my-entry-${day.id}`);

  const unsub = onSnapshot(collection(db, "days", day.id, "entries"), (snap) => {
    const entries = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    entriesHost.innerHTML = "";
    if (entries.length === 0) {
      entriesHost.innerHTML = `<div class="muted" style="font-size:0.8rem;">Nadie ha escrito todavía.</div>`;
    }
    entries.forEach((e) => {
      const item = document.createElement("div");
      item.className = "comment-item";
      item.innerHTML = `
        <div class="avatar-sm">${e.photo ? `<img src="${e.photo}" />` : (e.name || "?")[0].toUpperCase()}</div>
        <div class="comment-text-wrap">
          <div class="comment-author">${escapeHtml(e.name || "Anónimo")}</div>
          <div>${escapeHtml(e.text)}</div>
        </div>`;
      entriesHost.appendChild(item);
    });

    const mine = entries.find((e) => e.uid === profile?.uid);
    if (mine && !myEntryEl.dataset.touched) myEntryEl.value = mine.text;
  });
  entriesUnsubs.set(day.id, unsub);

  myEntryEl.addEventListener("input", () => (myEntryEl.dataset.touched = "1"));

  body.querySelector(`#save-entry-${day.id}`).addEventListener("click", async () => {
    if (!profile) return;
    const text = myEntryEl.value.trim();
    if (!text) return;
    await setDoc(doc(db, "days", day.id, "entries", profile.uid), {
      text,
      name: profile.name,
      photo: profile.photo || null,
      updatedAt: serverTimestamp(),
    });
  });
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

function openAddDayModal() {
  const defaultDate = nextTuesdayOrSunday();
  const beachOptions = beachesCache.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join("");
  const camperoOptions = camperosCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  const el = openModal(`
    <h2>Añadir día 📓</h2>
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

    await setDoc(
      doc(db, "days", date),
      { date, beachId, camperoId, updatedAt: serverTimestamp() },
      { merge: true }
    );

    if (text && profile) {
      await setDoc(doc(db, "days", date, "entries", profile.uid), {
        text,
        name: profile.name,
        photo: profile.photo || null,
        updatedAt: serverTimestamp(),
      });
    }
    closeModal();
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
