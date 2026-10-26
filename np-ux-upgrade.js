/* =====================================================
   NAGORIK PORISHEBA 2.1
   Citizen Experience Upgrade
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

      /* WARNING FLOATING BUTTON */

      #npWarningFloat {
        width: 49px;
        height: 49px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg,#f59e0b,#ea580c);
        color: white;
        font-size: 23px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 5px 18px rgba(234,88,12,.3);
        transition: transform .2s ease;
      }

      #npWarningFloat:hover {
        transform: translateY(-3px);
      }

      #npWarningFloat:focus-visible {
        outline: 3px solid #2563eb;
        outline-offset: 3px;
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

    if (!mic) return;

    const search = document.getElementById(CONFIG.searchId);

    const status = document.createElement("div");

    status.className = "np-mic-status";
    status.textContent = "🎙️ আপনার কথা শুনছি…";

    if (search && search.parentElement) {
      search.parentElement.insertAdjacentElement("afterend", status);
    }

    let listening = false;

    function setListening(active) {
      listening = active;

      const currentMic = document.getElementById(CONFIG.micId);

      if (currentMic) {
        currentMic.classList.toggle("np-mic-active", active);

        currentMic.setAttribute(
          "aria-label",
          active ? "মাইক্রোফোন চালু আছে" : "ভয়েস সার্চ"
        );
      }

      status.classList.toggle("active", active);
    }

    /*
      Existing unified-search.js creates the SpeechRecognition
      instance internally. We wrap the browser constructor to
      receive the real start/end events.
    */

    const NativeRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!NativeRecognition) return;

    function WrappedRecognition() {
      const recognition = new NativeRecognition();

      recognition.addEventListener("start", function () {
        setListening(true);
      });

      recognition.addEventListener("end", function () {
        setListening(false);
      });

      recognition.addEventListener("error", function () {
        setListening(false);
      });

      recognition.addEventListener("result", function () {
        setListening(false);
      });

      return recognition;
    }

    window.SpeechRecognition = WrappedRecognition;
    window.webkitSpeechRecognition = WrappedRecognition;

    window.addEventListener("pagehide", function () {
      if (listening) setListening(false);
    });
  }

  /* ==========================================
     3. COMMON SPELLING CORRECTIONS
     ========================================== */

  const SPELLING_MAP = {
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

    const entries = Object.entries(SPELLING_MAP)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [wrong, right] of entries) {
      const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      result = result.replace(
        new RegExp(escaped, "gi"),
        right
      );
    }

    return result;
  }

  function setupSpellingSupport() {
    const input = document.getElementById(CONFIG.searchId);

    if (!input) return;

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;

      const corrected = correctSpelling(input.value);

      if (corrected !== input.value) {
        input.value = corrected;
      }
    }, true);
  }

  /* ==========================================
     4. WHATSAPP SUPPORT CARD
     ========================================== */

  function updateSupportCards() {
    const panel = document.getElementById(CONFIG.panelId);

    if (!panel) return;

    const cards = panel.querySelectorAll(".np-u-card");

    cards.forEach(card => {
      const title = card.querySelector(".np-u-title");

      if (!title) return;

      if (!title.textContent.includes("ব্যক্তিগত সহায়তা")) {
        return;
      }

      const paragraph = card.querySelector(".np-u-text");

      if (paragraph) {
        paragraph.textContent =
          "আবেদন, সংশোধন বা নথিপত্র সংক্রান্ত কাজে চাইলে Online পরিষেবার ব্যক্তিগত সহায়তা নিতে পারেন। এটি সম্পূর্ণ ঐচ্ছিক বেসরকারি পরিষেবা। কাজ অনুযায়ী ফি থাকতে পারে। সরকারি পোর্টালে নিজে আবেদন করার সুযোগও রয়েছে।";
      }

      const links = card.querySelectorAll("a");

      links.forEach(link => {
        if (link.href.includes("wa.me")) {
          link.classList.add("np-upgrade-whatsapp");

          link.textContent = "💬 WhatsApp-এ সহায়তা নিন";

          link.href = CONFIG.whatsapp;
        }
      });
    });
  }

  /* ==========================================
     5. GENERAL QUESTION PRESENTATION
     ========================================== */

  function updateGeneralResults() {
    const panel = document.getElementById(CONFIG.panelId);

    if (!panel) return;

    const cards = panel.querySelectorAll(".np-u-card");

    cards.forEach(card => {
      const title = card.querySelector(".np-u-title");

      if (!title) return;

      if (title.textContent.includes("আপনার প্রশ্ন")) {
        title.textContent = "🔎 নাগরিক পরিষেবা অনুসন্ধান";

        const paragraph = card.querySelector(".np-u-text");

        if (paragraph) {
          paragraph.textContent =
            "সরকারি প্রকল্প, নাগরিক পরিষেবা এবং জরুরি সহায়তার বিষয়ে আরও তথ্য জানতে নিচের বোতামটি ব্যবহার করুন।";
        }

        const buttons = card.querySelectorAll("button");

        buttons.forEach(button => {
          if (button.textContent.includes("বিস্তারিত উত্তর")) {
            button.textContent = "🔎 বিশদে জানতে ক্লিক করুন";
          }
        });
      }
    });
  }

  /* ==========================================
     6. FLOATING WARNING BUTTON
     ========================================== */

  function openWarning() {
    const modal = document.getElementById(
      CONFIG.warningModalId
    );

    if (typeof window.openModal === "function") {
      window.openModal(CONFIG.warningModalId);
      return;
    }

    if (modal) {
      modal.style.display = "flex";
    }
  }

  function addWarningButton() {
    if (document.getElementById("npWarningFloat")) return;

    const button = document.createElement("button");

    button.id = "npWarningFloat";
    button.type = "button";
    button.textContent = "⚠️";

    button.title = "সাইবার নিরাপত্তা সতর্কবার্তা";

    button.setAttribute(
      "aria-label",
      "সাইবার নিরাপত্তা সতর্কবার্তা আবার দেখুন"
    );

    button.addEventListener("click", openWarning);

    const group = document.querySelector(
      ".floating-action-group"
    );

    if (group) {
      group.appendChild(button);
    } else {
      button.style.position = "fixed";
      button.style.right = "16px";
      button.style.bottom = "225px";
      button.style.zIndex = "999";

      document.body.appendChild(button);
    }
  }

  /* ==========================================
     7. OBSERVE SEARCH RESULT UPDATES
     ========================================== */

  function observeSearchPanel() {
    const panel = document.getElementById(CONFIG.panelId);

    if (!panel) return;

    let updating = false;

    const observer = new MutationObserver(function () {
      if (updating) return;

      updating = true;

      observer.disconnect();

      updateSupportCards();
      updateGeneralResults();

      observer.observe(panel, {
        childList: true,
        subtree: true
      });

      updating = false;
    });

    observer.observe(panel, {
      childList: true,
      subtree: true
    });

    updateSupportCards();
    updateGeneralResults();
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  function init() {
    addStyles();

    setupMicIndicator();

    setupSpellingSupport();

    addWarningButton();

    observeSearchPanel();

    console.info(
      "Nagorik Porisheba 2.1 UX Upgrade loaded"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
