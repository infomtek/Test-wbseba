/* =====================================================
   নাগরিক পরিষেবা 2.0
   Smart Universal Search — Phase 1
   Existing services remain unchanged
   ===================================================== */

(function () {
  "use strict";

  const CONFIG = {
    whatsapp: "919332434992",
    maxResults: 7,
    debounceMs: 250
  };

  const ALIASES = [
    ["আধার", "aadhaar", "aadhar", "adhar"],
    ["রেশন", "ration", "rasan", "খাদ্যসাথী"],
    ["ভোটার", "voter", "epic", "election"],
    ["পেনশন", "pension", "বার্ধক্য", "বিধবা", "ভাতা"],
    ["বিদ্যুৎ", "electricity", "electric", "current", "wbsedcl"],
    ["গ্যাস", "gas", "lpg", "cylinder"],
    ["জমি", "land", "পর্চা", "খতিয়ান", "banglarbhumi"],
    ["কৃষক", "farmer", "krishak", "kisan"],
    ["স্বাস্থ্য", "health", "hospital", "হাসপাতাল"],
    ["ব্যাংক", "bank", "balance", "ব্যালেন্স"],
    ["জন্ম", "birth", "certificate", "সার্টিফিকেট"],
    ["ড্রাইভিং", "driving", "license", "dl"],
    ["গাড়ি", "vehicle", "vahan", "rc"],
    ["রক্ত", "blood", "blood bank"],
    ["সাইবার", "cyber", "fraud", "scam"],
    ["অভিযোগ", "complaint", "helpline"]
  ];

  const STATUS_WORDS = [
    "স্ট্যাটাস", "status", "চেক", "check",
    "ট্র্যাক", "track", "কিস্তি", "টাকা ঢুকেছে",
    "ভেরিফাই", "verify"
  ];

  const HELP_WORDS = [
    "আবেদন", "apply", "application", "নতুন",
    "সংশোধন", "correction", "update", "আপডেট",
    "পরিবর্তন", "change", "form fillup",
    "ফর্ম ফিলাপ", "প্রিন্ট", "pvc"
  ];

  const PHONE_WORDS = [
    "ফোন", "নম্বর", "number", "phone",
    "call", "কল", "যোগাযোগ", "হেল্পলাইন",
    "helpline", "ambulance", "অ্যাম্বুলেন্স"
  ];

  const STOP_WORDS = new Set([
    "আমি", "আমার", "আমাকে", "একটা", "একটি",
    "কিভাবে", "কীভাবে", "কোথায়", "কোথায়",
    "করবো", "করব", "করতে", "চাই", "হবে",
    "দেখব", "দেখতে", "করে", "দিয়ে", "দিয়ে",
    "এর", "কার", "কি", "কী", "the", "how",
    "can", "i", "my", "please", "want", "to",
    "a", "an", "is", "for"
  ]);

  const FIXED_CONTACTS = [
    {
      name: "জাতীয় জরুরি পরিষেবা",
      phone: "112",
      keywords: "জরুরি emergency পুলিশ police fire দমকল"
    },
    {
      name: "অ্যাম্বুলেন্স",
      phone: "102",
      keywords: "অ্যাম্বুলেন্স ambulance health hospital"
    },
    {
      name: "সাইবার আর্থিক প্রতারণা",
      phone: "1930",
      keywords: "সাইবার cyber fraud scam online money প্রতারণা"
    },
    {
      name: "নারী সুরক্ষা",
      phone: "1091",
      keywords: "নারী মহিলা women safety helpline"
    },
    {
      name: "WBSEDCL বিদ্যুৎ অভিযোগ",
      phone: "19121",
      keywords: "বিদ্যুৎ electric electricity current wbsedcl অভিযোগ"
    },
    {
      name: "রাজ্য স্বাস্থ্য সহায়তা",
      phone: "104",
      keywords: "স্বাস্থ্য health hospital চিকিৎসা"
    }
  ];

  let panel;
  let resultArea;
  let searchInput;
  let timer;
  let requestNumber = 0;
  let lastQuery = "";

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .normalize("NFC")
      .replace(/[।?!,;:()"'“”‘’]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function wordsOf(text) {
    return normalize(text)
      .split(" ")
      .filter(word => word.length > 1 && !STOP_WORDS.has(word));
  }

  function expandedTerms(query) {
    const terms = new Set(wordsOf(query));

    for (const group of ALIASES) {
      const matched = group.some(alias => {
        const normalAlias = normalize(alias);

        return [...terms].some(term =>
          term === normalAlias ||
          (
            normalAlias.length > 3 &&
            term.includes(normalAlias)
          )
        );
      });

      if (matched) {
        group.forEach(alias => terms.add(normalize(alias)));
      }
    }

    return [...terms];
  }

  function includesAny(text, terms) {
    const normalized = normalize(text);
    return terms.some(term => normalized.includes(normalize(term)));
  }

  function detectIntent(query) {
    if (includesAny(query, PHONE_WORDS)) return "phone";
    if (includesAny(query, HELP_WORDS)) return "help";
    if (includesAny(query, STATUS_WORDS)) return "status";
    return "general";
  }

  function getServices() {
    return [...document.querySelectorAll(".service-card")]
      .map(card => {
        const title = card.querySelector(".card-title");
        const dept = card.querySelector(".card-dept");

        return {
          element: card,
          title: title ? title.textContent.trim() : "",
          dept: dept ? dept.textContent.trim() : "",
          keywords: card.dataset.keywords || "",
          category: card.closest(".category-group")
            ?.querySelector(".category-header-title")
            ?.textContent.trim() || ""
        };
      })
      .filter(item => item.title);
  }

  function scoreText(query, terms, item) {
    const title = normalize(item.title);
    const dept = normalize(item.dept);
    const keywords = normalize(item.keywords);
    const category = normalize(item.category);

    const normalizedQuery = normalize(query);
    const originalTerms = wordsOf(query);

    let score = 0;

    if (title === normalizedQuery) score += 100;
    if (title.includes(normalizedQuery)) score += 50;
    if (keywords.includes(normalizedQuery)) score += 25;

    for (const word of originalTerms) {
      if (title.includes(word)) score += 15;
      if (keywords.includes(word)) score += 7;
      if (dept.includes(word)) score += 5;
      if (category.includes(word)) score += 2;
    }

    for (const term of terms) {
      if (originalTerms.includes(term)) continue;

      if (title.includes(term)) score += 5;
      if (keywords.includes(term)) score += 2;
    }

    return score;
  }

  function findServices(query) {
    const terms = expandedTerms(query);

    return getServices()
      .map(item => ({
        ...item,
        score: scoreText(query, terms, item)
      }))
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.maxResults);
  }

  function validPhone(value) {
    const phone = String(value || "").replace(/[^\d+]/g, "");

    if (!/^\+?\d{3,15}$/.test(phone)) return "";
    return phone;
  }

  function getDirectoryContacts() {
    const contacts = [...FIXED_CONTACTS];

    try {
      const district =
        document.getElementById("wbDistrictSelect")?.value || "";

      const subdivision =
        document.getElementById("wbSubDivSelect")?.value || "";

      if (
        typeof emergencyDirectoryData !== "undefined" &&
        emergencyDirectoryData[district]?.[subdivision]
      ) {
        const items = emergencyDirectoryData[district][subdivision];

        items.forEach(item => {
          const approved =
            typeof verifiedContactsDB !== "undefined"
              ? verifiedContactsDB[subdivision]?.[item.name]
              : "";

          const phone = validPhone(approved || item.phone);

          if (phone) {
            contacts.push({
              name: `${item.name} — ${subdivision}`,
              phone,
              keywords: `${item.name} ${item.sub || ""} ${district} ${subdivision}`
            });
          }
        });
      }
    } catch (error) {
      console.warn("Directory search:", error);
    }

    return contacts;
  }

  function findContacts(query) {
    const terms = expandedTerms(query);

    return getDirectoryContacts()
      .map(item => ({
        ...item,
        score: scoreText(query, terms, {
          title: item.name,
          dept: "",
          keywords: item.keywords,
          category: ""
        })
      }))
      .filter(item => item.score >= 5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  function createWhatsAppUrl(query) {
    const message =
      "নমস্কার শুভঙ্করবাবু, নাগরিক পরিষেবা ওয়েবসাইট থেকে যোগাযোগ করছি।\n" +
      "আমার প্রশ্ন: " + query + "\n" +
      "প্রয়োজনে আপনার ব্যক্তিগত অনলাইন পরিষেবার সহায়তা চাই।";

    return (
      "https://wa.me/" +
      CONFIG.whatsapp +
      "?text=" +
      encodeURIComponent(message)
    );
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
  }

  function actionButton(text, className, href) {
    const button = element("a", className, text);
    button.href = href;
    return button;
  }

  function serviceResult(item) {
    const row = element("div", "np-search-item");
    const info = element("div", "np-search-info");

    info.appendChild(element("strong", "", item.title));
    info.appendChild(element("small", "", item.dept));

    const btn = element("button", "np-search-open", "খুলুন");

    btn.addEventListener("click", () => {
      const group = item.element.closest(".category-group");

      if (group) {
        group.style.display = "block";
        group.classList.add("open");
      }

      item.element.style.display = "flex";

      panel.style.display = "none";

      item.element.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      item.element.style.outline = "3px solid #facc15";

      setTimeout(() => {
        item.element.style.outline = "";
      }, 3000);

      item.element.click();
    });

    row.append(info, btn);

    return row;
  }

  function contactResult(item) {
    const row = element("div", "np-search-item");
    const info = element("div", "np-search-info");

    info.appendChild(element("strong", "", item.name));
    info.appendChild(element("small", "", item.phone));

    const button = actionButton(
      "📞 Call Now",
      "np-search-call",
      "tel:" + item.phone
    );

    row.append(info, button);

    return row;
  }

  function render(query) {
    lastQuery = query;

    if (!query.trim()) {
      panel.style.display = "none";
      return;
    }

    const intent = detectIntent(query);
    const services = findServices(query);
    const contacts = findContacts(query);

    resultArea.replaceChildren();
    panel.style.display = "block";

    const heading = element(
      "div",
      "np-search-heading",
      "🔎 Smart Search ফলাফল"
    );

    resultArea.appendChild(heading);

    if (intent === "phone" && contacts.length) {
      resultArea.appendChild(
        element("div", "np-search-label", "📞 জরুরি যোগাযোগ")
      );

      contacts.forEach(item => {
        resultArea.appendChild(contactResult(item));
      });
    }

    if (services.length) {
      resultArea.appendChild(
        element("div", "np-search-label", "🏛️ সংশ্লিষ্ট পরিষেবা")
      );

      services.forEach(item => {
        resultArea.appendChild(serviceResult(item));
      });
    }

    if (!services.length && !(intent === "phone" && contacts.length)) {
      resultArea.appendChild(
        element(
          "p",
          "np-search-empty",
          "আপনার প্রশ্নের সরাসরি মিল পাওয়া যায়নি। অন্যভাবে লিখে চেষ্টা করুন।"
        )
      );
    }

    if (intent === "help") {
      resultArea.appendChild(
        element(
          "p",
          "np-search-note",
          "সরকারি পোর্টালে নিজে আবেদন করতে পারেন। ফর্ম পূরণ, সংশোধন বা প্রিন্টের জন্য চাইলে Online পরিষেবা থেকে ব্যক্তিগত সহায়তা নিতে পারেন। এই সহায়তা ঐচ্ছিক ও ফি-সাপেক্ষ।"
        )
      );

      const whatsapp = actionButton(
        "💬 শুভঙ্করবাবুর WhatsApp সহায়তা",
        "np-search-whatsapp",
        createWhatsAppUrl(query)
      );

      whatsapp.target = "_blank";
      whatsapp.rel = "noopener noreferrer";

      resultArea.appendChild(whatsapp);
    }

    if (intent === "phone" && !contacts.length) {
      resultArea.appendChild(
        element(
          "p",
          "np-search-note",
          "এই প্রশ্নের জন্য যাচাই করা নম্বর পাওয়া যায়নি। জরুরি ডিরেক্টরিতে জেলা ও মহকুমা নির্বাচন করে দেখুন।"
        )
      );
    }
  }

  function addStyles() {
    if (document.getElementById("np-smart-search-style")) return;

    const style = document.createElement("style");
    style.id = "np-smart-search-style";

    style.textContent = `
      #npSmartSearchPanel {
        margin: 12px 14px;
        padding: 14px;
        border-radius: 18px;
        background: var(--container-bg, #fff);
        color: var(--text-main, #0f172a);
        border: 1px solid var(--card-border, #dbeafe);
        box-shadow: 0 10px 30px rgba(15,23,42,.1);
      }

      .np-search-heading {
        font-size: 15px;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .np-search-label {
        font-size: 12px;
        font-weight: 800;
        color: #2563eb;
        margin: 12px 0 7px;
      }

      .np-search-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 11px;
        margin-bottom: 8px;
        border: 1px solid var(--card-border, #e2e8f0);
        border-radius: 12px;
      }

      .np-search-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .np-search-info strong {
        font-size: 13px;
        line-height: 1.5;
      }

      .np-search-info small {
        font-size: 11px;
        opacity: .75;
        line-height: 1.5;
      }

      .np-search-open,
      .np-search-call {
        border: none;
        background: #2563eb;
        color: white;
        padding: 9px 12px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        white-space: nowrap;
        text-decoration: none;
        cursor: pointer;
      }

      .np-search-call {
        background: #16a34a;
      }

      .np-search-whatsapp {
        display: block;
        padding: 12px;
        border-radius: 12px;
        background: #16a34a;
        color: white;
        text-align: center;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none;
        margin-top: 12px;
      }

      .np-search-note,
      .np-search-empty {
        font-size: 12px;
        line-height: 1.8;
        padding: 10px;
        background: rgba(37,99,235,.06);
        border-radius: 10px;
        margin-top: 10px;
      }

      @media (min-width: 768px) {
        #npSmartSearchPanel {
          max-width: 700px;
          margin-left: auto;
          margin-right: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    searchInput = document.getElementById("searchInput");

    if (!searchInput) return;
    if (document.getElementById("npSmartSearchPanel")) return;

    addStyles();

    panel = element("section");
    panel.id = "npSmartSearchPanel";
    panel.style.display = "none";
    panel.setAttribute("aria-label", "Smart Search ফলাফল");

    resultArea = element("div");
    panel.appendChild(resultArea);

    const aiBox = document.getElementById("aiResultBox");

    if (aiBox && aiBox.parentNode) {
      aiBox.parentNode.insertBefore(panel, aiBox);
    } else {
      searchInput.closest(".app-header")?.after(panel);
    }

    /*
      Original inline onkeyup="filterServices()"
      is retained for compatibility.

      Smart results use a separate panel and
      dynamically read current service cards.
    */

    searchInput.addEventListener("input", () => {
      clearTimeout(timer);

      const query = searchInput.value;

      timer = setTimeout(() => {
        render(query);
      }, CONFIG.debounceMs);
    });

    searchInput.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        panel.style.display = "none";
      }

      if (event.key === "Enter") {
        clearTimeout(timer);
        render(searchInput.value);
      }
    });

    /*
      Existing voice recognition writes to input,
      then calls filterServices().

      We wrap filterServices so voice results
      also update the Smart Search panel.
    */

    const originalFilter = window.filterServices;

    if (typeof originalFilter === "function") {
      window.filterServices = function (...args) {
        const result = originalFilter.apply(this, args);

        clearTimeout(timer);

        timer = setTimeout(() => {
          render(searchInput.value);
        }, CONFIG.debounceMs);

        return result;
      };
    }

    console.log("Nagorik Porisheba Smart Search initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
