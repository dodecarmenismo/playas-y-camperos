const overlay = () => document.getElementById("modal-overlay");
const content = () => document.getElementById("modal-content");

export function openModal(innerHTML) {
  content().innerHTML = `<button class="modal-close" id="generic-modal-close">✕</button>${innerHTML}`;
  overlay().classList.remove("hidden");
  document.getElementById("generic-modal-close").addEventListener("click", closeModal);
  overlay().onclick = (e) => {
    if (e.target === overlay()) closeModal();
  };
  return content();
}

export function closeModal() {
  overlay().classList.add("hidden");
  content().innerHTML = "";
}
