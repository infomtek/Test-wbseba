/* ==========================================================
   নাগরিক পরিষেবা 2.2 — Unified Smart Search (stable build)
   Bengali + English + Mixed Language
   Emergency | Location | Nearby GPS | Services | Voice
   ========================================================== */

(function () {
  "use strict";

  if (window.NPUnifiedSearchLoaded) return;
  window.NPUnifiedSearchLoaded = true;

  /* ---------------- CONFIG ---------------- */

  const CONFIG = {
    searchInput: "searchInput",
    voiceButtonId: "voiceSearchBtn",
    panelId: "npUnifiedSearchPanel",
    districtFile: "/district_skeleton.json",
    contactSheet:
      "https://opensheet.elk.sh/116flqqFRP8Z1xw6rGG1QKOlGYIydOn1Sn3ffClqtbd0/Emergency",
    aiEnabled: false, // AI API সংশোধন স্থগিত — সাধারণ প্রশ্নে AI উত্তর দেখানো হবে না
    aiEndpoint: "/api/gemini",
    maxAiPerDay: 3,
    maxNearbyResults: 8,
    overpassEndpoint: "https://overpass-api.de/api/interpreter",
    whatsappUrl: "https://wa.me/919332434992",
    debounceMs: 180,
    // সার্চের সময় লুকানো হবে এমন অংশ। প্রয়োজনে এখানে ব্যানারের ক্লাস যোগ/বদল করুন।
    hideDuringSearch: [
      ".category-group",
      ".promo-banner",
      ".hero-banner",
      ".ad-banner",
      ".notice-banner",
      "[data-np-banner]"
    ]
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
    requestId: 0,
    recognition: null
  };

  /* ---------------- PLACES ---------------- */

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
    "খড়গপুর": "খড়গপুর",
    "kolkata": "কলকাতা",
    "calcutta": "কলকাতা",
    "কলকাতা": "কলকাতা",
    "howrah": "হাওড়া",
    "হাওড়া": "হাওড়া",
    "arambagh": "আরামবাগ",
    "আরামবাগ": "আরামবাগ",
    "jhargram": "ঝাড়গ্রাম",
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

  /* ---------------- FACILITIES ---------------- */

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
        "দমকল", "ফায়ার স্টেশন",
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

  /* ---------------- EXISTING SERVICE RULES (অক্ষত) ---------------- */

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
        "npci mapping",
        "npci link",
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
      words: ["আয়ুষ্মান", "ayushman"],
      ids: ["service_ayushman"],
      title: "আয়ুষ্মান পরিষেবা",
      url: "https://beneficiary.nha.gov.in/"
    },
    {
      words: ["জমির রেকর্ড", "banglarbhumi", "বাংলার ভূমি", "খতিয়ান"],
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

  // SERVICE_RULES-এ না থাকা পরিষেবার সরকারি পোর্টাল (শুধু নিশ্চিত লিংক)
  const OFFICIAL_PORTALS = {
    service_vishwakarma: "https://pmvishwakarma.gov.in/",
    service_crop_insurance: "https://pmfby.gov.in/"
  };

  function getPortalUrl(id) {
    const rule = SERVICE_RULES.find(item => item.ids.includes(id));
    return rule?.url || OFFICIAL_PORTALS[id] || "";
  }

  /* ---------------- GOVERNMENT SEARCH INDEX ---------------- */

  // weak: সাধারণ শব্দ — স্কোর কম হবে, যাতে "কৃষক" লিখলে সব প্রকল্প জোরালোভাবে না আসে
  const NP_GOVERNMENT_INDEX = [
    {
      title: "বিধবা ভাতা ও সামাজিক সুরক্ষা",
      id: "service_pension",
      keywords: [
        "বিধবা", "বিধবা ভাতা", "বিধবা পেনশন",
        "widow pension", "widow allowance",
        "ভাতা", "পেনশন", "pension",
        "সামাজিক সুরক্ষা", "বার্ধক্য ভাতা",
        "বয়স্ক ভাতা"
      ],
      weak: ["ভাতা"]
    },
    {
      title: "PM-Kisan",
      id: "service_pm_kisan",
      keywords: [
        "pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী",
        "কিষান", "কিসান", "কৃষক",
        "pm kisan", "pmkisan",
        "কৃষক সম্মান নিধি"
      ],
      weak: ["pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী", "কৃষক"]
    },
    {
      title: "PM Vishwakarma",
      id: "service_vishwakarma",
      keywords: [
        "pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী",
        "বিশ্বকর্মা", "বিশ্বকর্মা যোজনা",
        "pm vishwakarma", "vishwakarma"
      ],
      weak: ["pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী"]
    },
    {
      title: "প্রধানমন্ত্রী ফসল বিমা যোজনা",
      id: "service_crop_insurance",
      keywords: [
        "pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী",
        "ফসল বিমা", "ফসল বীমা",
        "crop insurance", "pmfby",
        "কৃষি বিমা", "কৃষি বীমা"
      ],
      weak: ["pm", "প্রধানমন্ত্রী", "প্রধান মন্ত্রী"]
    },
    {
      title: "কৃষক বন্ধু — স্ট্যাটাস",
      id: "service_krishak_old",
      keywords: [
        "কৃষক", "কৃষক বন্ধু",
        "কৃষক বন্ধু", "krishak bandhu",
        "কৃষক বন্ধু স্ট্যাটাস"
      ],
      weak: ["কৃষক"]
    },
    {
      title: "কৃষক বন্ধু — আবেদন",
      id: "service_krishak_new",
      keywords: [
        "কৃষক", "কৃষক বন্ধু",
        "krishak bandhu",
        "কৃষক বন্ধু আবেদন"
      ],
      weak: ["কৃষক"]
    },
    {
      title: "আধার DBT / NPCI",
      id: "service_dbt_change",
      keywords: [
        "dbt", "ডিবিটি", "ডিভিডি",
        "npci", "এনপিসিআই",
        "আধার সিডিং", "ব্যাংক লিংক"
      ]
    },
    {
      title: "রেশন কার্ড",
      id: "service_ration",
      keywords: [
        "রেশন", "রেসন",
        "ration", "রেশন কার্ড"
      ]
    },
    {
      title: "আধার কার্ড",
      id: "service_aadhaar_card",
      keywords: ["আধার", "aadhaar", "aadhar"]
    },
    {
      title: "জন্ম শংসাপত্র যাচাই",
      id: "service_birth_verify",
      keywords: [
        "জন্ম", "বার্থ সার্টিফিকেট",
        "birth certificate",
        "জন্ম সার্টিফিকেট",
        "জন্ম সার্টিফকেট"
      ],
      weak: ["জন্ম"]
    },
    {
      title: "ভোটার কার্ড",
      id: "service_voter_search",
      keywords: ["ভোটার", "ভটার", "voter", "epic"]
    },
    {
      title: "স্বাস্থ্যসাথী",
      id: "service_swasthya_sathi",
      keywords: [
        "স্বাস্থ্যসাথী", "স্বাস্থ্য সাথী",
        "স্বাস্থ্য সাথী", "swasthya sathi"
      ]
    },
    {
      title: "বিদ্যুৎ বিল",
      id: "service_bill_pay",
      keywords: [
        "বিদ্যুৎ বিল", "কারেন্ট বিল",
        "কারেন্টের বিল", "electric bill",
        "electricity bill"
      ]
    }
  ];

  // কোনো নির্দিষ্ট শব্দ থাকলে শুধু সেই বিষয়ের পরিষেবা আসবে
  const SPECIFIC_WORDS = [
    "কিষান", "কিসান", "kisan",
    "বিশ্বকর্মা", "vishwakarma",
    "বিধবা", "widow",
    "ডিবিটি", "ডিভিডি", "dbt",
    "এনপিসিআই", "npci",
    "রেশন", "রেসন", "ration"
  ];

  /* ---------------- BASIC HELPERS ---------------- */

  function normalize(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .toLocaleLowerCase()
      .replace(/[.,!?;:()[\]{}।'"‘’“”]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function contains(text, words) {
    return words.some(word => text.includes(normalize(word)));
  }

  // সহজ Levenshtein দূরত্ব — বানান ভুল ধরতে ব্যবহৃত
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let min = i;

      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < min) min = cur[j];
      }

      if (min > limit) return limit + 1;

      prev = cur;
    }

    return prev[b.length];
  }

  function fuzzyWordMatch(word, keyword) {
    if (word.length < 4 || keyword.length < 4) return false;
    if (keyword.includes(" ")) return false;

    const limit = keyword.length <= 6 ? 1 : 2;
    return editDistance(word, keyword, limit) <= limit;
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

  // variant: "primary" | "whatsapp" | "" (boolean true = primary)
  function makeLink(label, url, variant = "") {
    const isPrimary = variant === true || variant === "primary";

    const className =
      variant === "whatsapp"
        ? "np-u-btn np-u-whatsapp"
        : isPrimary
          ? "np-u-btn np-u-primary"
          : "np-u-btn";

    const valid = safeUrl(url);

    if (!valid) return element("span", "np-u-note", label);

    const a = element("a", className, label);

    a.href = valid;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    return a;
  }

  function makeWhatsAppLink(label) {
    return makeLink(label, CONFIG.whatsappUrl, "whatsapp");
  }

  function makeCall(label, phone) {
    const number = cleanPhone(phone);

    if (!number) return null;

    const a = element("a", "np-u-btn np-u-call", `📞 ${label}: ${number}`);

    a.href = `tel:${number}`;

    return a;
  }

  function makeButton(label, onClick, primary = false) {
    const button = element(
      "button",
      primary ? "np-u-btn np-u-primary" : "np-u-btn",
      label
    );

    button.type = "button";
    button.addEventListener("click", onClick);

    return button;
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

  function setSearchText(text) {
    const input = document.getElementById(CONFIG.searchInput);

    if (input) input.value = text;

    performSearch(text);
  }

  /* ---------------- PANEL ---------------- */

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

  function showFallbackCard() {
    showCards([
      createCard(
        "⚠️ সার্চে সমস্যা হয়েছে",
        "সাময়িক সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন। জরুরি হলে সরাসরি ১১২ নম্বরে ফোন করুন।",
        true
      )
    ]);
  }

  function setupPanel() {
    if (document.getElementById(CONFIG.panelId)) return;

    const input = document.getElementById(CONFIG.searchInput);

    if (!input) return;

    const panel = element("div", "np-unified-panel");

    panel.id = CONFIG.panelId;
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");

    const anchor =
      input.closest(".search-container, .search-box") || input.parentElement;

    if (anchor && anchor.parentElement) {
      anchor.insertAdjacentElement("afterend", panel);
    } else {
      input.insertAdjacentElement("afterend", panel);
    }
  }

  /* ---------------- STYLES ---------------- */

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

      .np-u-whatsapp {
        background: #25d366;
        border-color: #25d366;
        color: #ffffff !important;
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

      .np-listening {
        box-shadow: 0 0 0 4px rgba(239, 68, 68, .35);
        animation: npMicBlink 1s ease-in-out infinite;
      }

      @keyframes npMicBlink {
        0%, 100% { background-color: #ef4444; }
        50% { background-color: #fca5a5; }
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
      // Directory unavailable; Maps search remains usable.
    }
  }

  async function loadApprovedContacts() {
    try {
      const response = await fetch(CONFIG.contactSheet);

      if (!response.ok) return;

      const rows = await response.json();

      if (!Array.isArray(rows)) return;

      state.approvedContacts = rows.filter(row =>
        normalize(row.Status || row.status) === "approved"
      );
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

  function findDirectoryMatches(area, facility) {
    const list = flattenDirectory();

    return list
      .filter(item => {
        const location = normalize(
          `${item.district} ${item.subdivision} ${item.name} ${item.sub}`
        );

        const category = `${item.type} ${item.name} ${item.sub}`;

        const areaMatches = !area || location.includes(normalize(area));

        return areaMatches && facilityMatches(category, facility);
      })
      .slice(0, 8);
  }

  /* ---------------- INTENT DETECTION ---------------- */

  function detectEmergency(query) {
    const q = normalize(query);

    // প্রাণীর কামড়, আঁচড় ও কীটপতঙ্গের হুল
    if (
      contains(q, [
        "বিড়ালের কামড়", "বিড়াল কামড়", "বিড়ালে কামড়েছে",
        "বিড়ালের আঁচড়", "বিড়াল আঁচড়",
        "বিড়ালের আচড়", "cat bite", "cat scratch",
        "কুকুরের কামড়", "কুকুর কামড়", "কুকুরে কামড়েছে",
        "কুকুরের আঁচড়", "dog bite", "dog scratch",
        "হনুমানের কামড়", "বানরের কামড়", "monkey bite",
        "বিচ্ছুর কামড়", "বিছের কামড়", "scorpion sting",
        "মৌমাছির কামড়", "মৌমাছির হুল", "bee sting",
        "বোলতার কামড়", "বোলতার হুল", "wasp sting",
        "মাকড়সার কামড়", "spider bite",
        "পোকা কামড়", "পোকায় কামড়েছে", "insect bite"
      ])
    ) {
      return "animalbite";
    }

    if (
      contains(q, [
        "সাপে কামড়", "সাপ কামড়",
        "snake bite", "snakebite",
        "সাপের ছোবল", "সাপে কেটেছে"
      ])
    ) {
      return "snakebite";
    }

    if (
      contains(q, [
        "সাপ বেরিয়েছে", "সাপ ঢুকেছে", "সাপ দেখা",
        "সাপ এসেছে", "snake in house",
        "snake found", "snake rescue", "snake spotted"
      ]) ||
      /(^|\s)সাপ(\s|$)/.test(q)
    ) {
      return "snake";
    }

    if (
      contains(q, [
        "হনুমান কামড়", "বানর কামড়", "monkey bite"
      ])
    ) {
      return "monkeybite";
    }

    if (
      contains(q, [
        "পাগলা হনুমান", "হনুমান তাড়া",
        "aggressive monkey", "monkey attack",
        "বানর আক্রমণ", "হনুমান আক্রমণ"
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
        "রক্তপাত", "bleeding"
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
        "বাড়িতে আগুন",
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
        "টাকা কেটে নিয়েছে",
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

  // অ্যাম্বুলেন্স ও সাধারণ জরুরি শব্দ — facility-র পরে পরীক্ষা হয়
  function detectQuickCall(query) {
    const q = normalize(query);

    if (contains(q, ["অ্যাম্বুলেন্স", "ambulance"])) return "ambulance";

    if (contains(q, ["জরুরি", "emergency", "sos"])) return "sos";

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

    knownPlaces
      .filter(place => normalize(place).length >= 3)
      .sort((a, b) => b.length - a.length);

    return knownPlaces.find(place =>
      normalize(place).length >= 3 && q.includes(normalize(place))
    ) || "";
  }

  /* ---------------- GOVERNMENT SEARCH (ranking) ---------------- */

  function npGovernmentSearch(query) {
    const q = normalize(query);

    if (!q || q.length < 2) return [];

    const words = q.split(" ").filter(Boolean);

    const specificMatches = SPECIFIC_WORDS.filter(word =>
      q.includes(normalize(word))
    );

    const results = [];

    NP_GOVERNMENT_INDEX.forEach(item => {
      const weakSet = new Set((item.weak || []).map(normalize));
      let score = 0;

      item.keywords.forEach(keyword => {
        const key = normalize(keyword);

        if (!key) return;

        let points = 0;

        if (q === key) {
          points = 100;
        } else if (q.includes(key)) {
          points = key.length <= 3 ? 15 : 35;
        } else if (key.length >= 4 && words.some(word => word === key)) {
          points = 20;
        } else if (words.some(word => fuzzyWordMatch(word, key))) {
          points = 22; // বানান ভুল হলেও প্রাসঙ্গিক ফল
        }

        const weight = weakSet.has(key) ? 0.4 : 1;

        score += points * weight;
      });

      // নির্দিষ্ট শব্দ থাকলে সেই বিষয় ছাড়া অন্য প্রকল্প বাদ
      if (
        specificMatches.length &&
        !specificMatches.some(word =>
          item.keywords.some(keyword =>
            normalize(keyword).includes(normalize(word))
          )
        )
      ) {
        score = 0;
      }

      if (score > 0) {
        results.push({ ...item, score });
      }
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }

  function npRenderGovernmentResults(results) {
    const card = createCard(
      "🏛️ নাগরিক পরিষেবা — প্রাসঙ্গিক সরকারি পরিষেবা",
      results.length > 1
        ? "আপনার অনুসন্ধানের সঙ্গে সম্পর্কিত পরিষেবাগুলো নিচে দেওয়া হলো। আবেদন বা সংশোধনের জন্য সরকারি পোর্টাল আগে দেখুন।"
        : "আপনার অনুসন্ধানের সঙ্গে সম্পর্কিত পরিষেবাটি পাওয়া গেছে। আবেদন বা সংশোধনের জন্য সরকারি পোর্টাল আগে দেখুন।"
    );

    results.forEach(item => {
      const row = element("div", "np-u-result");

      row.appendChild(element("strong", "", item.title));

      const actions = [];

      const portalUrl = getPortalUrl(item.id);

      // সরকারি পোর্টাল সবসময় আগে
      if (portalUrl) {
        actions.push(makeLink("🌐 সরকারি পোর্টাল", portalUrl, "primary"));
      }

      if (getLiveServiceCard(item.id)) {
        actions.push(
          makeButton("🔗 নাগরিক পাতায় খুলুন", () => {
            openExistingCard(item.id);
          })
        );
      }

      if (!actions.length) {
        addText(
          row,
          "এই পরিষেবার সরাসরি লিংক বর্তমানে দেখানো যাচ্ছে না। মূল পরিষেবা তালিকা থেকে খুঁজুন।"
        );
      }

      addActions(row, actions);
      card.appendChild(row);
    });

    showCards([card]);
  }

  /* ---------------- SMART SERVICE (rules) ---------------- */

  const NP_SERVICE_ALIASES = [
    {
      id: "service_dbt_change",
      words: [
        "ডিভিডি", "ডিবিটি", "ডি বি টি",
        "dbt", "npci", "এনপিসিআই",
        "আধার সিডিং"
      ]
    },
    {
      id: "service_ration",
      words: [
        "রেশন", "রেসন", "রেশন কার্ড",
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
        "voter card", "ভোটার লিস্ট"
      ]
    },
    {
      id: "service_aadhaar_card",
      words: [
        "আধার কার্ড", "aadhar card", "aadhaar card"
      ]
    },
    {
      id: "service_land_record",
      words: [
        "জমির রেকর্ড", "জমির খতিয়ান",
        "বাংলার ভূমি", "banglarbhumi"
      ]
    },
    {
      id: "service_swasthya_sathi",
      words: [
        "স্বাস্থ্য সাথী", "স্বাস্থ্যসাথী",
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

      if (originalRule) return originalRule;

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
        title: card?.querySelector(".card-title")?.textContent?.trim() || "সরকারি পরিষেবা",
        url
      };
    }

    return null;
  }

  function detectService(query) {
    const q = normalize(query);

    const matches = SERVICE_RULES.filter(rule =>
      contains(q, rule.words)
    );

    if (!matches.length) return null;

    // নির্দিষ্ট (দীর্ঘ) শব্দ থাকলে সেটিকে আগে দেওয়া হয়
    const longestMatch = rule => Math.max(
      0,
      ...rule.words
        .filter(w => q.includes(normalize(w)))
        .map(w => normalize(w).length)
    );

    matches.sort((a, b) => longestMatch(b) - longestMatch(a));

    return matches[0];
  }

  /* ---------------- MAIN DETECTOR ---------------- */

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

    const quick = detectQuickCall(query);

    if (quick) {
      return { kind: "emergency", emergency: quick };
    }

    const governmentResults = npGovernmentSearch(query);

    if (governmentResults.length > 0) {
      return {
        kind: "governmentIndex",
        results: governmentResults
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

    animalbite: {
      title: "🚨 প্রাণীর কামড়, আঁচড় বা কীটপতঙ্গের হুল",
      text:
        "কুকুর, বিড়াল বা বানরের কামড় এবং চামড়া কেটে যাওয়া আঁচড় হলে ক্ষতস্থান সাবান ও প্রবাহমান জল দিয়ে অন্তত ১৫ মিনিট ধুয়ে দ্রুত হাসপাতালে যান। র‍্যাবিস ও টিটেনাসের প্রতিরোধমূলক চিকিৎসা দরকার হতে পারে। সাপের কামড় সন্দেহ হলে রোগীকে স্থির রেখে অবিলম্বে হাসপাতালে নিন; ক্ষত কাটবেন না, বিষ চুষবেন না বা শক্ত করে বাঁধবেন না। মৌমাছি, বোলতা বা অন্য কীটপতঙ্গের হুলের পর শ্বাসকষ্ট, মুখ-গলা ফুলে যাওয়া বা অজ্ঞান হলে 112-তে ফোন করুন।",
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
    },

    ambulance: {
      title: "🚑 অ্যাম্বুলেন্স",
      text:
        "জরুরি অবস্থায় সরাসরি অ্যাম্বুলেন্সের জন্য ১০২ বা সাধারণ জরুরি সাহায্যের জন্য ১১২ নম্বরে ফোন করুন। রোগীর অবস্থান ও অবস্থা স্পষ্ট করে বলুন।",
      numbers: [
        ["অ্যাম্বুলেন্স", PHONE.ambulance],
        ["জরুরি সাহায্য", PHONE.emergency]
      ],
      facility: "hospital"
    },

    sos: {
      title: "🚨 জরুরি সাহায্য",
      text:
        "বিপদে সরাসরি ১১২ নম্বরে ফোন করুন। অ্যাম্বুলেন্সের জন্য ১০২, আগুনের জন্য ১০১ নম্বরে ফোন করুন।",
      numbers: [
        ["জরুরি সাহায্য", PHONE.emergency],
        ["অ্যাম্বুলেন্স", PHONE.ambulance],
        ["দমকল", PHONE.fire]
      ]
    }
  };

  function renderEmergency(type) {
    const guide = EMERGENCY_GUIDES[type];

    if (!guide) return;

    const card = createCard(guide.title, guide.text, true);

    addActions(
      card,
      (guide.numbers || []).map(([label, phone]) => makeCall(label, phone))
    );

    if (guide.url) {
      addActions(card, [
        makeLink("🌐 অভিযোগ জানান", guide.url, "primary")
      ]);
    }

    if (guide.facility) {
      const area = getSelectedArea();
      const where = area.subdivision || area.district || "West Bengal";
      const facilityLabel = FACILITIES[guide.facility].label;

      addActions(card, [
        makeLink(
          `🗺️ ${facilityLabel} খুঁজুন`,
          mapsSearch(`${facilityLabel} ${where}`)
        ),
        makeButton(`📍 কাছাকাছি ${facilityLabel}`, () => {
          findNearby(guide.facility);
        })
      ]);

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

    const area = intent.place || selected.subdivision || selected.district || "";
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

      addText(row, `${item.area} — ${item.source}`);

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

    addActions(card, [
      makeLink("🗺️ Google Maps-এ খুঁজুন", mapsSearch(mapQuery), "primary"),
      makeButton(`📍 আমার কাছাকাছি ${label}`, () => {
        findNearby(facility);
      })
    ]);

    if (facility === "hospital") {
      addActions(card, [
        makeCall("অ্যাম্বুলেন্স", PHONE.ambulance),
        makeCall("জরুরি সাহায্য", PHONE.emergency)
      ]);
    }

    if (facility === "police") {
      addActions(card, [makeCall("জরুরি সাহায্য", PHONE.emergency)]);
    }

    if (facility === "fire") {
      addActions(card, [makeCall("দমকল", PHONE.fire)]);
    }

    if (facility === "blood") {
      addActions(card, [
        makeLink("🩸 রক্তের স্টক দেখুন", "https://eraktkosh.mohfw.gov.in/")
      ]);
    }

    showCards([card]);
  }

  function renderNearbyPrompt(facility) {
    const label = FACILITIES[facility].label;

    const card = createCard(
      `📍 কাছাকাছি ${label}`,
      "কাছাকাছি প্রতিষ্ঠান দেখতে নিচের বোতাম চাপুন। আপনার অনুমতি ছাড়া অবস্থান নেওয়া হবে না।"
    );

    addActions(card, [
      makeButton("📍 আমার অবস্থান ব্যবহার করুন", () => {
        findNearby(facility);
      }, true),
      makeLink("🗺️ Google Maps", mapsSearch(`${label} near me`))
    ]);

    if (facility === "hospital") {
      addActions(card, [
        makeCall("অ্যাম্বুলেন্স", PHONE.ambulance),
        makeCall("জরুরি সাহায্য", PHONE.emergency)
      ]);
    }

    if (facility === "police") {
      addActions(card, [makeCall("জরুরি সাহায্য", PHONE.emergency)]);
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
    const cacheKey = [facility, lat.toFixed(2), lon.toFixed(2)].join(":");

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

      const entries = Array.isArray(data.elements) ? data.elements : [];

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

          const phone = cleanPhone(tags.phone || tags["contact:phone"] || "");

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
          const key =
            normalize(item.name) + ":" +
            item.lat.toFixed(3) + ":" +
            item.lon.toFixed(3);

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

  function setLoadingCardTitle(card, label) {
    card.classList.remove("np-u-loading");
    card.replaceChildren();
    card.appendChild(element("h3", "np-u-title", `📍 কাছাকাছি ${label}`));
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
      if (requestId !== state.requestId) return;

      setLoadingCardTitle(card, label);

      addText(
        card,
        "অবস্থান ব্যবহারের অনুমতি পাওয়া যায়নি। চাইলে ব্রাউজারে Location চালু করুন অথবা Google Maps-এ খুঁজুন।"
      );

      addActions(card, [
        makeLink("🗺️ Google Maps-এ খুঁজুন", mapsSearch(`${label} near me`), "primary")
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

      setLoadingCardTitle(card, label);

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
            makeLink("🧭 যাওয়ার রাস্তা", mapsDirections(item.lat, item.lon), "primary")
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
          mapsSearch(`${label} near ${coords.latitude},${coords.longitude}`)
        )
      ]);
    } catch {
      if (requestId !== state.requestId) return;

      setLoadingCardTitle(card, label);

      addText(
        card,
        "এখন কাছাকাছি স্থানগুলির তালিকা আনা যাচ্ছে না। Google Maps-এ খোঁজা চালিয়ে যেতে পারেন।"
      );

      addActions(card, [
        makeLink(
          "🗺️ Google Maps-এ দেখুন",
          mapsSearch(`${label} near ${coords.latitude},${coords.longitude}`),
          "primary"
        )
      ]);
    }
  }

  /* ---------------- EXISTING SERVICE CARDS ---------------- */

  function indexExistingCards() {
    const cards = Array.from(
      document.querySelectorAll(".service-card, [id^='service_']")
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

    if (!card || !document.contains(card)) return false;

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

    const clickable = card.matches("[onclick]")
      ? card
      : card.querySelector("[onclick]");

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
        ? "আবেদনের অবস্থা বা যাচাইয়ের তথ্য সরকারি পোর্টালে নিজেই দেখতে পারেন। নাগরিক পরিষেবায় এই তথ্য দেখতে কোনো ফি নেই।"
        : "আবেদন বা সংশোধনের জন্য প্রথমে সরকারি পোর্টাল ব্যবহার করুন। নিচে সংশ্লিষ্ট নাগরিক পরিষেবার বিকল্পও রয়েছে।"
    );

    const actions = [];

    // সরকারি পোর্টাল সবার আগে
    actions.push(
      makeLink(
        isStatus ? "🌐 সরকারি পোর্টালে স্ট্যাটাস দেখুন" : "🌐 মূল পোর্টাল খুলুন",
        rule.url,
        "primary"
      )
    );

    rule.ids.forEach(id => {
      const existing = getLiveServiceCard(id);

      if (!existing || !document.contains(existing)) return;

      const label =
        existing.querySelector(".card-title")?.textContent?.trim() ||
        existing.textContent.trim().slice(0, 55) ||
        rule.title;

      actions.push(
        makeButton(`📄 ${label.slice(0, 55)}`, () => {
          openExistingCard(id);
        })
      );
    });

    addActions(card, actions);

    if (!isStatus) {
      const support = createCard(
        "💬 আবেদন বা সংশোধনে ব্যক্তিগত সহায়তা",
        "চাইলে Online পরিষেবা থেকে সহায়তা নিতে পারেন (ফোন: 9332434992)। এটি বেসরকারি ও ঐচ্ছিক পরিষেবা; কাজ অনুযায়ী ফি থাকতে পারে। সরকারি পোর্টাল নিজে ব্যবহার করার বিকল্পও খোলা রয়েছে।"
      );

      addActions(support, [makeWhatsAppLink("WhatsApp-এ যোগাযোগ")]);

      showCards([card, support]);
      return;
    }

    showCards([card]);
  }

  /* ---------------- GENERAL QUERY (AI বন্ধ) ---------------- */

  const SUGGESTIONS = [
    "বিধবা ভাতা",
    "রেশন কার্ড",
    "বিদ্যুৎ বিল",
    "PM Kisan",
    "DBT",
    "ভোটার কার্ড",
    "থানা",
    "হাসপাতাল",
    "সাপে কামড়েছে"
  ];

  function aiUsage() {
    const today = new Date().toLocaleDateString("en-CA");

    try {
      const stored = JSON.parse(localStorage.getItem("npUnifiedAiUsage") || "{}");

      if (stored.date === today) {
        return { date: today, count: Number(stored.count) || 0 };
      }
    } catch {
      // Fresh quota.
    }

    return { date: today, count: 0 };
  }

  function saveAiUsage(usage) {
    try {
      localStorage.setItem("npUnifiedAiUsage", JSON.stringify(usage));
    } catch {
      // Storage is optional.
    }
  }

  // AI সংশোধন না হওয়া পর্যন্ত CONFIG.aiEnabled = false থাকবে
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error("Answer unavailable");

      const data = await response.json();
      const reply = String(data.reply || data.answer || "").trim();

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
      "🔎 আপনার অনুসন্ধান",
      `“${query}” — এই শব্দে সরাসরি কোনো পরিষেবা মেলেনি। বানান ঠিক করে আবার লিখুন, অথবা নিচের একটি শব্দ চাপুন।`
    );

    addActions(
      card,
      SUGGESTIONS.map(text => makeButton(text, () => setSearchText(text)))
    );

    addActions(card, [
      makeLink(
        "🔎 ইন্টারনেটে খুঁজুন",
        "https://www.google.com/search?q=" +
          encodeURIComponent(`${query} West Bengal government`)
      )
    ]);

    if (CONFIG.aiEnabled) {
      const answer = element("p", "np-u-text");

      addActions(card, [
        makeButton("✨ বিস্তারিত উত্তর দেখুন", () => {
          requestAi(query, button, answer);
        })
      ]);

      const button = card.querySelector(".np-u-actions button:last-child");
      card.appendChild(answer);
    }

    showCards([card]);
  }

  /* ---------------- SEARCH MODE (অপ্রাসঙ্গিক অংশ লুকানো) ---------------- */

  function hideNonSearchContent() {
    const selector = CONFIG.hideDuringSearch.join(",");

    document.querySelectorAll(selector).forEach(node => {
      if (node.closest("#" + CONFIG.panelId)) return;
      if (node.style.display === "none") return;

      node.dataset.npUnifiedHidden = "1";
      node.style.display = "none";
    });
  }

  function restoreOriginalVisibility() {
    document.querySelectorAll('[data-np-unified-hidden="1"]').forEach(node => {
      node.style.removeProperty("display");
      delete node.dataset.npUnifiedHidden;
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

    hideNonSearchContent();

    try {
      const intent = detectIntent(query);

      state.currentIntent = intent;

      switch (intent.kind) {
        case "governmentIndex":
          npRenderGovernmentResults(intent.results);
          break;

        case "emergency":
          renderEmergency(intent.emergency);
          break;

        case "nearby":
          renderNearbyPrompt(intent.facility);
          break;

        case "facility":
          renderFacility(intent, query);
          break;

        case "service":
          renderService(intent.service, query);
          break;

        default:
          renderGeneral(query);
      }
    } catch (error) {
      console.error("Nagorik Porisheba search error:", error);
      showFallbackCard();
    }
  }

  /* ---------------- VOICE SEARCH ---------------- */

  function setMicState(active) {
    const button = document.getElementById(CONFIG.voiceButtonId);

    if (!button) return;

    button.classList.toggle("np-listening", active);
    button.classList.toggle("listening", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function unifiedVoiceSearch() {
    // চলমান থাকলে আবার চাপলে বন্ধ হবে
    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {
        // ignore
      }
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      showCards([
        createCard(
          "🎙️ ভয়েস সার্চ",
          "এই ব্রাউজারে ভয়েস সার্চের সুবিধা নেই। সার্চ বক্সে প্রশ্নটি লিখুন।"
        )
      ]);
      return;
    }

    const recognition = new Recognition();

    recognition.lang = "bn-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setMicState(true);

    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";

      if (transcript) setSearchText(transcript);
    };

    recognition.onerror = () => {
      showCards([
        createCard(
          "🎙️ ভয়েস সার্চ",
          "কথা শনাক্ত করা যায়নি। আবার চেষ্টা করুন অথবা লিখে সার্চ করুন।"
        )
      ]);
    };

    recognition.onend = () => {
      state.recognition = null;
      setMicState(false);
    };

    state.recognition = recognition;

    try {
      recognition.start();
    } catch {
      state.recognition = null;
      setMicState(false);
    }
  }

  function setupVoice() {
    const button = document.getElementById(CONFIG.voiceButtonId);

    if (!button || button.dataset.npVoiceBound === "1") return;

    // বাটন একই রেখে শুধু আমাদের Listener যোগ করা হচ্ছে,
    // যাতে আগের লাল ব্লিঙ্কিং বা অন্য Listener নষ্ট না হয়।
    button.removeAttribute("onclick");
    button.dataset.npVoiceBound = "1";

    button.addEventListener("click", event => {
      event.preventDefault();
      unifiedVoiceSearch();
    });

    window.startVoiceSearch = unifiedVoiceSearch;
  }

  /* ---------------- INPUT ---------------- */

  function setupInput() {
    const input = document.getElementById(CONFIG.searchInput);

    if (!input || input.dataset.npInputBound === "1") return;

    input.removeAttribute("onkeyup");
    input.dataset.npInputBound = "1";

    input.addEventListener("input", () => {
      clearTimeout(state.searchTimer);

      state.searchTimer = setTimeout(() => {
        performSearch(input.value);
      }, CONFIG.debounceMs);
    });

    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      clearTimeout(state.searchTimer);

      performSearch(input.value);
    });
  }

  /* ---------------- INITIALIZATION ---------------- */

  async function initialize() {
    if (!document.getElementById(CONFIG.searchInput)) return;

    injectStyles();
    setupPanel();
    indexExistingCards();
    takeOverOriginalFilter();
    setupInput();
    setupVoice();

    // Optional data — সার্চ এগুলোর জন্য অপেক্ষা করবে না
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
 (function() {
    "use strict";

    // ১. অ্যাডভান্সড সাজেশন ডাটাবেস (Animal, Insect, and Services)
    const SMART_INDEX = [
        // --- কীটপতঙ্গ (Insect Bites) ---
        { text: "🐝 মৌমাছি কামড়েছে — প্রাথমিক চিকিৎসা", category: "emergency", keyword: "মৌমাছি bee honeybee" },
        { text: "🐝 ভিমরুল কামড়েছে — প্রাথমিক চিকিৎসা", category: "emergency", keyword: "ভিমরুল wasp" },
        { text: "🐝 বোলতা কামড়েছে — প্রাথমিক চিকিৎসা", category: "emergency", keyword: "বোলতা" },
        { text: "🦂 বিছে কামড়েছে — জরুরি চিকিৎসা", category: "emergency", keyword: "বিছে scorpion" },
        { text: "🦟 কীটপতঙ্গের কামড় (Insect Bite) চিকিৎসা", category: "emergency", keyword: "insect bite কীটপতঙ্গ" },

        // --- প্রাণী আক্রমণ (Animal Attacks - Medical) ---
        { text: "🐍 সাপে কামড়েছে — দ্রুত হাসপাতালে যান", category: "emergency", keyword: "সাপে কামড়েছে snake bite" },
        { text: "🐕 কুকুর কামড়েছে — জলাতঙ্ক চিকিৎসা", category: "emergency", keyword: "কুকুর কামড়েছে dog bite" },
        { text: "🐈 বিড়াল কামড়েছে বা আঁচড় দিয়েছে", category: "emergency", keyword: "বিড়াল cat scratch bite" },
        { text: "🐒 বানর/হনুমান কামড়েছে — চিকিৎসা", category: "emergency", keyword: "বানর হনুমান monkey bite" },
        { text: "🦊 শেয়াল কামড়েছে — জরুরি চিকিৎসা", category: "emergency", keyword: "শেয়াল jackal bite" },

        // --- প্রাণী দেখা/উদ্ধার (Animal Sight - Rescue) ---
        { text: "🐍 বাড়িতে সাপ ঢুকেছে — বনদপ্তরের সহায়তা", category: "rescue", keyword: "সাপ ঢুকেছে সাপ দেখা গেছে snake rescue" },
        { text: "🐒 বানর/হনুমান উপদ্রব — বনদপ্তর খবর দিন", category: "rescue", keyword: "বানর উপদ্রব monkey rescue" },
        { text: "🦊 বন্যপ্রাণী দেখা গেছে — সতর্কতা", category: "rescue", keyword: "শেয়াল বন্যপ্রাণী wildlife" },

        // --- সাধারণ সরকারি পরিষেবা (Core Services) ---
        { text: "🌾 কৃষক বন্ধু স্ট্যাটাস যাচাই", category: "service", keyword: "কৃষক বন্ধু krishak bandhu" },
        { text: "💰 PM-Kisan কিস্তি চেক", category: "service", keyword: "pm kisan" },
        { text: "🆔 আধার কার্ড সংশোধন", category: "service", keyword: "আধার adhaar card" },
        { text: "📑 রেশনের কার্ড স্ট্যাটাস", category: "service", keyword: "রেশন ration card" },
        { text: "🗳️ ভোটার কার্ড সংশোধন", category: "service", keyword: "ভোটার voter id" },
        { text: "🏥 স্বাস্থ্যে সাথী কার্ড যাচাই", category: "service", keyword: "স্বাস্থ্য সাথী swasthya sathi" },
        { text: "🩸 কাছাকাছি ব্লাড ব্যাংক খুঁজুন", category: "service", keyword: "ব্লাড ব্যাংক blood bank" },
    ];

    window.initSmartSearch = function() {
        const searchInput = document.getElementById("searchInput");
        const voiceBtn = document.getElementById("voiceSearchBtn");

        if (!searchInput || !voiceBtn) return;

        // ২. অ্যারো বোতাম (Arrow Button) ইনজেক্ট করা
        const arrowBtn = document.createElement("button");
        arrowBtn.innerHTML = "➤";
        arrowBtn.className = "np-search-arrow";
        arrowBtn.title = "সার্চ করুন";
        voiceBtn.parentNode.insertBefore(arrowBtn, voiceBtn);

        // ৩. সাজেশন ড্রপডাউন তৈরি করা
        const sugBox = document.createElement("div");
        sugBox.className = "np-suggestion-box";
        searchInput.parentNode.appendChild(sugBox);

        // ৪. আগের 'input' ইভেন্ট ব্লক করা (যাতে টাইপ করলেই সার্চ না হয়)
        // আমরা মূল performSearch ফাংশনটি ব্যবহার করব যা unified-search.js-এ আছে।
        const originalPerformSearch = window.performSearch;

        // ৫. সাজেশন ফিল্টারিং লজিক
        searchInput.addEventListener("input", function() {
            const query = this.value.toLowerCase().trim();
            sugBox.innerHTML = "";

            if (query.length < 2) {
                sugBox.style.display = "none";
                return;
            }

            const matches = SMART_INDEX.filter(item => 
                item.keyword.toLowerCase().includes(query) || 
                item.text.toLowerCase().includes(query)
            );

            if (matches.length > 0) {
                matches.forEach(match => {
                    const div = document.createElement("div");
                    div.className = `np-suggestion-item ${match.category}`;
                    div.innerHTML = match.text;
                    div.onclick = () => {
                        searchInput.value = match.text;
                        sugBox.style.display = "none";
                        triggerFullSearch();
                    };
                    sugBox.appendChild(div);
                });
                sugBox.style.display = "block";
            } else {
                sugBox.style.display = "none";
            }
        });

        // ৬. সার্চ ট্রিগার ফাংশন
        function triggerFullSearch() {
            const query = searchInput.value;
            if (query) {
                sugBox.style.display = "none";
                if (typeof window.performSearch === "function") {
                    window.performSearch(query);
                } else {
                    console.error("performSearch function not found in unified-search.js");
                }
            }
        }

        // অ্যারো বোতামে ক্লিক করলে সার্চ হবে
        arrowBtn.onclick = triggerFullSearch;

        // Enter চাপলে সার্চ হবে
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") triggerFullSearch();
        });

        // বাইরে ক্লিক করলে সাজেশন বক্স বন্ধ হবে
        document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !sugBox.contains(e.target)) {
                sugBox.style.display = "none";
            }
        });
    };

    // পেজ লোড হওয়ার পর এবং মূল সার্চ ফাইল লোড হওয়ার পর এটি চালু হবে
    window.addEventListener("load", () => {
        setTimeout(window.initSmartSearch, 1000); 
    });

})();
