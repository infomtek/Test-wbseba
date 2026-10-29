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

  function compact(text) {
    return normalize(text).replace(/\s+/g, "");
  }

  function editDistance(a, b) {
    const dp = Array.from(
      { length: a.length + 1 },
      () => new Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] +
            (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }

    return dp[a.length][b.length];
  }

  function scoreAlias(alias) {
    const a = normalize(alias);
    const aq = compact(alias);
    const cq = compact(query);

    if (a === q || aq === cq) return 100;
    if (a.startsWith(q) || aq.startsWith(cq)) return 85;
    if (a.includes(q) || aq.includes(cq)) return 65;
    if (q.includes(a) && a.length >= 3) return 55;

    // খুব ছোট শব্দে Fuzzy Matching নয়
    if (cq.length < 4) return 0;

    // অতিরিক্ত দীর্ঘ শব্দের সঙ্গে তুলনা নয়
    if (Math.abs(cq.length - aq.length) > 2) return 0;

    const distance = editDistance(cq, aq);

    if (distance === 1) return 45;
    if (cq.length >= 6 && distance === 2) return 30;

    return 0;
  }

  return SERVICE_ALIASES
    .map(service => {
      const aliases = [
        service.name,
        ...(service.aliases || [])
      ];

      const score = Math.max(
        0,
        ...aliases.map(scoreAlias)
      );

      return { ...service, score };
    })
    .filter(service => service.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
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
  const query = input.value.trim();

  // পুরোনো Universal Suggestions সরিয়ে দেওয়া
  document
    .querySelectorAll(".np-universal-suggestion")
    .forEach(el => el.remove());

  if (query.length < 2) return;

  setTimeout(() => {
    const box =
      document.querySelector(".np-suggestion-box");

    if (!box) return;

    const matches = findMatches(query);

    box.querySelectorAll(".np-universal-suggestion")
      .forEach(el => el.remove());

    if (!matches.length) return;

    matches.forEach(service => {
      const item = document.createElement("div");

      item.className =
        "np-suggestion-item np-universal-suggestion";

      item.textContent = service.name;

      item.style.cssText = `
        display: block;
        padding: 12px 14px;
        background: #ffffff;
        color: #1e293b;
        border-bottom: 1px solid #e5e7eb;
        cursor: pointer;
      `;

      item.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        box.style.display = "none";

        openService(service);
      });

      box.appendChild(item);
    });

        box.style.display = "block";
  }, 0);
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
