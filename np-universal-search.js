/* =========================================
   Nagorik Porisheba 2.4
   Universal Smart Search — Prototype
   Existing Service Card Action Only
========================================= */

(function () {
  "use strict";

  if (window.NPUniversalSearch) return;

  const SERVICE_ALIASES = [
    {
      id: "service_land_record",
      name: "🌍 জমির পর্চা / রেকর্ড (ROR)",
      category: "groupFarmer",
      aliases: [
        "জমির রেকর্ড",
        "জমি রেকর্ড",
        "জমির পর্চা",
        "জমির খতিয়ান",
        "জমির তথ্য",
        "বাংলারভূমি",
        "বাংলার ভূমি",
        "ভূমি রেকর্ড",
        "জোমির রেকর্ড",
        "জমির রেকট",
        "land record",
        "land records",
        "land recod",
        "land rekord",
        "banglarbhumi",
        "banglar bhumi",
        "jomi record",
        "jomir record",
        "jomi porcha",
        "khatian",
        "porcha",
        "ror"
      ]
    }
  ];

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

  function initialize() {
    const input = document.getElementById("searchInput");

    if (!input || input.dataset.npUniversalBound === "1") {
      return;
    }

    input.dataset.npUniversalBound = "1";

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
