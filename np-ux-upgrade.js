/* =====================================================
   NAGORIK PORISHEBA 2.3
   Online পরিষেবা — আপনার পাশে, আপনার সাথে

   Citizen Experience Upgrade
   Compatible with Unified Smart Search

   Features:
   - Microphone Active Indicator
   - Bengali/English Spelling Support
   - Green WhatsApp Support
   - Search Result Presentation
   - Cyber Floating Button Disabled
   - Existing Cyber Modal Preserved
   ===================================================== */

(function () {
  "use strict";

  if (window.NPUXUpgradeLoaded) return;
  window.NPUXUpgradeLoaded = true;

  const CONFIG = {
    searchId: "searchInput",
    micId: "voiceSearchBtn",
    panelId: "npUnifiedSearchPanel",
    warningModalId: "cyberAlertModal",
    whatsapp: "https://wa.me/919332434992"
  };

  /* ==========================================
     1. PREMIUM STYLES
     ========================================== */

  function addStyles() {
    if (document.getElementById("npUxUpgradeStyles")) return;

    const style = document.createElement("style");
    style.id = "npUxUpgradeStyles";

    style.textContent = `

      /* MICROPHONE */

      #voiceSearchBtn {
        transition: all .25s ease !important;
      }

      #voiceSearchBtn.np-mic-active {
        background: #dc2626 !important;
        color: white !important;
        border-radius: 50% !important;
        box-shadow: 0 0 0 4px rgba(220,38,38,.20);
        animation: npMicPulse 1s infinite !important;
      }

      #voiceSearchBtn.np-mic-active svg,
      #voiceSearchBtn.np-mic-active i {
        color: white !important;
        stroke: white !important;
      }

      @keyframes npMicPulse {
        0% {
          box-shadow: 0 0 0 0 rgba(220,38,38,.65);
          transform: scale(1);
        }

        50% {
          box-shadow: 0 0 0 9px rgba(220,38,38,.08);
          transform: scale(1.09);
        }

        100% {
          box-shadow: 0 0 0 0 rgba(220,38,38,0);
          transform: scale(1);
        }
      }

      .np-mic-status {
        display: none;
        padding: 7px 13px;
        margin-top: 8px;
        border-radius: 10px;
        background: #fee2e2;
        color: #991b1b;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
      }

      .np-mic-status.active {
        display: block;
      }

      /* WHATSAPP */

      .np-upgrade-whatsapp {
        background: #16a34a !important;
        color: white !important;
        border-color: #16a34a !important;
        box-shadow: 0 4px 12px rgba(22,163,74,.22);
      }

      .np-upgrade-whatsapp:hover {
        background: #15803d !important;
        color: white !important;
      }

      /* CYBER WARNING POPUP */

      #cyberAlertModal .modal-content,
      #cyberAlertModal .modal-box,
      #cyberAlertModal .cyber-alert-content {
        border-radius: 22px !important;
        overflow: auto;
        max-height: 88vh;
        border: 1px solid rgba(245,158,11,.25);
        box-shadow: 0 22px 65px rgba(15,23,42,.25);
      }

      #cyberAlertModal h2,
      #cyberAlertModal h3 {
        line-height: 1.5;
      }

      #cyberAlertModal p {
        line-height: 1.9;
      }

      #cyberAlertModal button {
        cursor: pointer;
      }

      @media (prefers-reduced-motion: reduce) {
        #voiceSearchBtn.np-mic-active {
          animation: none !important;
          outline: 3px solid #dc2626;
        }
      }

    `;

    document.head.appendChild(style);
  }

  /* ==========================================
     2. MICROPHONE ACTIVE INDICATOR
     ========================================== */

  function setupMicIndicator() {
    const mic = document.getElementById(CONFIG.micId);
    const search = document.getElementById(CONFIG.searchId);

    if (!mic) return;

    let status = document.querySelector(".np-mic-status");

    if (!status) {
      status = document.createElement("div");

      status.className = "np-mic-status";
      status.textContent = "🎙️ আপনার কথা শুনছি…";

      if (search && search.parentElement) {
        search.parentElement.insertAdjacentElement(
          "afterend",
          status
        );
      }
    }

    let listening = false;

    function setListening(active) {
      listening = active;

      const currentMic = document.getElementById(
        CONFIG.micId
      );

      if (currentMic) {
        currentMic.classList.toggle(
          "np-mic-active",
          active
        );

        currentMic.setAttribute(
          "aria-label",
          active
            ? "মাইক্রোফোন চালু আছে"
            : "ভয়েস সার্চ"
        );
      }

      if (status) {
        status.classList.toggle("active", active);
      }
    }

    const NativeRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!NativeRecognition) return;

    if (window.NPMicRecognitionWrapped) return;

    window.NPMicRecognitionWrapped = true;

    function WrappedRecognition() {
      const recognition = new NativeRecognition();

      recognition.addEventListener(
        "start",
        function () {
          setListening(true);
        }
      );

      recognition.addEventListener(
        "end",
        function () {
          setListening(false);
        }
      );

      recognition.addEventListener(
        "error",
        function () {
          setListening(false);
        }
      );

      return recognition;
    }

    window.SpeechRecognition = WrappedRecognition;
    window.webkitSpeechRecognition = WrappedRecognition;

    window.addEventListener(
      "pagehide",
      function () {
        if (listening) {
          setListening(false);
        }
      }
    );
  }

  /* ==========================================
     3. SPELLING CORRECTIONS
     ========================================== */

  const SPELLING_MAP = {
    "ডিভিডি লিংক": "DBT লিংক",
    "ডিভিডি লিং": "DBT লিংক",
    "ডিবিটি লিং": "DBT লিংক",
    "ডি বি টি": "DBT",
    "ডিবিটি": "DBT",
    "ডিবিটি স্টেটাস": "DBT স্ট্যাটাস",
    "ডিবিটি স্ট্যাটাস": "DBT স্ট্যাটাস",

    "হাস্পাতাল": "হাসপাতাল",
    "হাসপাতল": "হাসপাতাল",
    "হসপিটাল": "হাসপাতাল",
    "হসপিটেল": "হাসপাতাল",

    "পুলিশ সটেশন": "পুলিশ স্টেশন",
    "পুলিস": "পুলিশ",
    "পুলিস থানা": "পুলিশ থানা",

    "কিষান স্টেটাস": "PM Kisan স্ট্যাটাস",
    "কিসান স্ট্যাটাস": "PM Kisan স্ট্যাটাস",
    "কৃষক বন্দু": "কৃষক বন্ধু",

    "আধার কাট": "আধার কার্ড",
    "আধার কাড": "আধার কার্ড",
    "আধার স্টেটাস": "আধার স্ট্যাটাস",

    "রেসন": "রেশন",
    "রেসন কার্ড": "রেশন কার্ড",

    "ভোটার কাড": "ভোটার কার্ড",
    "ভটার কার্ড": "ভোটার কার্ড",

    "জন্ম সার্টিফকেট": "জন্ম সার্টিফিকেট",

    "শালবনি": "শালবনী",
    "shalbani": "shalboni",
    "salbani": "salboni",

    "হাসপাতাল কাচে": "কাছাকাছি হাসপাতাল",

    "একসিডেন্ট": "দুর্ঘটনা",
    "এক্সিডেনট": "দুর্ঘটনা"
  };

  function correctSpelling(text) {
    let result = String(text || "");

    const entries = Object.entries(
      SPELLING_MAP
    ).sort((a, b) => b[0].length - a[0].length);

    for (const [wrong, right] of entries) {
      const escaped = wrong.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      result = result.replace(
        new RegExp(escaped, "gi"),
        right
      );
    }

    return result;
  }

  /*
    Smart Search-এর Enter Listener-এর সঙ্গে
    সংঘাত এড়াতে সরাসরি keydown পরিবর্তন নয়।

    অন্য Script চাইলে ব্যবহার করতে পারবে:
    window.NPCorrectSpelling("ডিবিটি")
  */

  window.NPCorrectSpelling = correctSpelling;

  /* ==========================================
     4. WHATSAPP SUPPORT CARD
     ========================================== */

  function updateSupportCards() {
    const panel = document.getElementById(
      CONFIG.panelId
    );

    if (!panel) return;

    const cards = panel.querySelectorAll(
      ".np-u-card"
    );

    cards.forEach(card => {
      const title = card.querySelector(
        ".np-u-title"
      );

      if (!title) return;

      if (
        !title.textContent.includes(
          "ব্যক্তিগত সহায়তা"
        )
      ) {
        return;
      }

      const paragraph = card.querySelector(
        ".np-u-text"
      );

      if (paragraph) {
        paragraph.textContent =
          "আবেদন, সংশোধন বা নথিপত্র সংক্রান্ত কাজে চাইলে Online পরিষেবার ব্যক্তিগত সহায়তা নিতে পারেন। এটি সম্পূর্ণ ঐচ্ছিক বেসরকারি পরিষেবা। কাজ অনুযায়ী ফি থাকতে পারে। সরকারি পোর্টালে নিজে আবেদন করার সুযোগও রয়েছে।";
      }

      const links = card.querySelectorAll("a");

      links.forEach(link => {
        if (link.href.includes("wa.me")) {
          link.classList.add(
            "np-upgrade-whatsapp"
          );

          link.textContent =
            "💬 WhatsApp-এ সহায়তা নিন";

          link.href = CONFIG.whatsapp;
        }
      });
    });
  }

  /* ==========================================
     5. GENERAL QUESTION PRESENTATION
     ========================================== */

  function updateGeneralResults() {
    const panel = document.getElementById(
      CONFIG.panelId
    );

    if (!panel) return;

    const cards = panel.querySelectorAll(
      ".np-u-card"
    );

    cards.forEach(card => {
      const title = card.querySelector(
        ".np-u-title"
      );

      if (!title) return;

      if (
        title.textContent.includes(
          "আপনার প্রশ্ন"
        )
      ) {
        title.textContent =
          "🔎 নাগরিক পরিষেবা অনুসন্ধান";

        const paragraph = card.querySelector(
          ".np-u-text"
        );

        if (paragraph) {
          paragraph.textContent =
            "সরকারি প্রকল্প, নাগরিক পরিষেবা এবং জরুরি সহায়তার বিষয়ে আরও তথ্য জানতে নিচের বোতামটি ব্যবহার করুন।";
        }

        const buttons = card.querySelectorAll(
          "button"
        );

        buttons.forEach(button => {
          if (
            button.textContent.includes(
              "বিস্তারিত উত্তর"
            )
          ) {
            button.textContent =
              "🔎 বিশদে জানতে ক্লিক করুন";
          }
        });
      }
    });
  }

  /* ==========================================
     6. CYBER MODAL SUPPORT
     ========================================== */

  /*
    Cyber Floating Button বন্ধ।

    ভবিষ্যতের Cyber Safety Service Card থেকে
    নিচের Function ব্যবহার করা যাবে:

    window.NPOpenCyberSafety()
  */

  function openCyberSafety() {
    const modal = document.getElementById(
      CONFIG.warningModalId
    );

    if (!modal) {
      console.warn(
        "Cyber Safety Modal not found"
      );

      return;
    }

    if (
      typeof window.openModal === "function"
    ) {
      window.openModal(
        CONFIG.warningModalId
      );

      return;
    }

    modal.style.display = "flex";

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  window.NPOpenCyberSafety = openCyberSafety;

  /* ==========================================
     7. SEARCH RESULT OBSERVER
     ========================================== */

  function observeSearchPanel() {
    const panel = document.getElementById(
      CONFIG.panelId
    );

    if (!panel) return;

    let updating = false;

    const observer = new MutationObserver(
      function () {
        if (updating) return;

        updating = true;

        observer.disconnect();

        try {
          updateSupportCards();
          updateGeneralResults();
        } finally {
          observer.observe(panel, {
            childList: true,
            subtree: true
          });

          updating = false;
        }
      }
    );

    observer.observe(panel, {
      childList: true,
      subtree: true
    });

    updateSupportCards();
    updateGeneralResults();
  }

  /* ==========================================
     8. INITIALIZATION
     ========================================== */

  function init() {
    addStyles();

    setupMicIndicator();

    // Spelling correction available globally
    // through window.NPCorrectSpelling

    // Cyber Floating Button disabled
    // addWarningButton();

    observeSearchPanel();

    console.info(
      "Nagorik Porisheba 2.3 UX Upgrade loaded"
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();
