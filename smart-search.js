/* ======================================================
   NAGORIK PORISHEBA 2.0
   SMART UNIVERSAL SEARCH — PHASE 2

   Emergency First
   Local Services First
   District Directory
   Gemini Fallback
   WhatsApp Assistance

   Existing index.html compatibility
   ====================================================== */

(function () {
  "use strict";

  const CONFIG = {
    whatsapp: "919332434992",
    aiEndpoint: "/api/gemini",
    debounce: 300,
    maxServices: 6,
    maxContacts: 5,
    aiTimeout: 18000,
    dailyAiLimit: 3
  };

  let input;
  let panel;
  let content;
  let timer;
  let activeRequest = 0;

  /* ================================
     TEXT NORMALIZATION
     ================================ */

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .normalize("NFC")
      .replace(/[।?!,;:()"']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesAny(text, words) {
    const value = normalize(text);

    return words.some(word =>
      value.includes(normalize(word))
    );
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function linkButton(label, url, className) {
    const a = make("a", className, label);

    a.href = url;

    if (!url.startsWith("tel:")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }

    return a;
  }

  function validPhone(value) {
    const phone = String(value || "")
      .replace(/[^\d+]/g, "");

    return /^\+?\d{3,15}$/.test(phone)
      ? phone
      : "";
  }

  function safeOfficialUrl(url) {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== "https:") return "";

      const host = parsed.hostname.toLowerCase();

      if (
        host.endsWith(".gov.in") ||
        host.endsWith(".nic.in") ||
        host === "gov.in" ||
        host === "nic.in"
      ) {
        return parsed.href;
      }

      return "";

    } catch {
      return "";
    }
  }

  /* ================================
     SEARCH INTELLIGENCE
     ================================ */

  const ALIASES = [
    ["আধার", "aadhaar", "aadhar", "adhar"],
    ["রেশন", "ration", "rasan", "খাদ্যসাথী"],
    ["ভোটার", "voter", "epic", "election"],
    ["পেনশন", "pension", "ভাতা", "বার্ধক্য"],
    ["বিদ্যুৎ", "electricity", "electric", "wbsedcl"],
    ["গ্যাস", "gas", "lpg", "cylinder"],
    ["জমি", "land", "পর্চা", "খতিয়ান", "banglarbhumi"],
    ["কৃষক", "farmer", "krishak", "kisan"],
    ["স্বাস্থ্য", "health", "hospital", "হাসপাতাল"],
    ["ব্যাংক", "bank", "balance", "ব্যালেন্স"],
    ["জন্ম", "birth"],
    ["শংসাপত্র", "certificate", "সার্টিফিকেট"],
    ["ড্রাইভিং", "driving", "license", "dl"],
    ["গাড়ি", "গাড়ি", "vehicle", "vahan", "rc"],
    ["রক্ত", "blood"],
    ["সাইবার", "cyber", "fraud", "scam"],
    ["দুর্ঘটনা", "accident", "এক্সিডেন্ট"],
    ["রাস্তা", "road", "রোড"]
  ];

  const STOP_WORDS = new Set([
    "আমি", "আমার", "আমাকে", "একটা", "একটি",
    "কিভাবে", "কীভাবে", "কোথায়", "কোথায়",
    "করবো", "করব", "করতে", "চাই", "হবে",
    "দেখব", "দেখতে", "দিয়ে", "দিয়ে",
    "কি", "কী", "এর", "the", "how",
    "can", "my", "please", "want",
    "to", "for", "is", "a", "an"
  ]);

  const INTENTS = {
    phone: [
      "ফোন", "নম্বর", "number", "phone",
      "call", "কল", "হেল্পলাইন", "helpline",
      "যোগাযোগ"
    ],

    status: [
      "স্ট্যাটাস", "status", "চেক", "check",
      "track", "ট্র্যাক", "ভেরিফাই",
      "verify", "কিস্তি", "টাকা ঢুকেছে"
    ],

    application: [
      "আবেদন", "apply", "application",
      "নতুন", "সংশোধন", "correction",
      "update", "আপডেট", "পরিবর্তন",
      "change", "ফর্ম", "form fillup",
      "pvc", "প্রিন্ট"
    ]
  };

  function detectIntent(query) {
    if (matchesAny(query, INTENTS.phone)) {
      return "phone";
    }

    if (matchesAny(query, INTENTS.application)) {
      return "application";
    }

    if (matchesAny(query, INTENTS.status)) {
      return "status";
    }

    return "general";
  }

  function queryTerms(query) {
    const original = normalize(query)
      .split(" ")
      .filter(word =>
        word.length > 1 &&
        !STOP_WORDS.has(word)
      );

    const terms = new Set(original);

    ALIASES.forEach(group => {
      if (
        group.some(alias =>
          original.includes(normalize(alias))
        )
      ) {
        group.forEach(alias =>
          terms.add(normalize(alias))
        );
      }
    });

    return {
      original,
      expanded: [...terms]
    };
  }

  function calculateScore(query, title, details) {
    const titleText = normalize(title);
    const detailText = normalize(details);
    const normalizedQuery = normalize(query);

    const terms = queryTerms(query);

    let score = 0;

    if (titleText === normalizedQuery) {
      score += 100;
    }

    if (
      normalizedQuery.length > 2 &&
      titleText.includes(normalizedQuery)
    ) {
      score += 45;
    }

    terms.original.forEach(term => {
      if (titleText.includes(term)) {
        score += 15;
      }

      if (detailText.includes(term)) {
        score += 5;
      }
    });

    terms.expanded.forEach(term => {
      if (terms.original.includes(term)) return;

      if (titleText.includes(term)) {
        score += 5;
      }

      if (detailText.includes(term)) {
        score += 2;
      }
    });

    return score;
  }

  /* ================================
     EMERGENCY ENGINE
     ================================ */

  const EMERGENCIES = [
    {
      title: "সড়ক দুর্ঘটনা",
      words: [
        "road accident",
        "রোড এক্সিডেন্ট",
        "এক্সিডেন্ট",
        "accident",
        "সড়ক দুর্ঘটনা",
        "সড়ক দুর্ঘটনা",
        "গাড়ি ধাক্কা",
        "গাড়ি ধাক্কা",
        "বাইক দুর্ঘটনা"
      ],
      message:
        "প্রথমে নিজের ও ঘটনাস্থলের নিরাপত্তা নিশ্চিত করুন। জরুরি পরিষেবা 112-তে ফোন করুন। গুরুতর আহত ব্যক্তিকে অপ্রয়োজনে নাড়াচাড়া করবেন না। অ্যাম্বুলেন্সের জন্য 102 নম্বরে যোগাযোগের চেষ্টা করুন।",
      phones: [
        ["🚨 জরুরি সহায়তা", "112"],
        ["🚑 অ্যাম্বুলেন্স", "102"]
      ]
    },

    {
      title: "হার্ট অ্যাটাক বা গুরুতর অসুস্থতা",
      words: [
        "heart attack",
        "হার্ট অ্যাটাক",
        "বুকে ব্যথা",
        "chest pain",
        "অজ্ঞান",
        "unconscious",
        "শ্বাস নিতে পারছে না",
        "শ্বাসকষ্ট"
      ],
      message:
        "এটি চিকিৎসাগত জরুরি পরিস্থিতি হতে পারে। অবিলম্বে জরুরি পরিষেবায় ফোন করুন। ব্যক্তিকে একা রাখবেন না। অচেতন ও স্বাভাবিকভাবে শ্বাস না নিলে জরুরি অপারেটরের CPR নির্দেশনা অনুসরণ করুন।",
      phones: [
        ["🚨 জরুরি সহায়তা", "112"],
        ["🚑 অ্যাম্বুলেন্স", "102"]
      ]
    },

    {
      title: "সাপে কামড়",
      words: [
        "সাপে কামড়",
        "সাপে কামড়",
        "সাপ কামড়",
        "snake bite",
        "snakebite"
      ],
      message:
        "আক্রান্ত ব্যক্তিকে যতটা সম্ভব স্থির রাখুন এবং দ্রুত হাসপাতালে নেওয়ার ব্যবস্থা করুন। ক্ষত কাটবেন না, বিষ চুষবেন না এবং শক্ত করে বাঁধবেন না। সাপ ধরতে যাবেন না।",
      phones: [
        ["🚨 জরুরি সহায়তা", "112"],
        ["🚑 অ্যাম্বুলেন্স", "102"]
      ]
    },

    {
      title: "আগুন বা অগ্নিকাণ্ড",
      words: [
        "আগুন লেগেছে",
        "আগুন লাগছে",
        "অগ্নিকাণ্ড",
        "fire emergency",
        "fire accident",
        "fire brigade",
        "দমকল"
      ],
      message:
        "দ্রুত নিরাপদ স্থানে সরে যান। ধোঁয়া থাকলে নিচু হয়ে বেরোনোর চেষ্টা করুন। লিফট ব্যবহার করবেন না। আগুন নেভাতে নিজের জীবন ঝুঁকিতে ফেলবেন না।",
      phones: [
        ["🚨 জরুরি পরিষেবা", "112"],
        ["🚒 দমকল", "101"]
      ]
    },

    {
      title: "বিদ্যুৎস্পৃষ্ট",
      words: [
        "বিদ্যুৎস্পৃষ্ট",
        "কারেন্ট লেগেছে",
        "electric shock",
        "electrocution"
      ],
      message:
        "বিদ্যুতের সংযোগ বন্ধ না করে আক্রান্ত ব্যক্তিকে স্পর্শ করবেন না। নিরাপদ দূরত্বে থাকুন এবং জরুরি পরিষেবায় যোগাযোগ করুন।",
      phones: [
        ["🚨 জরুরি সহায়তা", "112"],
        ["🚑 অ্যাম্বুলেন্স", "102"]
      ]
    },

    {
      title: "সাইবার আর্থিক প্রতারণা",
      words: [
        "সাইবার প্রতারণা",
        "সাইবার ফ্রড",
        "cyber fraud",
        "online fraud",
        "scam",
        "টাকা কেটে নিয়েছে",
        "টাকা কেটে নিয়েছে",
        "ব্যাংক ফ্রড",
        "otp fraud"
      ],
      message:
        "অনলাইন আর্থিক প্রতারণা হলে দ্রুত 1930 নম্বরে যোগাযোগ করুন এবং ব্যাংককেও জানান। OTP, PIN বা পাসওয়ার্ড কাউকে দেবেন না। প্রয়োজনে cybercrime.gov.in-এ অভিযোগ করুন।",
      phones: [
        ["🛡️ সাইবার হেল্পলাইন", "1930"]
      ],
      portal: "https://cybercrime.gov.in/"
    },

    {
      title: "নারী সুরক্ষা",
      words: [
        "নারী নির্যাতন",
        "মহিলা নির্যাতন",
        "women safety",
        "women emergency",
        "নারী সুরক্ষা",
        "মহিলাদের হেল্পলাইন"
      ],
      message:
        "তাৎক্ষণিক বিপদে নিরাপদ স্থানে যাওয়ার চেষ্টা করুন এবং 112 নম্বরে জরুরি সাহায্য চান। নারী সুরক্ষার জন্য 1091 নম্বরেও যোগাযোগের চেষ্টা করতে পারেন।",
      phones: [
        ["🚨 জরুরি সহায়তা", "112"],
        ["📞 নারী সুরক্ষা", "1091"]
      ]
    }
  ];

  function findEmergency(query) {
    return EMERGENCIES.find(item =>
      matchesAny(query, item.words)
    );
  }

  function renderEmergency(emergency) {
    const box = make("div", "np-emergency");

    box.appendChild(
      make(
        "h3",
        "np-emergency-title",
        "🚨 " + emergency.title
      )
    );

    box.appendChild(
      make("p", "", emergency.message)
    );

    const actions = make("div", "np-actions");

    emergency.phones.forEach(([label, phone]) => {
      actions.appendChild(
        linkButton(
          label + ": " + phone,
          "tel:" + phone,
          "np-call"
        )
      );
    });

    if (emergency.portal) {
      actions.appendChild(
        linkButton(
          "🏛️ অভিযোগ পোর্টাল",
          emergency.portal,
          "np-official"
        )
      );
    }

    box.appendChild(actions);

    content.appendChild(box);
  }

  /* ================================
     EXISTING SERVICES
     ================================ */

  function getServices() {
    return [
      ...document.querySelectorAll(".service-card")
    ].map(card => {
      return {
        card,
        title:
          card.querySelector(".card-title")
            ?.textContent.trim() || "",
        details:
          (
            card.querySelector(".card-dept")
              ?.textContent || ""
          ) +
          " " +
          (card.dataset.keywords || "")
      };
    }).filter(item => item.title);
  }

  function findServices(query) {
    return getServices()
      .map(item => ({
        ...item,
        score: calculateScore(
          query,
          item.title,
          item.details
        )
      }))
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.maxServices);
  }

  function openService(item) {
    const card = item.card;

    const group = card.closest(".category-group");

    if (group) {
      group.style.display = "block";
      group.classList.add("open");
    }

    card.style.display = "flex";

    const searchValue = input.value;

    input.value = "";

    if (typeof window.filterServices === "function") {
      window.filterServices();
    }

    input.value = searchValue;

    group?.classList.add("open");

    card.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    card.style.outline = "3px solid #facc15";

    setTimeout(() => {
      card.style.outline = "";
    }, 2500);

    card.click();
  }

  function renderServices(services) {
    if (!services.length) return;

    content.appendChild(
      make(
        "h3",
        "np-section-title",
        "🏛️ সংশ্লিষ্ট পরিষেবা"
      )
    );

    services.forEach(item => {
      const row = make("div", "np-result");

      const info = make("div", "np-info");

      info.appendChild(
        make("strong", "", item.title)
      );

      const description =
        item.card.querySelector(".card-dept")
          ?.textContent || "";

      info.appendChild(
        make("small", "", description)
      );

      const button = make(
        "button",
        "np-open",
        "খুলুন →"
      );

      button.type = "button";

      button.onclick = () => openService(item);

      row.append(info, button);

      content.appendChild(row);
    });
  }

  /* ================================
     DIRECTORY SEARCH
     ================================ */

  const COMMON_PHONES = [
    {
      name: "জাতীয় জরুরি পরিষেবা",
      phone: "112",
      words: "জরুরি পুলিশ emergency police fire"
    },
    {
      name: "অ্যাম্বুলেন্স",
      phone: "102",
      words: "ambulance অ্যাম্বুলেন্স হাসপাতাল health"
    },
    {
      name: "সাইবার আর্থিক প্রতারণা",
      phone: "1930",
      words: "cyber fraud সাইবার প্রতারণা"
    },
    {
      name: "বিদ্যুৎ অভিযোগ WBSEDCL",
      phone: "19121",
      words: "electric electricity বিদ্যুৎ কারেন্ট wbsedcl"
    },
    {
      name: "নারী সুরক্ষা",
      phone: "1091",
      words: "women safety নারী মহিলা"
    },
    {
      name: "স্বাস্থ্য সহায়তা",
      phone: "104",
      words: "health স্বাস্থ্য হাসপাতাল"
    }
  ];

  function getLocalContacts() {
    const all = [...COMMON_PHONES];

    try {
      const district =
        document.getElementById("wbDistrictSelect")
          ?.value || "";

      const subdivision =
        document.getElementById("wbSubDivSelect")
          ?.value || "";

      if (
        typeof emergencyDirectoryData === "undefined"
      ) {
        return all;
      }

      const records =
        emergencyDirectoryData[district]
          ?.[subdivision] || [];

      records.forEach(item => {
        const approved =
          typeof verifiedContactsDB !== "undefined"
            ? verifiedContactsDB[subdivision]
                ?.[item.name]
            : "";

        const phone = validPhone(
          approved || item.phone
        );

        if (!phone) return;

        all.push({
          name: item.name + " — " + subdivision,
          phone,
          words:
            item.name + " " +
            (item.sub || "") + " " +
            subdivision + " " +
            district
        });
      });

    } catch (error) {
      console.warn("Directory search:", error);
    }

    return all;
  }

  function findContacts(query) {
    const unique = new Set();

    return getLocalContacts()
      .map(item => ({
        ...item,
        score: calculateScore(
          query,
          item.name,
          item.words
        )
      }))
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score)
      .filter(item => {
        const key = item.name + item.phone;

        if (unique.has(key)) return false;

        unique.add(key);
        return true;
      })
      .slice(0, CONFIG.maxContacts);
  }

  function renderContacts(contacts) {
    if (!contacts.length) return;

    content.appendChild(
      make(
        "h3",
        "np-section-title",
        "📞 উপলব্ধ যোগাযোগ নম্বর"
      )
    );

    contacts.forEach(item => {
      const row = make("div", "np-result");

      const info = make("div", "np-info");

      info.appendChild(
        make("strong", "", item.name)
      );

      info.appendChild(
        make("small", "", item.phone)
      );

      row.appendChild(info);

      row.appendChild(
        linkButton(
          "📞 Call Now",
          "tel:" + item.phone,
          "np-call"
        )
      );

      content.appendChild(row);
    });
  }

  /* ================================
     WHATSAPP ASSISTANCE
     ================================ */

  function whatsappUrl(query) {
    const message =
      "নমস্কার শুভঙ্করবাবু।\n" +
      "নাগরিক পরিষেবা ওয়েবসাইট থেকে যোগাযোগ করছি।\n\n" +
      "আমার প্রশ্ন: " + query + "\n\n" +
      "প্রয়োজনে আপনার ব্যক্তিগত অনলাইন পরিষেবার সহায়তা চাই।";

    return (
      "https://wa.me/" +
      CONFIG.whatsapp +
      "?text=" +
      encodeURIComponent(message)
    );
  }

  function renderSupport(query) {
    const box = make("div", "np-support");

    box.appendChild(
      make(
        "strong",
        "",
        "💬 Online পরিষেবা — শুভঙ্কর"
      )
    );

    box.appendChild(
      make(
        "p",
        "",
        "সরকারি পরিষেবা নিজে ব্যবহার করতে পারেন। আবেদন, সংশোধন, ফর্ম পূরণ বা প্রিন্টের জন্য চাইলে ব্যক্তিগত সহায়তা নিতে পারেন। এই সহায়তা ঐচ্ছিক এবং ফি-সাপেক্ষ।"
      )
    );

    box.appendChild(
      linkButton(
        "WhatsApp-এ যোগাযোগ করুন",
        whatsappUrl(query),
        "np-whatsapp"
      )
    );

    content.appendChild(box);
  }

  /* ================================
     GEMINI AI FALLBACK
     ================================ */

  function getAiUsage() {
    const date = new Date()
      .toLocaleDateString("en-CA");

    try {
      const saved = JSON.parse(
        localStorage.getItem("npAiUsageV2") || "null"
      );

      if (saved && saved.date === date) {
        return saved;
      }
    } catch {}

    return {
      date,
      count: 0
    };
  }

  function saveAiUsage(usage) {
    try {
      localStorage.setItem(
        "npAiUsageV2",
        JSON.stringify(usage)
      );
    } catch {}
  }

  async function askAI(query, requestId) {
    const usage = getAiUsage();

    if (usage.count >= CONFIG.dailyAiLimit) {
      content.appendChild(
        make(
          "p",
          "np-note",
          "আজকের AI প্রশ্নের সীমা শেষ হয়েছে। সাধারণ সার্চ ও সরকারি পরিষেবাগুলো ব্যবহার করতে পারবেন।"
        )
      );

      return;
    }

    const result = make(
      "div",
      "np-ai",
      "🤖 AI উত্তর তৈরি হচ্ছে..."
    );

    content.appendChild(result);

    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      CONFIG.aiTimeout
    );

    try {
      const response = await fetch(CONFIG.aiEndpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          query: query
        }),

        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error("AI service unavailable");
      }

      const data = await response.json();

      if (requestId !== activeRequest) {
        return;
      }

      if (!data.reply) {
        throw new Error("Empty AI response");
      }

      usage.count += 1;
      saveAiUsage(usage);

      result.replaceChildren();

      result.appendChild(
        make(
          "strong",
          "",
          "🤖 নাগরিক AI সহায়তা"
        )
      );

      result.appendChild(
        make(
          "p",
          "",
          String(data.reply).slice(0, 2500)
        )
      );

      /*
        If the backend later returns verified sources,
        only approved government-domain URLs are shown.
      */

      if (Array.isArray(data.sources)) {
        const sources = make("div", "np-actions");

        data.sources.slice(0, 3).forEach(source => {
          const url = safeOfficialUrl(
            typeof source === "string"
              ? source
              : source.url
          );

          if (!url) return;

          sources.appendChild(
            linkButton(
              "সরকারি উৎস ↗",
              url,
              "np-official"
            )
          );
        });

        result.appendChild(sources);
      }

      result.appendChild(
        make(
          "small",
          "np-ai-disclaimer",
          "AI-এর উত্তর ভুল বা পুরোনো হতে পারে। জরুরি সিদ্ধান্ত, সরকারি নিয়ম ও বর্তমান তথ্য সংশ্লিষ্ট দপ্তরে যাচাই করুন।"
        )
      );

    } catch (error) {
      if (requestId !== activeRequest) {
        return;
      }

      result.textContent =
        "এই মুহূর্তে AI উত্তর পাওয়া যাচ্ছে না। জরুরি প্রয়োজনে উপরের Call Now বাটন ব্যবহার করুন।";

      console.warn("Gemini fallback:", error);

    } finally {
      clearTimeout(timeout);
    }
  }

  /* ================================
     MAIN SEARCH
     ================================ */

  function showPanel() {
    panel.hidden = false;
  }

  function search(query, submitted = false) {
    const text = query.trim();

    activeRequest++;

    const requestId = activeRequest;

    if (!text) {
      panel.hidden = true;
      return;
    }

    showPanel();

    content.replaceChildren();

    content.appendChild(
      make(
        "h2",
        "np-main-heading",
        "🔎 Smart Search ফলাফল"
      )
    );

    const emergency = findEmergency(text);

    /*
      Emergency results are immediate.
      They do not depend on Gemini.
    */

    if (emergency) {
      renderEmergency(emergency);
      return;
    }

    const intent = detectIntent(text);

    const services = findServices(text);

    const contacts =
      intent === "phone"
        ? findContacts(text)
        : [];

    if (contacts.length) {
      renderContacts(contacts);
    }

    if (services.length) {
      renderServices(services);
    }

    const foundLocal =
      services.length > 0 ||
      contacts.length > 0;

    if (!foundLocal) {
      content.appendChild(
        make(
          "p",
          "np-note",
          submitted
            ? "ওয়েবসাইটের নিজস্ব তথ্যের মধ্যে সরাসরি উত্তর পাওয়া যায়নি।"
            : "নিজস্ব পরিষেবায় সরাসরি মিল পাওয়া যায়নি। বিস্তারিত জানতে Enter চাপুন বা AI-কে জিজ্ঞাসা করুন।"
        )
      );
    }

    if (intent === "phone" && !contacts.length) {
      content.appendChild(
        make(
          "p",
          "np-note",
          "এই প্রশ্নের জন্য স্থানীয় ডিরেক্টরিতে নম্বর পাওয়া যায়নি। জরুরি পরিষেবা বিভাগে জেলা ও মহকুমা নির্বাচন করে দেখুন। যাচাই ছাড়া কোনো নম্বর দেখানো হচ্ছে না।"
        )
      );
    }

    /*
      AI is called only when the user submits.
      No AI request on every keystroke.
    */

    if (!submitted && !foundLocal) {
      const askButton = make(
        "button",
        "np-ask-ai",
        "🤖 AI-কে জিজ্ঞাসা করুন"
      );

      askButton.onclick = () => {
        search(input.value, true);
      };

      content.appendChild(askButton);
    }

    if (submitted && !foundLocal) {
      askAI(text, requestId);
    }

    if (intent === "application") {
      renderSupport(text);
    }

    /*
      A matched service card is always shown first.
      Gemini is not called unnecessarily.
    */
  }

  /* ================================
     VOICE SEARCH COMPATIBILITY
     ================================ */

  function enhanceVoice() {
    const originalVoice = window.startVoiceSearch;

    if (typeof originalVoice !== "function") {
      return;
    }

    /*
      Existing speech recognition continues working.
      Input updates are observed without replacing
      the original microphone implementation.
    */

    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    );

    if (!descriptor || !descriptor.set) {
      return;
    }

    /*
      Periodic inspection is deliberately avoided.
      Instead, filterServices() is wrapped because
      the original voice function calls it.
    */
  }

  /* ================================
     PREMIUM SEARCH UI
     ================================ */

  function addStyles() {
    const style = document.createElement("style");

    style.id = "np-phase2-styles";

    style.textContent = `

      #npSmartPanel {
        margin: 14px;
        padding: 16px;
        background: var(--container-bg, #fff);
        color: var(--text-main, #0f172a);
        border: 1px solid var(--card-border, #e2e8f0);
        border-radius: 22px;
        box-shadow: 0 12px 35px rgba(15,23,42,.1);
      }

      #npSmartPanel[hidden] {
        display: none !important;
      }

      .np-main-heading {
        font-size: 17px;
        font-weight: 800;
        margin-bottom: 14px;
      }

      .np-section-title {
        font-size: 14px;
        font-weight: 800;
        margin: 16px 0 10px;
        color: #2563eb;
      }

      .np-emergency {
        border: 2px solid #ef4444;
        border-radius: 17px;
        background: #fff1f2;
        padding: 15px;
        color: #881337;
      }

      .np-emergency-title {
        font-size: 17px;
        font-weight: 900;
        margin-bottom: 9px;
      }

      .np-emergency p {
        font-size: 13px;
        line-height: 1.9;
        font-weight: 600;
      }

      .np-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 13px;
      }

      .np-call,
      .np-official,
      .np-whatsapp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 11px 14px;
        border-radius: 11px;
        text-decoration: none;
        color: #fff;
        font-size: 13px;
        font-weight: 800;
        min-height: 44px;
      }

      .np-call {
        background: #16a34a;
      }

      .np-official {
        background: #2563eb;
      }

      .np-whatsapp {
        background: #16a34a;
        margin-top: 10px;
      }

      .np-result {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px;
        margin-bottom: 9px;
        background: rgba(37,99,235,.04);
        border: 1px solid var(--card-border, #e2e8f0);
        border-radius: 13px;
      }

      .np-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .np-info strong {
        font-size: 13px;
        line-height: 1.6;
      }

      .np-info small {
        font-size: 11px;
        line-height: 1.6;
        opacity: .75;
      }

      .np-open,
      .np-ask-ai {
        border: none;
        border-radius: 11px;
        background: #2563eb;
        color: white;
        font-size: 12px;
        font-weight: 800;
        padding: 11px 14px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .np-ask-ai {
        width: 100%;
        margin-top: 12px;
        font-size: 13px;
        min-height: 45px;
      }

      .np-note {
        background: rgba(37,99,235,.07);
        border-radius: 12px;
        padding: 13px;
        font-size: 12px;
        line-height: 1.8;
        margin-top: 10px;
      }

      .np-ai {
        padding: 15px;
        margin-top: 12px;
        border-radius: 15px;
        border: 1px solid #a7f3d0;
        background: #ecfdf5;
        color: #065f46;
        font-size: 13px;
        line-height: 1.9;
        white-space: pre-wrap;
      }

      .np-ai strong {
        display: block;
        margin-bottom: 8px;
      }

      .np-ai-disclaimer {
        display: block;
        margin-top: 12px;
        font-size: 11px;
        opacity: .85;
      }

      .np-support {
        margin-top: 14px;
        border: 1px solid #86efac;
        background: #f0fdf4;
        color: #14532d;
        padding: 14px;
        border-radius: 15px;
      }

      .np-support strong {
        font-size: 14px;
      }

      .np-support p {
        font-size: 12px;
        line-height: 1.8;
        margin-top: 7px;
      }

      [data-theme="dark"] .np-emergency {
        background: #3b121c;
        color: #fecdd3;
      }

      [data-theme="dark"] .np-ai {
        background: #052e2b;
        color: #a7f3d0;
      }

      [data-theme="dark"] .np-support {
        background: #052e16;
        color: #bbf7d0;
      }

      @media (min-width: 768px) {
        #npSmartPanel {
          max-width: 750px;
          margin: 16px auto;
        }
      }

    `;

    document.head.appendChild(style);
  }

  /* ================================
     INITIALIZATION
     ================================ */

  function initialize() {
    input = document.getElementById("searchInput");

    if (!input) {
      console.warn("Smart Search: input not found");
      return;
    }

    if (document.getElementById("npSmartPanel")) {
      return;
    }

    addStyles();

    panel = make("section");

    panel.id = "npSmartPanel";

    panel.hidden = true;

    panel.setAttribute(
      "aria-label",
      "নাগরিক Smart Search"
    );

    panel.setAttribute(
      "aria-live",
      "polite"
    );

    content = make("div");

    panel.appendChild(content);

    const aiBox = document.getElementById(
      "aiResultBox"
    );

    if (aiBox && aiBox.parentNode) {
      aiBox.parentNode.insertBefore(
        panel,
        aiBox
      );
    } else {
      document.querySelector(".app-header")
        ?.after(panel);
    }

    /*
      Original inline search is preserved.
    */

    input.addEventListener("input", () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        search(input.value, false);
      }, CONFIG.debounce);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();

        clearTimeout(timer);

        search(input.value, true);
      }

      if (event.key === "Escape") {
        panel.hidden = true;
      }
    });

    /*
      Voice search compatibility:
      original startVoiceSearch calls filterServices().
    */

    const oldFilter = window.filterServices;

    if (typeof oldFilter === "function") {
      window.filterServices = function (...args) {
        const result = oldFilter.apply(
          this,
          args
        );

        clearTimeout(timer);

        timer = setTimeout(() => {
          search(input.value, false);
        }, CONFIG.debounce);

        return result;
      };
    }

    enhanceVoice();

    console.log(
      "Nagorik Porisheba 2.0 Smart Search Phase 2 Ready"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
