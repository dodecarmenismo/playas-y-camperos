import {
  db,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "./firebase.js";
import { getProfile } from "./profile.js";
import { avatarInnerHtml } from "./avatar.js";

// Hilo de comentarios reutilizable: cada persona puede escribir tantos como
// quiera. Se guardan en <parentPath>/comments, p. ej. ["movies", id].
// Devuelve { setExtra, destroy }. `setExtra` permite mezclar comentarios
// antiguos (p. ej. los que iban dentro del voto de un campero).
export function mountComments(host, parentPath, { placeholder = "Escribe un comentario…" } = {}) {
  host.innerHTML = `
    <div class="comment-list"></div>
    <div class="comment-compose">
      <textarea placeholder="${escapeHtml(placeholder)}"></textarea>
      <button class="btn-primary">Enviar</button>
    </div>
  `;
  const listEl = host.querySelector(".comment-list");
  const textarea = host.querySelector("textarea");
  const sendBtn = host.querySelector(".comment-compose button");

  let own = [];
  let extra = [];

  function render() {
    const me = getProfile();
    const all = [...own, ...extra].sort((a, b) => a.time - b.time);
    listEl.innerHTML = "";
    if (all.length === 0) {
      listEl.innerHTML = `<div class="muted" style="font-size:0.8rem;">Nadie ha comentado todavía.</div>`;
      return;
    }
    all.forEach((c) => {
      const item = document.createElement("div");
      item.className = "comment-item";
      const canDelete = !c.legacy && me && c.uid === me.uid;
      item.innerHTML = `
        <div class="avatar-sm">${avatarInnerHtml(c.photo, c.name)}</div>
        <div class="comment-text-wrap">
          <div class="comment-author">${escapeHtml(c.name || "Anónimo")}<span class="comment-date"> · ${formatDate(c.time)}</span></div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
        ${canDelete ? `<button class="comment-delete" title="Borrar">✕</button>` : ""}`;
      if (canDelete) {
        item.querySelector(".comment-delete").addEventListener("click", async () => {
          if (!confirm("¿Borrar este comentario?")) return;
          await deleteDoc(doc(db, ...parentPath, "comments", c.id));
        });
      }
      listEl.appendChild(item);
    });
  }

  const unsub = onSnapshot(query(collection(db, ...parentPath, "comments"), orderBy("createdAt", "asc")), (snap) => {
    own = snap.docs.map((d) => {
      const data = d.data();
      const ts = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
      return { id: d.id, uid: data.uid, name: data.name, photo: data.photo, text: data.text, time: ts };
    });
    render();
  });

  sendBtn.addEventListener("click", async () => {
    const profile = getProfile();
    const text = textarea.value.trim();
    if (!profile || !text) return;
    sendBtn.disabled = true;
    try {
      await addDoc(collection(db, ...parentPath, "comments"), {
        uid: profile.uid,
        name: profile.name,
        photo: profile.photo || null,
        text,
        createdAt: serverTimestamp(),
      });
      textarea.value = "";
    } catch (err) {
      console.error("No se pudo enviar el comentario", err);
      alert("No se pudo enviar el comentario. ¿Has actualizado las reglas de Firestore?");
    } finally {
      sendBtn.disabled = false;
    }
  });

  return {
    setExtra(items) {
      extra = items.map((i) => ({ ...i, legacy: true }));
      render();
    },
    destroy: unsub,
  };
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
