import { initProfile } from "./profile.js";
import { initMapView } from "./map.js";
import { initCamperosView } from "./camperos.js";
import { initMoviesView } from "./movies.js";
import { initExperience } from "./diary.js";

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
  initMoviesView();
  initExperience();
  await initProfile();
}

init();
