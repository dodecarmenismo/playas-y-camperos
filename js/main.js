import { initProfile } from "./profile.js";
import { initMapView } from "./map.js";
import { initCamperosView } from "./camperos.js";
import { initDiaryView } from "./diary.js";

function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      tabButtons.forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".view").forEach((v) => {
        v.classList.toggle("active", v.id === `view-${view}`);
      });
    });
  });
}

async function init() {
  setupTabs();
  initMapView();
  initCamperosView();
  initDiaryView();
  await initProfile();
}

init();
