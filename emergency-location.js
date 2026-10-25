/* ==========================================================
   NAGORIK PORISHEBA 2.0
   Emergency Location & Wildlife Assistance
   No Gemini API required
   ========================================================== */

(function () {
  "use strict";

  if (window.NPEmergencyLocationLoaded) return;
  window.NPEmergencyLocationLoaded = true;

  const CONFIG = {
    radius: 10000,
    maxResults: 8,
    timeout: 12000
  };

  const TYPES = {
    hospital: {
      title: "কাছাকাছি হাসপাতাল",
      icon: "🏥",
      emergency: "102",
      tags: [
        'node["amenity"="hospital"]',
        'way["amenity"="hospital"]',
        'node["amenity"="clinic"]',
        'way["amenity"="clinic"]'
      ]
    },

    police: {
      title: "কাছাকাছি পুলিশ স্টেশন",
      icon: "🚓",
      emergency: "112",
      tags: [
        'node["amenity"="police"]',
        'way["amenity"="police"]'
      ]
    },

    fire: {
      title: "কাছাকাছি দমকল",
      icon: "🚒",
      emergency: "112",
      tags: [
        'node["amenity"="fire_station"]',
        'way["amenity"="fire_station"]'
      ]
    },

    forest: {
      title: "বন দপ্তর ও বন্যপ্রাণী সহায়তা",
      icon: "🌳",
      emergency: "112",
      tags: [
        'node["office"="forestry"]',
        'way["office"="forestry"]',
        'node["government"="forestry"]',
        'way["government"="forestry"]'
      ]
    }
  };

  const RULES = [
    {
      type: "hospital",
      words: [
        "near hospital",
        "nearby hospital",
        "nearest hospital",
        "কাছাকাছি হাসপাতাল",
        "নিকটবর্তী হাসপাতাল",
        "হাসপাতাল কোথায়",
        "hospital near me",
        "nearby clinic"
      ]
    },
    {
      type: "police",
      words: [
        "near police",
        "nearby police",
        "nearest police",
        "police station near me",
        "কাছাকাছি পুলিশ",
        "কাছাকাছি থানা",
        "নিকটবর্তী থানা",
        "থানা কোথায়"
      ]
    },
    {
      type: "fire",
      words: [
        "near fire station",
        "nearby fire station",
        "nearest fire station",
        "কাছাকাছি দমকল",
        "নিকটবর্তী দমকল"
      ]
    },
    {
      type: "forest",
      words: [
        "forest department near",
        "nearby forest office",
        "বন দপ্তর কোথায়",
        "কাছাকাছি বন দপ্তর",
        "নিকটবর্তী বন দপ্তর"
      ]
    }
  ];

  const WILDLIFE = [
    {
      words: [
        "সাপ বেরিয়েছে",
        "সাপ বেরিয়েছে",
        "সাপ দেখা গেছে",
        "snake rescue",
        "snake in house",
        "snake at home"
      ],
      title: "🐍 সাপ দেখা গেছে",
      advice:
        "সাপ থেকে নিরাপদ দূরত্বে থাকুন। শিশু ও পোষা প্রাণীকে সরিয়ে নিন। সাপ ধরতে, মারতে বা তাড়াতে যাবেন না। স্থানীয় বন দপ্তর বা অনুমোদিত উদ্ধারকর্মীর সঙ্গে যোগাযোগ করুন।"
    },
    {
      words: [
        "পাগলা হনুমান",
        "হনুমান উপদ্রব",
        "monkey attack",
        "aggressive monkey",
        "বানরের উপদ্রব",
        "হনুমান আক্রমণ"
      ],
      title: "🐒 হনুমান বা বানরের উপদ্রব",
      advice:
        "প্রাণীটির কাছে যাবেন না, খাবার দেখাবেন না বা আক্রমণ করবেন না। শিশুদের নিরাপদে রাখুন। কামড় বা আঁচড় লাগলে ক্ষত সাবান ও প্রবাহমান জলে প্রায় ১৫ মিনিট ধুয়ে দ্রুত চিকিৎসা নিন।"
    },
    {
      words: [
        "আহত বন্যপ্রাণী",
        "মৃত বন্যপ্রাণী",
        "wildlife rescue",
        "injured animal",
        "dead wild animal",
        "আহত পাখি",
        "আহত বানর",
        "আহত হরিণ"
      ],
      title: "🦉 আহত বা মৃত বন্যপ্রাণী",
      advice:
        "প্রাণীটিকে স্পর্শ, খাওয়ানো বা সরানোর চেষ্টা করবেন না। নিরাপদ দূরত্ব বজায় রাখুন। অবস্থান ও পরিস্থিতি স্থানীয় বন দপ্তরকে জানান।"
    }
  ];

  let input;
  let box;
  let currentSearch = 0;
  let debounceTimer;

  function normalize(value) {
    return String(value || "")
      .toLocaleLowerCase()
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsAny(query, words) {
    const q = normalize(query);

    return words.some(word =>
      q.includes(normalize(word))
    );
  }

  function detect(query) {
    for (const rule of RULES) {
      if (containsAny(query, rule.words)) {
        return {
          kind: "nearby",
          type: rule.type
        };
      }
    }

    for (const rule of WILDLIFE) {
      if (containsAny(query, rule.words)) {
        return {
          kind: "wildlife",
          rule
        };
      }
    }

    return null;
  }

  function create(tag, text, className = "") {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = text;
    }

    if (className) {
      element.className = className;
    }

    return element;
  }

  function button(text, url, className) {
    const a = create("a", text, className);

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

  function mapsUrl(lat, lon) {
    return (
      "https://www.google.com/maps/dir/?api=1" +
      "&destination=" +
      encodeURIComponent(lat + "," + lon)
    );
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );
  }

  function clearBox() {
    if (box) box.replaceChildren();
  }

  function ensureBox() {
    if (!box) return false;

    box.hidden = false;
    clearBox();

    return true;
  }

  function renderHeading(text) {
    box.appendChild(
      create("h3", text, "npel-title")
    );
  }

  function renderCall(phone, label) {
    box.appendChild(
      button(
        "📞 " + label + ": " + phone,
        "tel:" + phone,
        "npel-call"
      )
    );
  }

  function showWildlife(rule) {
    currentSearch++;

    if (!ensureBox()) return;

    renderHeading(rule.title);

    box.appendChild(
      create("p", rule.advice, "npel-advice")
    );

    box.appendChild(
      create(
        "p",
        "বন দপ্তরের তথ্য খুঁজতে নিচের বাটনে চাপুন। পাওয়া নম্বর অবশ্যই যাচাই করুন।",
        "npel-note"
      )
    );

    const find = create(
      "button",
      "📍 কাছাকাছি বন দপ্তর খুঁজুন",
      "npel-action"
    );

    find.onclick = () => {
      startNearby("forest");
    };

    box.appendChild(find);

    box.appendChild(
      create(
        "p",
        "সাপে কামড়ালে বা প্রাণীর আক্রমণে গুরুতর আহত হলে জরুরি চিকিৎসা নিন।",
        "npel-note"
      )
    );
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("GPS unavailable"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false,
          timeout: CONFIG.timeout,
          maximumAge: 120000
        }
      );
    });
  }

  async function queryOverpass(lat, lon, type) {
    const options = TYPES[type];

    const selectors = options.tags.map(tag =>
      tag.replace(
        "]",
        `](around:${CONFIG.radius},${lat},${lon})`
      ) + ";"
    ).join("\n");

    const query = `
      [out:json][timeout:20];
      (
        ${selectors}
      );
      out center;
    `;

    const response = await fetch(
      "https://overpass.kumi.systems/api/interpreter",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "data=" + encodeURIComponent(query)
      }
    );

    if (!response.ok) {
      throw new Error("Map service unavailable");
    }

    const data = await response.json();

    if (!Array.isArray(data.elements)) {
      return [];
    }

    return data.elements
      .map(item => {
        const latitude =
          item.lat ?? item.center?.lat;

        const longitude =
          item.lon ?? item.center?.lon;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        const tags = item.tags || {};

        return {
          name:
            tags["name:bn"] ||
            tags.name ||
            options.title,

          lat: latitude,
          lon: longitude,

          phone: validPhone(
            tags["contact:phone"] ||
            tags.phone ||
            ""
          ),

          address: [
            tags["addr:street"],
            tags["addr:city"],
            tags["addr:postcode"]
          ].filter(Boolean).join(", "),

          distance: distanceKm(
            lat,
            lon,
            latitude,
            longitude
          )
        };
      })
      .filter(Boolean)
      .sort((a, b) =>
        a.distance - b.distance
      )
      .slice(0, CONFIG.maxResults);
  }

  function renderPlaces(places, type) {
    const config = TYPES[type];

    if (!places.length) {
      box.appendChild(
        create(
          "p",
          "এই এলাকায় OpenStreetMap থেকে নির্দিষ্ট প্রতিষ্ঠানের তথ্য পাওয়া যায়নি। এর অর্থ এই নয় যে এখানে প্রতিষ্ঠান নেই। জরুরি প্রয়োজনে নিচের নম্বরে যোগাযোগ করুন।",
          "npel-note"
        )
      );

      return;
    }

    places.forEach(place => {
      const row = create(
        "div",
        undefined,
        "npel-place"
      );

      row.appendChild(
        create(
          "strong",
          place.name
        )
      );

      row.appendChild(
        create(
          "small",
          "📍 আনুমানিক সরলরেখার দূরত্ব: " +
          place.distance.toFixed(1) +
          " কিমি"
        )
      );

      if (place.address) {
        row.appendChild(
          create("small", place.address)
        );
      }

      const actions = create(
        "div",
        undefined,
        "npel-actions"
      );

      actions.appendChild(
        button(
          "🗺️ যাওয়ার রাস্তা",
          mapsUrl(place.lat, place.lon),
          "npel-map"
        )
      );

      if (place.phone) {
        actions.appendChild(
          button(
            "📞 " + place.phone,
            "tel:" + place.phone,
            "npel-call"
          )
        );
      }

      row.appendChild(actions);

      box.appendChild(row);
    });
  }

  async function startNearby(type) {
    const config = TYPES[type];

    if (!config || !ensureBox()) return;

    const searchId = ++currentSearch;

    renderHeading(
      config.icon + " " + config.title
    );

    renderCall(
      config.emergency,
      "জরুরি সহায়তা"
    );

    box.appendChild(
      create(
        "p",
        "আপনার অনুমতি নিয়ে অবস্থান খুঁজছি...",
        "npel-status"
      )
    );

    try {
      const position = await getPosition();

      if (searchId !== currentSearch) return;

      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      const accuracy =
        Math.round(position.coords.accuracy);

      clearBox();

      renderHeading(
        config.icon + " " + config.title
      );

      renderCall(
        config.emergency,
        "জরুরি সহায়তা"
      );

      box.appendChild(
        create(
          "p",
          "GPS অবস্থান পাওয়া গেছে। আনুমানিক নির্ভুলতা: " +
          accuracy +
          " মিটার। আশপাশের তথ্য খোঁজা হচ্ছে...",
          "npel-status"
        )
      );

      const places = await queryOverpass(
        latitude,
        longitude,
        type
      );

      if (searchId !== currentSearch) return;

      clearBox();

      renderHeading(
        config.icon + " " + config.title
      );

      renderCall(
        config.emergency,
        "জরুরি সহায়তা"
      );

      renderPlaces(places, type);

      box.appendChild(
        create(
          "p",
          "তথ্যসূত্র: OpenStreetMap। স্থান, ফোন নম্বর ও খোলা থাকার সময় পরিবর্তিত হতে পারে। জরুরি ক্ষেত্রে ফোনে নিশ্চিত করুন।",
          "npel-note"
        )
      );

    } catch (error) {
      if (searchId !== currentSearch) return;

      clearBox();

      renderHeading(
        config.icon + " " + config.title
      );

      renderCall(
        config.emergency,
        "জরুরি সহায়তা"
      );

      box.appendChild(
        create(
          "p",
          "GPS অনুমতি পাওয়া যায়নি অথবা মানচিত্র সার্ভার সাড়া দেয়নি। ব্রাউজারে Location অনুমতি চালু করে আবার চেষ্টা করতে পারেন।",
          "npel-note"
        )
      );

      const retry = create(
        "button",
        "🔄 আবার চেষ্টা করুন",
        "npel-action"
      );

      retry.onclick = () => {
        startNearby(type);
      };

      box.appendChild(retry);
    }
  }

  function handleSearch(query) {
    const detected = detect(query);

    if (!detected) {
      currentSearch++;

      if (box) box.hidden = true;

      return;
    }

    if (detected.kind === "wildlife") {
      showWildlife(detected.rule);
      return;
    }

    if (!ensureBox()) return;

    currentSearch++;

    const config = TYPES[detected.type];

    renderHeading(
      config.icon + " " + config.title
    );

    renderCall(
      config.emergency,
      "জরুরি সহায়তা"
    );

    box.appendChild(
      create(
        "p",
        "আপনার কাছাকাছি প্রতিষ্ঠান খুঁজতে Location অনুমতি প্রয়োজন।",
        "npel-note"
      )
    );

    const find = create(
      "button",
      "📍 কাছাকাছি খুঁজুন",
      "npel-action"
    );

    find.onclick = () => {
      startNearby(detected.type);
    };

    box.appendChild(find);
  }

  function addStyles() {
    const style = document.createElement("style");

    style.textContent = `
      #npEmergencyLocation {
        margin: 14px;
        padding: 16px;
        border: 1px solid #bfdbfe;
        border-radius: 20px;
        background: var(--container-bg, #fff);
        color: var(--text-main, #0f172a);
        box-shadow: 0 8px 25px rgba(15,23,42,.08);
      }

      #npEmergencyLocation[hidden] {
        display: none !important;
      }

      .npel-title {
        font-size: 17px;
        font-weight: 800;
        margin-bottom: 12px;
      }

      .npel-advice,
      .npel-note,
      .npel-status {
        font-size: 12.5px;
        line-height: 1.9;
        margin: 10px 0;
      }

      .npel-note {
        opacity: .8;
      }

      .npel-action,
      .npel-call,
      .npel-map {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 11px 14px;
        border: none;
        border-radius: 11px;
        font-size: 12px;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
        min-height: 44px;
        margin: 5px 5px 5px 0;
      }

      .npel-action,
      .npel-map {
        background: #2563eb;
        color: #fff;
      }

      .npel-call {
        background: #16a34a;
        color: #fff;
      }

      .npel-place {
        padding: 13px;
        margin-top: 10px;
        border: 1px solid var(--card-border, #e2e8f0);
        border-radius: 13px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .npel-place strong {
        font-size: 13px;
      }

      .npel-place small {
        font-size: 11.5px;
        line-height: 1.6;
        opacity: .8;
      }

      .npel-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }

      @media (min-width: 768px) {
        #npEmergencyLocation {
          max-width: 750px;
          margin: 16px auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function initialize() {
    input = document.getElementById("searchInput");

    if (!input) return;

    if (
      document.getElementById(
        "npEmergencyLocation"
      )
    ) {
      return;
    }

    addStyles();

    box = create("section");

    box.id = "npEmergencyLocation";

    box.hidden = true;

    box.setAttribute(
      "aria-label",
      "জরুরি লোকেশন সহায়তা"
    );

    const smartPanel =
      document.getElementById("npSmartPanel");

    if (smartPanel) {
      smartPanel.before(box);
    } else {
      document.querySelector(".app-header")
        ?.after(box);
    }

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        handleSearch(input.value);
      }, 350);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        handleSearch(input.value);
      }
    });

    console.log(
      "Nagorik Emergency Location Engine Ready"
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
