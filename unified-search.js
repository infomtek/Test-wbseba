/* ==========================================================
   নাগরিক পরিষেবা 2.0 — Unified Smart Search
   Bengali + English + Mixed Language
   Emergency | Location | Nearby GPS | Services | AI
   ========================================================== */

(function () {
  "use strict";

  if (window.NPUnifiedSearchLoaded) return;
  window.NPUnifiedSearchLoaded = true;

  const CONFIG = {
    searchInput: "searchInput",
    panelId: "npUnifiedSearchPanel",
    districtFile: "/district_skeleton.json",
    contactSheet:
      "https://opensheet.elk.sh/116flqqFRP8Z1xw6rGG1QKOlGYIydOn1Sn3ffClqtbd0/Emergency",
    aiEndpoint: "/api/gemini",
    maxAiPerDay: 3,
    maxNearbyResults: 8,
    overpassEndpoint:
      "https://overpass-api.de/api/interpreter"
  };

  const PHONE = {
    emergency: "112",
    ambulance: "102",
    fire: "101",
    cyber: "1930",
    women: "1091",
    health: "104",
    electricity: "19121"
  };

  const state = {
    districtData: {},
    approvedContacts: [],
    indexedCards: [],
    currentQuery: "",
    currentIntent: null,
    nearbyCache: new Map(),
    searchTimer: null,
    requestId: 0
  };

  const PLACE_ALIASES = {
    "shalboni": "শালবনী",
    "salboni": "শালবনী",
    "শালবনি": "শালবনী",
    "শালবনী": "শালবনী",
    "ghatal": "ঘাটাল",
    "ঘাটাল": "ঘাটাল",
    "medinipur": "মেদিনীপুর",
    "midnapore": "মেদিনীপুর",
    "মেদিনীপুর": "মেদিনীপুর",
    "kharagpur": "খড়গপুর",
    "খড়গপুর": "খড়গপুর",
    "খড়গপুর": "খড়গপুর",
    "kolkata": "কলকাতা",
    "calcutta": "কলকাতা",
    "কলকাতা": "কলকাতা",
    "howrah": "হাওড়া",
    "হাওড়া": "হাওড়া",
    "হাওড়া": "হাওড়া",
    "arambagh": "আরামবাগ",
    "আরামবাগ": "আরামবাগ",
    "jhargram": "ঝাড়গ্রাম",
    "ঝাড়গ্রাম": "ঝাড়গ্রাম",
    "ঝাড়গ্রাম": "ঝাড়গ্রাম",
    "bankura": "বাঁকুড়া",
    "বাঁকুড়া": "বাঁকুড়া",
    "purulia": "পুরুলিয়া",
    "পুরুলিয়া": "পুরুলিয়া",
    "tamluk": "তমলুক",
    "তমলুক": "তমলুক",
    "contai": "কাঁথি",
    "কাঁথি": "কাঁথি",
    "digha": "দীঘা",
    "দীঘা": "দীঘা",
    "bardhaman": "বর্ধমান",
    "burdwan": "বর্ধমান",
    "বর্ধমান": "বর্ধমান",
    "asansol": "আসানসোল",
    "আসানসোল": "আসানসোল",
    "durgapur": "দুর্গাপুর",
    "দুর্গাপুর": "দুর্গাপুর",
    "siliguri": "শিলিগুড়ি",
    "শিলিগুড়ি": "শিলিগুড়ি"
  };

  const FACILITIES = {
    hospital: {
      label: "হাসপাতাল",
      aliases: [
        "hospital", "hospitals", "হাসপাতাল",
        "health centre", "health center",
        "স্বাস্থ্যকেন্দ্র", "স্বাস্থ্য কেন্দ্র",
        "medical college", "মেডিকেল কলেজ",
        "চিকিৎসাকেন্দ্র", "চিকিৎসা কেন্দ্র"
      ],
      osm: [
        'node["amenity"="hospital"]',
        'way["amenity"="hospital"]',
        'node["amenity"="clinic"]',
        'way["amenity"="clinic"]'
      ]
    },

    police: {
      label: "থানা",
      aliases: [
        "police", "police station", "thana",
        "থানা", "পুলিশ", "পুলিশ স্টেশন"
      ],
      osm: [
        'node["amenity"="police"]',
        'way["amenity"="police"]'
      ]
    },

    fire: {
      label: "দমকল কেন্দ্র",
      aliases: [
        "fire station", "fire brigade",
        "দমকল", "ফায়ার স্টেশন", "ফায়ার স্টেশন",
        "অগ্নিনির্বাপণ কেন্দ্র"
      ],
      osm: [
        'node["amenity"="fire_station"]',
        'way["amenity"="fire_station"]'
      ]
    },

    forest: {
      label: "বনদপ্তর",
      aliases: [
        "forest", "forest office",
        "forest department", "wildlife office",
        "বনদপ্তর", "বন বিভাগ", "বন অফিস",
        "বনকর্মী", "রেঞ্জ অফিস", "রেঞ্জার"
      ],
      osm: [
        'node["office"="forestry"]',
        'way["office"="forestry"]',
        'node["office"="government"]["government"="forestry"]',
        'way["office"="government"]["government"="forestry"]'
      ]
    },

    blood: {
      label: "ব্লাড ব্যাংক",
      aliases: [
        "blood bank", "blood centre",
        "ব্লাড ব্যাংক", "রক্ত ব্যাংক",
        "রক্তকেন্দ্র", "রক্ত কেন্দ্র"
      ],
      osm: [
        'node["healthcare"="blood_donation"]',
        'way["healthcare"="blood_donation"]',
        'node["amenity"="blood_bank"]',
        'way["amenity"="blood_bank"]'
      ]
    }
  };

  const SERVICE_RULES = [
    {
      words: ["pm kisan", "pmkisan", "পিএম কিষান", "পিএম কিসান"],
      ids: ["service_pm_kisan"],
      title: "PM-Kisan",
      url: "https://pmkisan.gov.in/BeneficiaryStatus_New.aspx"
    },
         {
      words: [
        "dbt",
        "dbt link",
        "dbt status",
        "ডিবিটি",
        "ডি বি টি",
        "ডিবিটি লিংক",
        "ডিভিডি লিংক",
        "ডিভিডি লিং",
        "আধার ডিবিটি",
        "aadhaar dbt",
        "aadhar dbt",
        "npcI mapping",
        "npcI link",
        "এনপিসিআই",
        "ব্যাংক আধার লিংক",
        "ব্যাঙ্ক আধার লিংক",
        "আধার সিডিং"
      ],
      ids: ["service_dbt_change"],
      title: "আধার DBT / ব্যাংক লিংক",
      url: "https://myaadhaar.uidai.gov.in/"
    },
    {
      words: ["কৃষক বন্ধু", "krishak bandhu"],
      ids: ["service_krishak_old", "service_krishak_new"],
      title: "কৃষক বন্ধু",
      url: "https://krishakbandhu.wb.gov.in/"
    },
    {
      words: ["আধার", "আধার কার্ড", "aadhaar", "aadhar"],
      ids: ["service_aadhaar_card", "service_pan_aadhaar"],
      title: "আধার পরিষেবা",
      url: "https://myaadhaar.uidai.gov.in/"
    },
    {
      words: ["প্যান আধার", "pan aadhaar", "pan aadhar"],
      ids: ["service_pan_aadhaar"],
      title: "PAN–Aadhaar",
      url: "https://eportal.incometax.gov.in/iec/foservices/#/pre-login/link-aadhaar-status"
    },
    {
      words: ["রেশন", "ration"],
      ids: ["service_ration", "service_ration_pvc"],
      title: "রেশন কার্ড",
      url: "https://wbpds.wb.gov.in/Checkonorc_Status.aspx"
    },
    {
      words: ["ভোটার", "voter", "epic"],
      ids: [
        "service_voter_search",
        "service_voter_update",
        "service_sir_2002",
        "service_sir_2026"
      ],
      title: "ভোটার পরিষেবা",
      url: "https://voters.eci.gov.in/"
    },
    {
      words: ["জন্ম সার্টিফিকেট", "birth certificate", "জন্ম নিবন্ধন"],
      ids: ["service_birth_verify", "service_birth_download"],
      title: "জন্ম শংসাপত্র",
      url: "https://janma-mrityutathya.wb.gov.in/"
    },
    {
      words: ["কাস্ট সার্টিফিকেট", "caste certificate", "জাতিগত শংসাপত্র", "obc"],
      ids: ["service_caste_verify", "service_obc_verify"],
      title: "জাতিগত শংসাপত্র",
      url: "https://castcertificatewb.gov.in/searchappl"
    },
    {
      words: ["স্বাস্থ্যসাথী", "স্বাস্থ্য সাথী", "swasthya sathi"],
      ids: ["service_swasthya_sathi"],
      title: "স্বাস্থ্যসাথী",
      url: "https://ssai.swasthyasathi.gov.in/OnlinePublicInfoHub/OnlineCardVerificationIndex"
    },
    {
      words: ["আয়ুষ্মান", "আয়ুষ্মান", "ayushman"],
      ids: ["service_ayushman"],
      title: "আয়ুষ্মান পরিষেবা",
      url: "https://beneficiary.nha.gov.in/"
    },
    {
      words: ["জমির রেকর্ড", "banglarbhumi", "বাংলার ভূমি", "খতিয়ান", "খতিয়ান"],
      ids: ["service_land_record"],
      title: "জমির রেকর্ড",
      url: "https://banglarbhumi.gov.in/BanglarBhumi/Home.action"
    },
    {
      words: [
  "বিদ্যুৎ বিল",
  "কারেন্ট বিল",
  "কারেন্টের বিল",
  "ইলেকট্রিক বিল",
  "বিজলি বিল",
  "electric bill",
  "electricity bill",
  "wbsedcl bill",
  "current bill"
],
      ids: [
        "service_bill_pay",
        "service_bill_receipt",
        "service_bill_view"
      ],
      title: "বিদ্যুৎ বিল",
      url: "https://portal.wbsedcl.in/onlinepay/OnlineBillPay.jsp"
    },
    {
      words: ["ড্রাইভিং লাইসেন্স", "driving licence", "driving license", "dl status"],
      ids: ["service_dl_status"],
      title: "ড্রাইভিং লাইসেন্স",
      url: "https://parivahan.gov.in/"
    },
    {
      words: ["চালান", "challan", "traffic fine"],
      ids: ["service_traffic_challan"],
      title: "ট্রাফিক চালান",
      url: "https://echallan.parivahan.gov.in/"
    },
    {
      words: ["ব্লাড স্টক", "blood stock", "রক্তের স্টক"],
      ids: ["service_blood_bank"],
      title: "রক্তের স্টক",
      url: "https://eraktkosh.mohfw.gov.in/"
    }
  ];

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .replace(/[.,!?;:()[\]{}।'"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function contains(text, words) {
    return words.some(word => text.includes(normalize(word)));
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), location.origin);
      if (!["https:", "http:"].includes(url.protocol)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function cleanPhone(value) {
    const raw = String(value || "").trim();

    if (!/^[+\d\s\-()]{3,22}$/.test(raw)) return "";

    const digits = raw.replace(/[^\d+]/g, "");

    return /^\+?\d{3,15}$/.test(digits) ? digits : "";
  }

  function mapsSearch(query) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(query)
    );
  }

  function mapsDirections(lat, lon) {
    return (
      "https://www.google.com/maps/dir/?api=1&destination=" +
      encodeURIComponent(`${lat},${lon}`)
    );
  }

  function makeLink(label, url, primary = false) {
    const a = element(
      "a",
      primary ? "np-u-btn np-u-primary" : "np-u-btn",
      label
    );

    const valid = safeUrl(url);

    if (!valid) return element("span", "np-u-note", label);

    a.href = valid;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    return a;
  }

  function makeCall(label, phone) {
    const number = cleanPhone(phone);
    if (!number) return null;

    const a = element("a", "np-u-btn np-u-call", `📞 ${label}: ${number}`);
    a.href = `tel:${number}`;

    return a;
  }

  function addActions(parent, actions) {
    const row = element("div", "np-u-actions");

    actions.filter(Boolean).forEach(action => row.appendChild(action));

    if (row.children.length) parent.appendChild(row);
  }

  function addText(parent, text) {
    if (!text) return;

    parent.appendChild(element("p", "np-u-text", text));
  }

  function createCard(title, description, urgent = false) {
    const card = element(
      "section",
      urgent ? "np-u-card np-u-urgent" : "np-u-card"
    );

    card.appendChild(element("h3", "np-u-title", title));
    addText(card, description);

    return card;
  }

  function clearPanel() {
    const panel = document.getElementById(CONFIG.panelId);

    if (panel) {
      panel.replaceChildren();
      panel.hidden = true;
    }
  }

  function showCards(cards) {
    const panel = document.getElementById(CONFIG.panelId);
    if (!panel) return;

    panel.replaceChildren();

    cards.filter(Boolean).forEach(card => panel.appendChild(card));

    panel.hidden = !panel.children.length;
  }

  function setupPanel() {
    if (document.getElementById(CONFIG.panelId)) return;

    const input = document.getElementById(CONFIG.searchInput);
    if (!input) return;

    const panel = element("div", "np-unified-panel");
    panel.id = CONFIG.panelId;
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");

    const anchor = input.closest(".search-container, .search-box") || input.parentElement;

    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("afterend", panel);
    } else {
      input.insertAdjacentElement("afterend", panel);
    }
  }

  function injectStyles() {
    if (document.getElementById("npUnifiedStyles")) return;

    const style = element("style");
    style.id = "npUnifiedStyles";

    style.textContent = `
      .np-unified-panel {
        margin: 12px 0 20px;
        width: 100%;
        display: grid;
        gap: 12px;
        position: relative;
        z-index: 5;
      }

      .np-unified-panel[hidden] {
        display: none !important;
      }

      .np-u-card {
        background: var(--card-bg, #ffffff);
        color: var(--text-color, #17233d);
        border: 1px solid rgba(99, 102, 241, .18);
        border-radius: 17px;
        padding: 16px;
        box-shadow: 0 7px 24px rgba(25, 49, 105, .09);
        overflow-wrap: anywhere;
      }

      .np-u-urgent {
        border-left: 5px solid #ed5555;
        background: linear-gradient(135deg, #fff8f8, #ffffff);
        color: #263145;
      }

      .np-u-title {
        font-size: 17px;
        line-height: 1.5;
        margin: 0 0 8px;
        color: inherit;
      }

      .np-u-text {
        font-size: 14px;
        line-height: 1.8;
        margin: 6px 0 10px;
        color: inherit;
      }

      .np-u-note {
        display: block;
        font-size: 12px;
        line-height: 1.7;
        opacity: .8;
        margin-top: 8px;
      }

      .np-u-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 12px;
      }

      .np-u-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-height: 41px;
        padding: 9px 13px;
        border: 1px solid #c7d2fe;
        background: #f4f6ff;
        color: #3730a3 !important;
        border-radius: 11px;
        text-decoration: none !important;
        cursor: pointer;
        font-size: 13px;
        font-weight: 650;
        font-family: inherit;
        line-height: 1.4;
      }

      .np-u-primary {
        background: #4f46e5;
        border-color: #4f46e5;
        color: #fff !important;
      }

      .np-u-call {
        background: #e9f9ed;
        border-color: #86d5a0;
        color: #146c35 !important;
      }

      .np-u-result {
        padding: 11px 0;
        border-top: 1px solid rgba(120, 130, 160, .2);
      }

      .np-u-result:first-of-type {
        border-top: 0;
      }

      .np-u-result strong {
        display: block;
        line-height: 1.5;
        margin-bottom: 4px;
      }

      .np-u-loading {
        opacity: .8;
      }

      .np-u-btn:focus-visible {
        outline: 3px solid #f59e0b;
        outline-offset: 2px;
      }

      @media (max-width: 480px) {
        .np-u-card { padding: 14px; }
        .np-u-btn { flex: 1 1 auto; }
      }

      body.dark-mode .np-u-card,
      body.dark .np-u-card,
      [data-theme="dark"] .np-u-card {
        background: #202942;
        color: #f0f4ff;
        border-color: #404b68;
      }

      body.dark-mode .np-u-urgent,
      body.dark .np-u-urgent,
      [data-theme="dark"] .np-u-urgent {
        background: #372732;
      }
    `;

    document.head.appendChild(style);
  }

  /* ---------------- DATA LOADING ---------------- */

  async function loadDistrictData() {
    try {
      const response = await fetch(CONFIG.districtFile);

      if (!response.ok) return;

      const data = await response.json();

      if (data && typeof data === "object") {
        state.districtData = data;
      }
    } catch {
      // Directory can be unavailable; Maps remains usable.
    }
  }

  async function loadApprovedContacts() {
    try {
      const response = await fetch(CONFIG.contactSheet);

      if (!response.ok) return;

      const rows = await response.json();

      if (!Array.isArray(rows)) return;

      state.approvedContacts = rows.filter(row => {
        return normalize(row.Status || row.status) === "approved";
      });
    } catch {
      // Optional supplementary contacts.
    }
  }

  function getDirectoryData() {
    try {
      if (
        typeof emergencyDirectoryData !== "undefined" &&
        emergencyDirectoryData &&
        typeof emergencyDirectoryData === "object"
      ) {
        return emergencyDirectoryData;
      }
    } catch {
      // Ignore inaccessible global.
    }

    return state.districtData;
  }

  function flattenDirectory() {
    const result = [];
    const data = getDirectoryData();

    Object.entries(data || {}).forEach(([district, subdivisions]) => {
      if (!subdivisions || typeof subdivisions !== "object") return;

      Object.entries(subdivisions).forEach(([subdivision, entries]) => {
        if (!Array.isArray(entries)) return;

        entries.forEach(item => {
          if (!item || typeof item !== "object") return;

          result.push({
            district,
            subdivision,
            name: String(item.name || ""),
            type: String(item.type || ""),
            sub: String(item.sub || ""),
            phone: String(item.phone || item.central_phone || ""),
            opdLink: safeUrl(item.opd_link || "")
          });
        });
      });
    });

    return result;
  }

  function getSelectedArea() {
    const districtSelect = document.getElementById("wbDistrictSelect");
    const subSelect = document.getElementById("wbSubDivSelect");

    return {
      district: districtSelect?.value || "",
      subdivision: subSelect?.value || ""
    };
  }

  function getApprovedNumbers(area, facility) {
    const results = [];

    state.approvedContacts.forEach(row => {
      const subdivision = String(
        row.SubDiv || row.subdiv || row.Subdivision || ""
      );

      const district = String(row.District || row.district || "");
      const role = String(row.Role || row.role || "");
      const phone = cleanPhone(row.Phone || row.phone || "");

      if (!phone) return;

      const matchesArea =
        !area ||
        normalize(subdivision).includes(normalize(area)) ||
        normalize(district).includes(normalize(area));

      if (!matchesArea) return;

      if (!facilityMatches(role, facility)) return;

      results.push({
        name: role || "জরুরি যোগাযোগ",
        area: subdivision || district,
        phone,
        source: "অনুমোদিত যোগাযোগ তালিকা"
      });
    });

    return results.slice(0, 6);
  }

  function facilityMatches(text, facility) {
    const value = normalize(text);

    if (!value) return false;

    const words = FACILITIES[facility]?.aliases || [];

    if (contains(value, words)) return true;

    const fallback = {
      hospital: ["health", "medical", "চিকিৎসা", "স্বাস্থ্য", "হাসপাতাল"],
      police: ["পুলিশ", "থানা", "police"],
      fire: ["fire", "দমকল"],
      forest: ["forest", "বন", "wildlife"],
      blood: ["blood", "রক্ত", "ব্লাড"]
    };

    return contains(value, fallback[facility] || []);
  }

  function findDirectoryMatches(area, facility) {
    const list = flattenDirectory();

    return list
      .filter(item => {
        const location = normalize(
          `${item.district} ${item.subdivision} ${item.name} ${item.sub}`
        );

        const category = `${item.type} ${item.name} ${item.sub}`;

        const areaMatches =
          !area || location.includes(normalize(area));

        return areaMatches && facilityMatches(category, facility);
      })
      .slice(0, 8);
  }

  /* ---------------- INTENT DETECTION ---------------- */

  function detectEmergency(query) {
    const q = normalize(query);

    const snakeBite =
      contains(q, [
        "সাপে কামড়", "সাপে কামড়", "সাপ কামড়",
        "সাপ কামড়", "snake bite", "snakebite",
        "সাপের ছোবল", "সাপে কেটেছে"
      ]);

    if (snakeBite) return "snakebite";

    if (
      contains(q, [
        "সাপ বেরিয়েছে", "সাপ বেরিয়েছে",
        "সাপ ঢুকেছে", "সাপ দেখা",
        "সাপ এসেছে", "snake in house",
        "snake found", "snake rescue",
        "snake spotted"
      ]) ||
      /(^|\s)সাপ(\s|$)/.test(q)
    ) {
      return "snake";
    }

    if (
      contains(q, [
        "হনুমান কামড়", "হনুমান কামড়",
        "monkey bite", "বানর কামড়", "বানর কামড়"
      ])
    ) {
      return "monkeybite";
    }

    if (
      contains(q, [
        "পাগলা হনুমান", "হনুমান তাড়া",
        "হনুমান তাড়া", "aggressive monkey",
        "monkey attack", "বানর আক্রমণ",
        "হনুমান আক্রমণ"
      ])
    ) {
      return "monkey";
    }

    if (
      contains(q, [
        "মরা বন্যপ্রাণী", "মৃত বন্যপ্রাণী",
        "আহত বন্যপ্রাণী", "আহত পশু",
        "dead wildlife", "injured wildlife",
        "dead wild animal", "injured wild animal"
      ])
    ) {
      return "wildlife";
    }

    if (
      contains(q, [
        "রোড এক্সিডেন্ট", "road accident",
        "car accident", "bike accident",
        "দুর্ঘটনা", "accident", "গাড়ি ধাক্কা",
        "গাড়ি ধাক্কা", "রক্তপাত", "bleeding"
      ])
    ) {
      return "accident";
    }

    if (
      contains(q, [
        "হার্ট অ্যাটাক", "heart attack",
        "বুকে তীব্র ব্যথা", "chest pain",
        "স্ট্রোক", "stroke", "অজ্ঞান",
        "unconscious"
      ])
    ) {
      return "medical";
    }

    if (
      contains(q, [
        "কারেন্ট লেগেছে", "বিদ্যুৎস্পৃষ্ট",
        "electric shock", "electrocution",
        "তড়িৎ স্পৃষ্ট"
      ])
    ) {
      return "electric";
    }

    if (
      contains(q, [
        "আগুন লেগেছে", "আগুন ধরেছে",
        "বাড়িতে আগুন", "বাড়িতে আগুন",
        "fire broke out", "house fire",
        "fire accident"
      ])
    ) {
      return "fire";
    }

    if (
      contains(q, [
        "সাইবার প্রতারণা", "অনলাইন প্রতারণা",
        "cyber fraud", "online fraud",
        "টাকা কেটে নিয়েছে", "টাকা কেটে নিয়েছে",
        "upi fraud", "otp scam", "ব্যাংক প্রতারণা"
      ])
    ) {
      return "cyber";
    }

    if (
      contains(q, [
        "মহিলা নির্যাতন", "নারী নির্যাতন",
        "women safety", "domestic violence"
      ])
    ) {
      return "women";
    }

    return null;
  }

  function detectFacility(query) {
    for (const [key, data] of Object.entries(FACILITIES)) {
      if (contains(query, data.aliases)) return key;
    }

    return null;
  }

  function detectNearby(query) {
    return contains(query, [
      "কাছাকাছি", "আমার কাছে", "আমার আশেপাশে",
      "আশেপাশে", "নিকটবর্তী", "near me",
      "nearby", "nearest", "around me",
      "close to me"
    ]);
  }

  function detectPlace(query) {
    const q = normalize(query);

    const aliases = Object.entries(PLACE_ALIASES)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [alias, properName] of aliases) {
      if (q.includes(normalize(alias))) return properName;
    }

    const data = getDirectoryData();

    const knownPlaces = [];

    Object.entries(data || {}).forEach(([district, subdivisions]) => {
      knownPlaces.push(district);

      if (subdivisions && typeof subdivisions === "object") {
        knownPlaces.push(...Object.keys(subdivisions));
      }
    });

    knownPlaces.sort((a, b) => b.length - a.length);

    return knownPlaces.find(place =>
      q.includes(normalize(place))
    ) || "";
  }

  function detectService(query) {
    /* ==============================================
   SMART SERVICE NAME RECOGNITION
   Bengali spelling + common pronunciation
   ============================================== */

const NP_SERVICE_ALIASES = [
  {
    id: "service_dbt_change",
    words: [
      "ডিভিডি", "ডিবিটি", "ডি বি টি",
      "dbt", "npcI", "এনপিসিআই",
      "আধার সিডিং"
    ]
  },
  {
    id: "service_ration",
    words: [
      "রেশন", "রেসন", "রেশন কাড",
      "রেসন কার্ড", "ration", "reshon"
    ]
  },
  {
    id: "service_pm_kisan",
    words: [
      "পিএম কিসান", "পিএম কিষান",
      "কিষান স্টেটাস", "কিসান স্ট্যাটাস",
      "pm kisan", "pmkisan"
    ]
  },
  {
    id: "service_krishak_old",
    words: [
      "কৃষক বন্ধু স্ট্যাটাস",
      "কৃষক বন্দু স্ট্যাটাস",
      "krishak bandhu status"
    ]
  },
  {
    id: "service_birth_verify",
    words: [
      "জন্ম সার্টিফিকেট যাচাই",
      "জন্ম সার্টিফকেট",
      "বার্থ সার্টিফিকেট",
      "birth certificate verify"
    ]
  },
  {
    id: "service_voter_search",
    words: [
      "ভোটার কার্ড", "ভটার কার্ড",
      "ভোটার কাড", "voter card",
      "ভোটার লিস্ট"
    ]
  },
  {
    id: "service_aadhaar_card",
    words: [
      "আধার কার্ড", "আধার কাড",
      "আধার কাট", "aadhar card",
      "aadhaar card"
    ]
  },
  {
    id: "service_land_record",
    words: [
      "জমির রেকর্ড", "জমির খতিয়ান",
      "জমির খতিয়ান", "বাংলার ভূমি",
      "banglarbhumi"
    ]
  },
  {
    id: "service_swasthya_sathi",
    words: [
      "স্বাস্থ্য সাথী", "স্বাস্থ্যসাথী",
      "সাস্থ্য সাথী", "sasthya sathi",
      "swasthya sathi"
    ]
  },
  {
    id: "service_bill_pay",
    words: [
      "বিদ্যুৎ বিল", "কারেন্ট বিল",
      "ইলেকট্রিক বিল", "electric bill",
      "electricity bill"
    ]
  }
];

function detectSmartService(query) {
  const q = normalize(query);

  if (!q || q.length < 3) return null;

  for (const item of NP_SERVICE_ALIASES) {
    const matched = item.words.some(word =>
      q.includes(normalize(word))
    );

    if (!matched) continue;

    const originalRule = SERVICE_RULES.find(rule =>
      rule.ids.includes(item.id)
    );

    if (originalRule) {
      return originalRule;
    }

    const card = document.getElementById(item.id);

    let url = "";

    if (card) {
      const link = card.matches("a[href]")
        ? card
        : card.querySelector("a[href]");

      if (link) url = safeUrl(link.href);
    }

    return {
      words: item.words,
      ids: [item.id],
      title: card?.querySelector(".card-title")
        ?.textContent?.trim() || "সরকারি পরিষেবা",
      url: url
    };
  }

  return null;
}
     const q = normalize(query);

    const matches = SERVICE_RULES.filter(rule =>
      contains(q, rule.words)
    );

    if (!matches.length) return null;

    // Specific keywords get preference over generic matches.
    matches.sort((a, b) => {
      const aLength = Math.max(
        ...a.words.filter(w => q.includes(normalize(w))).map(w => w.length)
      );

      const bLength = Math.max(
        ...b.words.filter(w => q.includes(normalize(w))).map(w => w.length)
      );

      return bLength - aLength;
    });

    return matches[0];
  }

  function detectIntent(rawQuery) {
    const query = normalize(rawQuery);

    if (!query) return { kind: "empty" };

    const emergency = detectEmergency(query);

    if (emergency) {
      return { kind: "emergency", emergency };
    }

    const facility = detectFacility(query);

    if (facility) {
      return {
        kind: detectNearby(query) ? "nearby" : "facility",
        facility,
        place: detectPlace(query)
      };
    }

    const service = detectService(query) || detectSmartService(query);

    if (service) {
      return { kind: "service", service };
    }

    return { kind: "general" };
  }

  /* ---------------- EMERGENCY GUIDANCE ---------------- */

  const EMERGENCY_GUIDES = {
    accident: {
      title: "🚨 দুর্ঘটনা — দ্রুত সাহায্য নিন",
      text:
        "প্রথমে নিজের নিরাপত্তা নিশ্চিত করুন। আহত ব্যক্তিকে অপ্রয়োজনে নড়াবেন না। প্রচুর রক্তপাত হলে পরিষ্কার কাপড় দিয়ে সরাসরি চাপ দিন। জরুরি সাহায্য ডাকুন।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance]
      ],
      facility: "hospital"
    },

    medical: {
      title: "🚨 জরুরি চিকিৎসা প্রয়োজন",
      text:
        "হার্ট অ্যাটাক বা স্ট্রোকের লক্ষণ হলে অপেক্ষা করবেন না। দ্রুত জরুরি পরিষেবায় ফোন করুন। আক্রান্ত ব্যক্তিকে নিরাপদ অবস্থায় রাখুন; অচেতন ও স্বাভাবিক শ্বাস না থাকলে জরুরি অপারেটরের নির্দেশ মেনে CPR শুরু করুন।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance]
      ],
      facility: "hospital"
    },

    snakebite: {
      title: "🐍 সাপে কামড়েছে — জরুরি চিকিৎসা নিন",
      text:
        "রোগীকে শান্ত ও যতটা সম্ভব স্থির রাখুন। কামড়ানো অঙ্গের নড়াচড়া কমান। ক্ষত কাটবেন না, বিষ চুষবেন না, শক্ত করে বাঁধবেন না এবং ঝাড়ফুঁকে সময় নষ্ট করবেন না। দ্রুত হাসপাতালে যান। সাপ ধরার চেষ্টা করবেন না।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance]
      ],
      facility: "hospital"
    },

    snake: {
      title: "🐍 সাপ দেখা গেছে — নিরাপদ দূরত্ব বজায় রাখুন",
      text:
        "সাপের কাছে যাবেন না, ধরবেন বা মারবেন না। শিশু ও পোষ্যদের দূরে রাখুন। সম্ভব হলে ওই জায়গায় প্রবেশ বন্ধ করুন এবং স্থানীয় বনদপ্তর বা প্রশিক্ষিত উদ্ধারকারীর সাহায্য নিন। কাউকে কামড়ালে অবিলম্বে হাসপাতালে যান।",
      numbers: [],
      facility: "forest"
    },

    monkey: {
      title: "🐒 আক্রমণাত্মক হনুমান — নিরাপদ থাকুন",
      text:
        "হনুমানকে খাবার দেবেন না, উত্ত্যক্ত করবেন না বা চোখে চোখ রেখে চ্যালেঞ্জ করবেন না। শিশুদের নিরাপদ ঘরে রাখুন। স্থানীয় বনদপ্তরকে খবর দিন। কামড় বা আঁচড় লাগলে চিকিৎসা নিন।",
      numbers: [],
      facility: "forest"
    },

    monkeybite: {
      title: "🐒 হনুমান/বানরের কামড় — চিকিৎসা নিন",
      text:
        "ক্ষতস্থান সাবান ও প্রবাহমান জলে প্রায় ১৫ মিনিট ধুয়ে নিন। দ্রুত চিকিৎসকের কাছে যান; র‍্যাবিস ও টিটেনাস প্রতিরোধের প্রয়োজন হতে পারে। প্রাণীটি ধরতে যাবেন না।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance]
      ],
      facility: "hospital"
    },

    wildlife: {
      title: "🌳 আহত বা মৃত বন্যপ্রাণী পাওয়া গেছে",
      text:
        "প্রাণীটিকে স্পর্শ, খাওয়ানো, স্থানান্তর বা নিজে উদ্ধার করার চেষ্টা করবেন না। মানুষ ও পোষ্যদের দূরে রাখুন। অবস্থানটি মনে রাখুন এবং স্থানীয় বনদপ্তরকে জানান।",
      numbers: [],
      facility: "forest"
    },

    electric: {
      title: "⚡ বিদ্যুৎস্পৃষ্ট — সাবধান",
      text:
        "বিদ্যুৎ সংযোগ বন্ধ না করে আক্রান্ত ব্যক্তিকে স্পর্শ করবেন না। নিরাপদ দূরত্ব থেকে বিদ্যুৎ বিচ্ছিন্ন করার ব্যবস্থা করুন। জরুরি পরিষেবায় ফোন করুন।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance],
        ["বিদ্যুৎ অভিযোগ", PHONE.electricity]
      ],
      facility: "hospital"
    },

    fire: {
      title: "🔥 আগুন লেগেছে — দ্রুত নিরাপদ স্থানে যান",
      text:
        "আগুনের স্থান থেকে বেরিয়ে নিরাপদ দূরত্বে যান। ধোঁয়া থাকলে নিচু হয়ে চলুন। লিফট ব্যবহার করবেন না। নিজে আগুন নেভাতে গিয়ে ঝুঁকি নেবেন না।",
      numbers: [
        ["দমকল", PHONE.fire],
        ["জরুরি সাহায্য", PHONE.emergency]
      ],
      facility: "fire"
    },

    cyber: {
      title: "🔐 সাইবার প্রতারণা — দ্রুত রিপোর্ট করুন",
      text:
        "টাকা প্রতারণার শিকার হলে অবিলম্বে ১৯৩০ নম্বরে ফোন করুন। ব্যাংক বা পেমেন্ট পরিষেবাকে জানান। OTP, PIN বা পাসওয়ার্ড কাউকে দেবেন না। প্রমাণ ও লেনদেনের তথ্য সংরক্ষণ করুন।",
      numbers: [
        ["সাইবার হেল্পলাইন", PHONE.cyber]
      ],
      url: "https://cybercrime.gov.in/"
    },

    women: {
      title: "🛡️ মহিলাদের নিরাপত্তা",
      text:
        "তাৎক্ষণিক বিপদে নিরাপদ স্থানে যাওয়ার চেষ্টা করুন এবং জরুরি সাহায্য নিন। নিজের অবস্থান বিশ্বস্ত কাউকে জানান।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["মহিলা হেল্পলাইন", PHONE.women]
      ]
    }
  };

  function renderEmergency(type) {
    const guide = EMERGENCY_GUIDES[type];

    if (!guide) return;

    const card = createCard(guide.title, guide.text, true);

    addActions(
      card,
      (guide.numbers || []).map(([label, phone]) =>
        makeCall(label, phone)
      )
    );

    if (guide.url) {
      addActions(card, [
        makeLink("🌐 অভিযোগ জানান", guide.url, true)
      ]);
    }

    if (guide.facility) {
      const area = getSelectedArea();

      const where = area.subdivision || area.district || "West Bengal";

      addActions(card, [
        makeLink(
          `🗺️ ${FACILITIES[guide.facility].label} খুঁজুন`,
          mapsSearch(`${FACILITIES[guide.facility].label} ${where}`)
        )
      ]);

      const nearbyButton = element(
        "button",
        "np-u-btn",
        `📍 কাছাকাছি ${FACILITIES[guide.facility].label}`
      );

      nearbyButton.type = "button";

      nearbyButton.addEventListener("click", () => {
        findNearby(guide.facility);
      });

      addActions(card, [nearbyButton]);

      const localContacts = findDirectoryMatches(
        area.subdivision || area.district,
        guide.facility
      );

      localContacts.slice(0, 3).forEach(item => {
        renderDirectoryRow(card, item);
      });
    }

    showCards([card]);
  }

  /* ---------------- LOCATION SEARCH ---------------- */

  function renderDirectoryRow(parent, item) {
    const row = element("div", "np-u-result");

    row.appendChild(
      element("strong", "", item.name || item.sub || "স্থানীয় পরিষেবা")
    );

    const area = [item.subdivision, item.district]
      .filter(Boolean)
      .join(", ");

    if (area) addText(row, area);

    const actions = [];

    if (item.phone) {
      actions.push(makeCall("যোগাযোগ", item.phone));
    }

    if (item.opdLink) {
      actions.push(makeLink("🌐 OPD / অফিস লিংক", item.opdLink));
    }

    actions.push(
      makeLink(
        "🗺️ মানচিত্র",
        mapsSearch(`${item.name} ${area} West Bengal`)
      )
    );

    addActions(row, actions);

    parent.appendChild(row);
  }

  function renderFacility(intent, originalQuery) {
    const facility = intent.facility;
    const label = FACILITIES[facility].label;
    const selected = getSelectedArea();

    const area =
      intent.place ||
      selected.subdivision ||
      selected.district ||
      "";

    const searchLocation = area || "West Bengal";

    const card = createCard(
      `📍 ${area ? area + " — " : ""}${label}`,
      "নিচে প্রাসঙ্গিক যোগাযোগ ও মানচিত্রের বিকল্প দেওয়া হলো। নির্দিষ্ট নম্বর না থাকলে মানচিত্রে প্রতিষ্ঠানের বর্তমান তথ্য যাচাই করুন।"
    );

    const matching = findDirectoryMatches(area, facility);

    matching.forEach(item => renderDirectoryRow(card, item));

    const approved = getApprovedNumbers(area, facility);

    approved.forEach(item => {
      const row = element("div", "np-u-result");

      row.appendChild(element("strong", "", item.name));

      addText(
        row,
        `${item.area} — ${item.source}`
      );

      addActions(row, [makeCall("যোগাযোগ", item.phone)]);

      card.appendChild(row);
    });

    if (!matching.length && !approved.length) {
      addText(
        card,
        `এই মুহূর্তে ${searchLocation} এলাকার নির্দিষ্ট ${label}-এর ফোন নম্বর নিশ্চিত করা যাচ্ছে না। মানচিত্রে নাম, ঠিকানা ও যোগাযোগ যাচাই করুন।`
      );
    }

    const mapQuery = intent.place
      ? `${intent.place} ${label} West Bengal`
      : `${originalQuery} West Bengal`;

    const nearby = element(
      "button",
      "np-u-btn",
      `📍 আমার কাছাকাছি ${label}`
    );

    nearby.type = "button";

    nearby.addEventListener("click", () => {
      findNearby(facility);
    });

    addActions(card, [
      makeLink("🗺️ Google Maps-এ খুঁজুন", mapsSearch(mapQuery), true),
      nearby
    ]);

    if (facility === "hospital") {
      addActions(card, [
        makeCall("অ্যাম্বুলেন্স", PHONE.ambulance),
        makeCall("জরুরি সাহায্য", PHONE.emergency)
      ]);
    }

    if (facility === "police") {
      addActions(card, [
        makeCall("জরুরি সাহায্য", PHONE.emergency)
      ]);
    }

    if (facility === "fire") {
      addActions(card, [
        makeCall("দমকল", PHONE.fire)
      ]);
    }

    if (facility === "blood") {
      addActions(card, [
        makeLink(
          "🩸 রক্তের স্টক দেখুন",
          "https://eraktkosh.mohfw.gov.in/"
        )
      ]);
    }

    showCards([card]);
  }

  /* ---------------- GPS + OPENSTREETMAP ---------------- */

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation unavailable"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => resolve(position.coords),
        reject,
        {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 120000
        }
      );
    });
  }

  function overpassQuery(lat, lon, facility) {
    const selectors = FACILITIES[facility]?.osm || [];

    const radius = 8000;

    const lines = selectors.map(selector => {
      const match = selector.match(/^(node|way)(.*)$/);

      if (!match) return "";

      return `${match[1]}${match[2]}(around:${radius},${lat},${lon});`;
    });

    return `
      [out:json][timeout:20];
      (
        ${lines.join("\n")}
      );
      out center 30;
    `;
  }

  function distanceKm(aLat, aLon, bLat, bLon) {
    const R = 6371;

    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLon = (bLon - aLon) * Math.PI / 180;

    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(aLat * Math.PI / 180) *
      Math.cos(bLat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  async function fetchNearby(lat, lon, facility) {
    const cacheKey = [
      facility,
      lat.toFixed(2),
      lon.toFixed(2)
    ].join(":");

    const cached = state.nearbyCache.get(cacheKey);

    if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
      return cached.results;
    }

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), 18000);

    try {
      const query = overpassQuery(lat, lon, facility);

      const response = await fetch(CONFIG.overpassEndpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        signal: controller.signal
      });

      if (!response.ok) throw new Error("Nearby lookup unavailable");

      const data = await response.json();

      const entries = Array.isArray(data.elements)
        ? data.elements
        : [];

      const seen = new Set();

      const results = entries
        .map(item => {
          const tags = item.tags || {};

          const itemLat = Number(item.lat ?? item.center?.lat);
          const itemLon = Number(item.lon ?? item.center?.lon);

          if (!Number.isFinite(itemLat) || !Number.isFinite(itemLon)) {
            return null;
          }

          const name =
            tags["name:bn"] ||
            tags.name ||
            tags["name:en"] ||
            FACILITIES[facility].label;

          const phone = cleanPhone(
            tags.phone || tags["contact:phone"] || ""
          );

          const address = [
            tags["addr:street"],
            tags["addr:city"],
            tags["addr:district"]
          ].filter(Boolean).join(", ");

          return {
            id: `${item.type}:${item.id}`,
            name,
            lat: itemLat,
            lon: itemLon,
            phone,
            address,
            distance: distanceKm(lat, lon, itemLat, itemLon)
          };
        })
        .filter(Boolean)
        .filter(item => {
          const key = normalize(item.name) +
            ":" + item.lat.toFixed(3) +
            ":" + item.lon.toFixed(3);

          if (seen.has(key)) return false;

          seen.add(key);
          return true;
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, CONFIG.maxNearbyResults);

      state.nearbyCache.set(cacheKey, {
        time: Date.now(),
        results
      });

      return results;
    } finally {
      clearTimeout(timer);
    }
  }

  async function findNearby(facility) {
    const label = FACILITIES[facility]?.label || "পরিষেবা";

    const requestId = ++state.requestId;

    const card = createCard(
      `📍 কাছাকাছি ${label}`,
      "আপনার অনুমতি নিয়ে বর্তমান অবস্থানের আশেপাশে খোঁজা হচ্ছে।"
    );

    card.classList.add("np-u-loading");

    showCards([card]);

    let coords;

    try {
      coords = await getPosition();
    } catch {
      card.classList.remove("np-u-loading");

      card.replaceChildren();

      card.appendChild(
        element("h3", "np-u-title", `📍 কাছাকাছি ${label}`)
      );

      addText(
        card,
        "অবস্থান ব্যবহারের অনুমতি পাওয়া যায়নি। চাইলে ব্রাউজারে Location চালু করুন অথবা Google Maps-এ খুঁজুন।"
      );

      addActions(card, [
        makeLink(
          "🗺️ Google Maps-এ খুঁজুন",
          mapsSearch(`${label} near me`),
          true
        )
      ]);

      return;
    }

    if (requestId !== state.requestId) return;

    try {
      const results = await fetchNearby(
        coords.latitude,
        coords.longitude,
        facility
      );

      if (requestId !== state.requestId) return;

      card.classList.remove("np-u-loading");
      card.replaceChildren();

      card.appendChild(
        element("h3", "np-u-title", `📍 কাছাকাছি ${label}`)
      );

      if (!results.length) {
        addText(
          card,
          "এই অনুসন্ধানে কাছাকাছি কোনো তালিকাভুক্ত প্রতিষ্ঠান পাওয়া যায়নি। এর অর্থ এই নয় যে এলাকায় প্রতিষ্ঠান নেই। Google Maps-এও খুঁজে দেখুন।"
        );
      } else {
        addText(
          card,
          "OpenStreetMap-এ তালিকাভুক্ত কাছাকাছি স্থানগুলি দেখানো হচ্ছে। দূরত্ব আনুমানিক সরলরেখায়; যাওয়ার আগে তথ্য যাচাই করুন।"
        );

        results.forEach(item => {
          const row = element("div", "np-u-result");

          row.appendChild(element("strong", "", item.name));

          addText(
            row,
            `${item.distance.toFixed(1)} কিমি দূরে` +
            (item.address ? ` • ${item.address}` : "")
          );

          const actions = [
            makeLink(
              "🧭 যাওয়ার রাস্তা",
              mapsDirections(item.lat, item.lon),
              true
            )
          ];

          if (item.phone) {
            actions.push(makeCall("তালিকাভুক্ত নম্বর", item.phone));
          }

          addActions(row, actions);

          card.appendChild(row);
        });
      }

      addActions(card, [
        makeLink(
          "🗺️ Google Maps-এ আরও খুঁজুন",
          mapsSearch(
            `${label} near ${coords.latitude},${coords.longitude}`
          )
        )
      ]);
    } catch {
      if (requestId !== state.requestId) return;

      card.classList.remove("np-u-loading");
      card.replaceChildren();

      card.appendChild(
        element("h3", "np-u-title", `📍 কাছাকাছি ${label}`)
      );

      addText(
        card,
        "এখন কাছাকাছি স্থানগুলির তালিকা আনা যাচ্ছে না। Google Maps-এ খোঁজা চালিয়ে যেতে পারেন।"
      );

      addActions(card, [
        makeLink(
          "🗺️ Google Maps-এ দেখুন",
          mapsSearch(
            `${label} near ${coords.latitude},${coords.longitude}`
          ),
          true
        )
      ]);
    }
  }

  /* ---------------- EXISTING SERVICE CARDS ---------------- */

  function indexExistingCards() {
    const cards = Array.from(
      document.querySelectorAll(
        ".service-card, [id^='service_']"
      )
    );

    const seen = new Set();

    cards.forEach(card => {
      const actualCard = card.closest(".service-card") || card;

      if (seen.has(actualCard)) return;

      seen.add(actualCard);

      const title =
        actualCard.querySelector(".card-title")?.textContent ||
        actualCard.textContent ||
        "";

      state.indexedCards.push({
        id: actualCard.id || "",
        title: normalize(title).slice(0, 250),
        node: actualCard
      });
    });
  }

  function getLiveServiceCard(id) {
    return document.getElementById(id) ||
      state.indexedCards.find(item => item.id === id)?.node ||
      null;
  }

  function openExistingCard(id) {
    const card = getLiveServiceCard(id);

    if (!card) return false;

    const live = document.contains(card);

    if (!live) return false;

    restoreOriginalVisibility();

    const link = card.matches("a[href]")
      ? card
      : card.querySelector("a[href]");

    if (link) {
      const href = safeUrl(link.href);

      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
        return true;
      }
    }

    const clickable =
      card.matches("[onclick]") ? card :
      card.querySelector("[onclick]");

    if (clickable) {
      clickable.click();
      return true;
    }

    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    return true;
  }

  function renderService(rule, query) {
    const q = normalize(query);

    const isStatus = contains(q, [
      "স্ট্যাটাস", "status", "অবস্থা",
      "চেক", "check", "ট্র্যাক", "track",
      "ভেরিফাই", "verify", "যাচাই"
    ]);

    const card = createCard(
      `✅ ${rule.title}`,
      isStatus
        ? "আবেদনের অবস্থা বা যাচাইয়ের তথ্য সরকারি পোর্টালে নিজেই দেখতে পারেন। নাগরিক পরিষেবায় এই লিংক ব্যবহার করতে কোনো ফি নেই।"
        : "নিচে সংশ্লিষ্ট পরিষেবা ও মূল পোর্টালের বিকল্প রয়েছে। সরকারি পোর্টাল ব্যবহার করে নিজেও কাজ করতে পারেন।"
    );

    const actions = [];

    rule.ids.forEach(id => {
      const existing = getLiveServiceCard(id);

      if (!existing || !document.contains(existing)) return;

      const label =
        existing.querySelector(".card-title")?.textContent?.trim() ||
        existing.textContent.trim().slice(0, 55) ||
        rule.title;

      const button = element(
        "button",
        "np-u-btn",
        `📄 ${label.slice(0, 55)}`
      );

      button.type = "button";

      button.addEventListener("click", () => {
        openExistingCard(id);
      });

      actions.push(button);
    });

    actions.push(
      makeLink(
        isStatus ? "🌐 সরকারি পোর্টালে স্ট্যাটাস দেখুন" : "🌐 মূল পোর্টাল খুলুন",
        rule.url,
        true
      )
    );

    addActions(card, actions);

    if (!isStatus) {
      const support = createCard(
        "💬 আবেদন বা সংশোধনে ব্যক্তিগত সহায়তা",
        "চাইলে Online পরিষেবা থেকে শুভঙ্করের সহায়তা নিতে পারেন (ফোন: 9332434992)। এটি বেসরকারি ও ঐচ্ছিক পরিষেবা; কাজ অনুযায়ী ফি থাকতে পারে। সরকারি পোর্টাল নিজে ব্যবহার করার বিকল্পও খোলা রয়েছে।"
      );

      addActions(support, [
        makeLink(
          "WhatsApp-এ যোগাযোগ",
          "https://wa.me/919332434992"
        )
      ]);

      showCards([card, support]);
      return;
    }

    showCards([card]);
  }

  /* ---------------- GENERAL QUERY + AI ---------------- */

  function aiUsage() {
    const today = new Date().toLocaleDateString("en-CA");

    try {
      const stored = JSON.parse(
        localStorage.getItem("npUnifiedAiUsage") || "{}"
      );

      if (stored.date === today) {
        return {
          date: today,
          count: Number(stored.count) || 0
        };
      }
    } catch {
      // Continue with fresh local quota.
    }

    return { date: today, count: 0 };
  }

  function saveAiUsage(usage) {
    try {
      localStorage.setItem(
        "npUnifiedAiUsage",
        JSON.stringify(usage)
      );
    } catch {
      // Storage is optional.
    }
  }

  async function requestAi(query, button, answerBox) {
    const usage = aiUsage();

    if (usage.count >= CONFIG.maxAiPerDay) {
      answerBox.textContent =
        "আজকের প্রশ্নের সীমা পূর্ণ হয়েছে। জরুরি সাহায্য, সরকারি পরিষেবা ও মানচিত্রের অনুসন্ধান ব্যবহার করতে পারবেন।";
      return;
    }

    button.disabled = true;
    answerBox.textContent = "আপনার প্রশ্নের উত্তর প্রস্তুত করা হচ্ছে…";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(CONFIG.aiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error("Answer unavailable");

      const data = await response.json();

      const reply = String(
        data.reply || data.answer || ""
      ).trim();

      if (!reply) throw new Error("Empty answer");

      answerBox.textContent = reply.slice(0, 2500);

      usage.count += 1;
      saveAiUsage(usage);
    } catch {
      answerBox.textContent =
        "এই বিষয়ে নিশ্চিত তথ্য দেওয়া যাচ্ছে না। প্রশ্নটি আরও নির্দিষ্ট করে লিখতে পারেন। জরুরি পরিস্থিতিতে সরাসরি উপযুক্ত হেল্পলাইনে যোগাযোগ করুন।";
    } finally {
      clearTimeout(timeout);
      button.disabled = false;
    }
  }

  function renderGeneral(query) {
    const card = createCard(
      "🔎 আপনার প্রশ্ন",
      `“${query}” — এই প্রশ্নের জন্য আরও বিস্তারিত উত্তর চাইতে পারেন।`
    );

    const answer = element("p", "np-u-text");

    const button = element(
      "button",
      "np-u-btn np-u-primary",
      "✨ বিস্তারিত উত্তর দেখুন"
    );

    button.type = "button";

    button.addEventListener("click", () => {
      requestAi(query, button, answer);
    });

    addActions(card, [button]);

    card.appendChild(answer);

    showCards([card]);
  }

  /* ---------------- ORIGINAL SEARCH COMPATIBILITY ---------------- */

  function restoreOriginalVisibility() {
    document.querySelectorAll(
      ".category-group, .service-card"
    ).forEach(node => {
      if (node.dataset.npUnifiedHidden === "1") {
        node.style.removeProperty("display");
        delete node.dataset.npUnifiedHidden;
      }
    });
  }

  function suppressUnrelatedCards() {
    document.querySelectorAll(".category-group").forEach(node => {
      if (node.style.display === "none") return;

      node.dataset.npUnifiedHidden = "1";
      node.style.display = "none";
    });
  }

  function takeOverOriginalFilter() {
    window.filterServices = function () {
      const input = document.getElementById(CONFIG.searchInput);

      if (input) performSearch(input.value);
    };
  }

  /* ---------------- MAIN SEARCH ROUTER ---------------- */

  function performSearch(rawQuery) {
    const query = String(rawQuery || "").trim();

    state.currentQuery = query;
    state.requestId++;

    if (!query) {
      clearPanel();
      restoreOriginalVisibility();
      return;
    }

    const intent = detectIntent(query);

    state.currentIntent = intent;

    // Avoid generic original category results for intent-first searches.
    suppressUnrelatedCards();

    switch (intent.kind) {
      case "emergency":
        renderEmergency(intent.emergency);
        break;

      case "nearby": {
        const label = FACILITIES[intent.facility].label;

        const card = createCard(
          `📍 কাছাকাছি ${label}`,
          "কাছাকাছি প্রতিষ্ঠান দেখতে নিচের বোতাম চাপুন। আপনার অনুমতি ছাড়া অবস্থান নেওয়া হবে না।"
        );

        const button = element(
          "button",
          "np-u-btn np-u-primary",
          "📍 আমার অবস্থান ব্যবহার করুন"
        );

        button.type = "button";

        button.addEventListener("click", () => {
          findNearby(intent.facility);
        });

        addActions(card, [
          button,
          makeLink(
            "🗺️ Google Maps",
            mapsSearch(`${label} near me`)
          )
        ]);

        if (intent.facility === "hospital") {
          addActions(card, [
            makeCall("অ্যাম্বুলেন্স", PHONE.ambulance),
            makeCall("জরুরি সাহায্য", PHONE.emergency)
          ]);
        }

        if (intent.facility === "police") {
          addActions(card, [
            makeCall("জরুরি সাহায্য", PHONE.emergency)
          ]);
        }

        showCards([card]);
        break;
      }

      case "facility":
        renderFacility(intent, query);
        break;

      case "service":
        renderService(intent.service, query);
        break;

      default:
        renderGeneral(query);
    }
  }

  /* ---------------- VOICE SEARCH ---------------- */

  function unifiedVoiceSearch() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      const card = createCard(
        "🎙️ ভয়েস সার্চ",
        "এই ব্রাউজারে ভয়েস সার্চের সুবিধা নেই। সার্চ বক্সে প্রশ্নটি লিখুন।"
      );

      showCards([card]);
      return;
    }

    const recognition = new Recognition();

    recognition.lang = "bn-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const transcript =
        event.results?.[0]?.[0]?.transcript || "";

      const input = document.getElementById(CONFIG.searchInput);

      if (input) {
        input.value = transcript;
        performSearch(transcript);
      }
    };

    recognition.onerror = () => {
      const card = createCard(
        "🎙️ ভয়েস সার্চ",
        "কথা শনাক্ত করা যায়নি। আবার চেষ্টা করুন অথবা লিখে সার্চ করুন।"
      );

      showCards([card]);
    };

    recognition.start();
  }

  function setupVoice() {
    const button = document.getElementById("voiceSearchBtn");

    if (!button) return;

    // Replace the button node to remove previously attached listeners.
    const replacement = button.cloneNode(true);

    replacement.removeAttribute("onclick");

    button.replaceWith(replacement);

    replacement.addEventListener("click", event => {
      event.preventDefault();
      unifiedVoiceSearch();
    });

    window.startVoiceSearch = unifiedVoiceSearch;
  }

  /* ---------------- INITIALIZATION ---------------- */

  function setupInput() {
    const input = document.getElementById(CONFIG.searchInput);

    if (!input) return;

    input.removeAttribute("onkeyup");

    input.addEventListener("input", () => {
      clearTimeout(state.searchTimer);

      state.searchTimer = setTimeout(() => {
        performSearch(input.value);
      }, 180);
    });

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      clearTimeout(state.searchTimer);

      performSearch(input.value);
    });
  }

  async function initialize() {
    if (!document.getElementById(CONFIG.searchInput)) return;

    injectStyles();
    setupPanel();
    indexExistingCards();
    takeOverOriginalFilter();
    setupInput();
    setupVoice();

    // Load both optional sources without blocking search.
    Promise.allSettled([
      loadDistrictData(),
      loadApprovedContacts()
    ]);

    console.info("Nagorik Porisheba Unified Search initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.NPUnifiedSearch = {
    search: performSearch,
    nearby: findNearby,
    refreshDirectory: loadDistrictData
  };

})();
