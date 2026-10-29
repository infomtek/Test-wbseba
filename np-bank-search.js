/* np-bank-search.js — Smart Bank Search (নাগরিক পরিষেবা 2.4)
   শুধু বিদ্যমান "ব্যাংক ব্যালেন্স চেক" Card/Modal খোলে।
   কোনো নতুন Phone Number বা Link তৈরি করে না। */
(function () {
  "use strict";
  if (window.NPBankSearch) return;

  const BANKS = [
    { id: "sbi", label: "🏦 SBI — স্টেট ব্যাংক অফ ইন্ডিয়া ব্যালেন্স", filter: "sbi",
      aliases: ["sbi", "sbi balance", "state bank", "state bank of india", "এসবিআই", "এস বি আই",
        "এসবি আই", "এস বি আই ব্যালেন্স", "স্টেট ব্যাংক", "স্টেট ব্যাঙ্ক", "স্টেট ব্যাংক অফ ইন্ডিয়া",
        "স্টেট ব্যাংক অব ইন্ডিয়া", "ষ্টেট ব্যাংক", "স্টেট বাংক", "এসবয়সেই বি আই"] },
    { id: "pnb", label: "🏦 PNB — পাঞ্জাব ন্যাশনাল ব্যাংক ব্যালেন্স", filter: "pnb",
      aliases: ["pnb", "punjab national", "punjab national bank", "পিএনবি", "পি এন বি",
        "পাঞ্জাব ন্যাশনাল", "পাঞ্জাব ন্যাশনাল ব্যাংক", "পাঞ্জাব নেশনাল"] },
    { id: "bob", label: "🏦 Bank of Baroda ব্যালেন্স", filter: "bob",
      aliases: ["bob", "bank of baroda", "baroda", "বিওবি", "বি ও বি", "ব্যাংক অফ বরোদা",
        "ব্যাংক অব বরোদা", "বরোদা"] },
    { id: "boi", label: "🏦 Bank of India ব্যালেন্স", filter: "bank of india",
      aliases: ["boi", "bank of india", "বিওআই", "বি ও আই", "ব্যাংক অফ ইন্ডিয়া", "ব্যাংক অব ইন্ডিয়া"] },
    { id: "uco", label: "🏦 UCO Bank ব্যালেন্স", filter: "uco",
      aliases: ["uco", "uco bank", "ইউকো", "ইউ সি ও", "ইউকো ব্যাংক"] },
    { id: "central", label: "🏦 Central Bank of India ব্যালেন্স", filter: "central bank",
      aliases: ["central bank", "central bank of india", "সেন্ট্রাল ব্যাংক", "সেন্ট্রাল ব্যাংক অফ ইন্ডিয়া"] },
    { id: "axis", label: "🏦 Axis Bank ব্যালেন্স", filter: "axis",
      aliases: ["axis", "axis bank", "অ্যাক্সিস", "এক্সিস", "আক্সিস", "অ্যাক্সিস ব্যাংক"] },
    { id: "hdfc", label: "🏦 HDFC Bank ব্যালেন্স", filter: "hdfc",
      aliases: ["hdfc", "hdfc bank", "এইচডিএফসি", "এইচ ডি এফ সি", "এইচডিএফসি ব্যাংক"] },
    { id: "icici", label: "🏦 ICICI Bank ব্যালেন্স", filter: "icici",
      aliases: ["icici", "icici bank", "আইসিআইসিআই", "আই সি আই সি আই"] },
    { id: "bandhan", label: "🏦 Bandhan Bank ব্যালেন্স", filter: "bandhan",
      aliases: ["bandhan", "bandhan bank", "বন্ধন", "বন্ধন ব্যাংক"] },
    { id: "bgvb", label: "🏦 বঙ্গীয় গ্রামীণ বিকাশ ব্যাংক ব্যালেন্স", filter: "bgvb",
      aliases: ["bgvb", "bangiya gramin", "bangiya gramin vikash bank", "বঙ্গীয় গ্রামীণ",
        "বঙ্গীয় গ্রামীণ বিকাশ ব্যাংক", "গ্রামীণ ব্যাংক"] },
    { id: "pbgb", label: "🏦 পশ্চিমবঙ্গ গ্রামীণ ব্যাংক ব্যালেন্স", filter: "pbgb",
      aliases: ["pbgb", "paschim banga gramin", "paschim banga gramin bank",
        "পশ্চিমবঙ্গ গ্রামীণ", "পশ্চিমবঙ্গ গ্রামীণ ব্যাংক"] },
    { id: "all", label: "🏦 ব্যাংক ব্যালেন্স চেক — সব ব্যাংক", filter: "",
      aliases: ["bank balance", "balance check", "bank", "balance", "missed call balance",
        "ব্যাংক ব্যালেন্স", "ব্যাংক", "ব্যালেন্স", "ব্যালান্স", "ব্যালেন্স চেক", "মিসকল ব্যালেন্স"] }
  ];

  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[\u200c\u200d]/g, "")
      .replace(/ঙ্ক/g, "ংক")
      .replace(/[\s.\-_,।\/&()]+/g, "");
  }

  BANKS.forEach(b => { b.keys = b.aliases.map(norm).filter(Boolean); });

  function findBanks(query) {
    const q = norm(query);
    if (q.length < 2) return [];
    const out = [];
    BANKS.forEach(b => {
      let best = 0;
      b.keys.forEach(k => {
        let s = 0;
        if (k === q) s = 100;
        else if (k.startsWith(q)) s = 80;
        else if (k.length >= 3 && q.includes(k)) s = 70;
        else if (q.length >= 3 && k.includes(q)) s = 50;
        if (s > best) best = s;
      });
      if (best) out.push({ bank: b, score: best });
    });
    out.sort((a, b) =>
      b.score - a.score || (a.bank.id === "all") - (b.bank.id === "all"));
    return out.slice(0, 6);
  }

  // ➤/Enter-এ সরাসরি খোলা হবে শুধু যখন একটি ব্যাংক স্পষ্টভাবে মেলে
  function decisive(list) {
    if (!list.length) return null;
    if (list[0].score >= 100) return list[0].bank;
    if (list[0].score >= 70 &&
        (list.length === 1 || list[1].score < list[0].score)) return list[0].bank;
    return null;
  }

  function findBankCard() {
    const target = norm("ব্যাংক ব্যালেন্স");
    return Array.from(document.querySelectorAll(".service-card")).find(c => {
      const t = norm(c.textContent);
      return t.includes(target) || t.includes("bankbalance");
    });
  }

  function openBank(bank) {
    const card = findBankCard();
    if (!card) {
      console.warn("ব্যাংক ব্যালেন্স কার্ড পাওয়া যায়নি");
      return;
    }
    card.click();
    if (!bank.filter) return;
    setTimeout(() => {
      const f = document.querySelector(
        'input[oninput*="filterBankList"], input[onkeyup*="filterBankList"], input[onchange*="filterBankList"]');
      if (f) {
        f.value = bank.filter;
        f.dispatchEvent(new Event("input", { bubbles: true }));
        f.dispatchEvent(new Event("keyup", { bubbles: true }));
      }
    }, 350);
  }

  function getBox(input) {
    let box = document.querySelector(".np-suggestion-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "np-suggestion-box";
      input.parentNode.appendChild(box);
    }
    if (getComputedStyle(box).position === "static") {
      Object.assign(box.style, {
        position: "absolute", top: "calc(100% + 6px)", left: "0", right: "0",
        background: "#ffffff", borderRadius: "12px",
        boxShadow: "0 10px 25px rgba(0,0,0,.15)", zIndex: "10000",
        maxHeight: "320px", overflowY: "auto"
      });
    }
    return box;
  }

  function hideBox() {
    const box = document.querySelector(".np-suggestion-box");
    if (box) box.style.display = "none";
  }

  function render(input) {
    const box = getBox(input);
    box.querySelectorAll(".np-bank-sug").forEach(el => el.remove());
    const list = findBanks(input.value);
    if (!list.length) return;

    const frag = document.createDocumentFragment();
    list.forEach(({ bank }) => {
      const item = document.createElement("div");
      item.className = "np-suggestion-item np-bank-sug";
      item.textContent = bank.label;
      item.style.cssText =
        "padding:11px 14px;cursor:pointer;color:#1e293b;font-size:15px;" +
        "border-bottom:1px solid #eef2f7;background:#ffffff;";
      item.addEventListener("mousedown", e => e.preventDefault());
      item.addEventListener("click", e => {
        e.stopPropagation();
        hideBox();
        openBank(bank);
      });
      frag.appendChild(item);
    });
    box.insertBefore(frag, box.firstChild);
    box.style.display = "block";
  }

  // টাইপ করলে: পুরোনো Suggestion Code-এর পরে ব্যাংকের Suggestion যোগ
  document.addEventListener("input", e => {
    if (e.target && e.target.id === "searchInput") {
      const input = e.target;
      setTimeout(() => render(input), 0);
    }
  });

  // Enter: স্পষ্ট ব্যাংক মিললে সরাসরি ব্যাংক Modal
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target || e.target.id !== "searchInput") return;
    const bank = decisive(findBanks(e.target.value));
    if (!bank) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hideBox();
    openBank(bank);
  }, true);

  // ➤ Button: স্পষ্ট ব্যাংক মিললে সরাসরি ব্যাংক Modal
  document.addEventListener("click", e => {
    const arrow = e.target.closest && e.target.closest(".np-search-arrow");
    if (!arrow) return;
    const input = document.getElementById("searchInput");
    const bank = input && decisive(findBanks(input.value));
    if (!bank) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hideBox();
    openBank(bank);
  }, true);

  window.NPBankSearch = { find: findBanks, open: openBank };
  console.info("Nagorik Porisheba Smart Bank Search loaded");
})();
