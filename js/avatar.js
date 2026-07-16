// Devuelve el HTML interior de un círculo de avatar: la foto si carga bien,
// o la inicial del nombre si no hay foto o el archivo todavía no existe.
export function avatarInnerHtml(photo, name) {
  const initial = escapeHtml((name || "?")[0].toUpperCase());
  if (!photo) return initial;
  return `<img src="${escapeHtml(photo)}" alt="" onerror="this.outerHTML='${initial}'" />`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
