/* =========================================
   Nagorik Porisheba 2.4
   Universal Smart Search — Prototype
   Existing Service Card Action Only
========================================= */

(function () {
  "use strict";

  if (window.NPUniversalSearch) return;

let SERVICE_ALIASES = [];

async function loadServiceDatabase() {
  try {
    const response = await fetch(
      "/service-search-index.json",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        `Service Database HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid Service Database");
    }

    SERVICE_ALIASES = data;

    console.info(
      "NP Universal Search Database loaded:",
      SERVICE_ALIASES.length,
      "services"
    );

  } catch (error) {
    console.error(
      "Universal Search Database Load Error:",
      error
    );
  }
}
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\u200c\u200d]/g, "")
      .replace(/[.,।\-_/()]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function findMatches(query) {
    const q = normalize(query);

    if (q.length < 2) return [];

    return SERVICE_ALIASES.filter(service =>
      service.aliases.some(alias =>
        normalize(alias).includes(q) ||
        q.includes(normalize(alias))
      )
    );
  }

  function openService(service) {
    const cards = Array.from(
      document.querySelectorAll(".service-card")
    );

    const card = cards.find(card =>
      card.id === service.id &&
      card.closest(".category-group")?.id === service.category
    );

    if (!card) {
      console.warn("Service Card পাওয়া যায়নি:", service.id);
      return;
    }

    card.click();
  }

  async function initialize() {
    const input = document.getElementById("searchInput");

    if (!input || input.dataset.npUniversalBound === "1") {
      return;
    }

    input.dataset.npUniversalBound = "1";
     await loadServiceDatabase();

    input.addEventListener("input", () => {
      const matches = findMatches(input.value);

      console.log(
        "Universal Search Matches:",
        matches.map(item => item.name)
      );
    });

    console.info("NP Universal Search Prototype Ready");
  }

  window.NPUniversalSearch = {
    find: findMatches,
    open: openService
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
