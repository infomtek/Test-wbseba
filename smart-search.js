/* =====================================================
   NAGORIK PORISHEBA 2.0
   Location-Aware Emergency Search
   ===================================================== */

(function () {
  "use strict";

  const LOCATION_ALIASES = {
    "ghatal": "ঘাটাল",
    "ঘাটাল": "ঘাটাল",
    "medinipur": "মেদিনীপুর",
    "midnapore": "মেদিনীপুর",
    "মেদিনীপুর": "মেদিনীপুর",
    "kolkata": "কলকাতা",
    "calcutta": "কলকাতা",
    "কলকাতা": "কলকাতা",
    "howrah": "হাওড়া",
    "হাওড়া": "হাওড়া",
    "arambagh": "আরামবাগ",
    "আরামবাগ": "আরামবাগ"
  };

  const DEPARTMENTS = [
    {
      name: "পুলিশ",
      words: [
        "police",
        "পুলিশ",
        "থানা",
        "police station"
      ],
      emergency: "112",
      tab: "police"
    },
    {
      name: "হাসপাতাল",
      words: [
        "hospital",
        "হাসপাতাল",
        "medical",
        "health",
        "চিকিৎসা"
      ],
      emergency: "102",
      tab: "health"
    },
    {
      name: "অ্যাম্বুলেন্স",
      words: [
        "ambulance",
        "অ্যাম্বুলেন্স",
        "রোগী পরিবহন"
      ],
      emergency: "102",
      tab: "health"
    },
    {
      name: "দমকল",
      words: [
        "fire station",
        "fire brigade",
        "দমকল",
        "fire service"
      ],
      emergency: "112",
      tab: "admin"
    },
    {
      name: "বিদ্যুৎ অফিস",
      words: [
        "electric",
        "electricity",
        "wbsedcl",
        "বিদ্যুৎ",
        "কারেন্ট"
      ],
      emergency: "19121",
      tab: "utility"
    }
  ];

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFC")
      .trim();
  }

  function detectLocation(query) {
    const text = normalize(query);

    for (const alias in LOCATION_ALIASES) {
      if (text.includes(alias)) {
        return LOCATION_ALIASES[alias];
      }
    }

    return "";
  }

  function detectDepartment(query) {
    const text = normalize(query);

    return DEPARTMENTS.find(dept =>
      dept.words.some(word =>
        text.includes(normalize(word))
      )
    );
  }

  function getLocationDirectory(location) {
    try {
      if (
        typeof emergencyDirectoryData === "undefined"
      ) {
        return null;
      }

      for (const district in emergencyDirectoryData) {
        const subdivisions =
          emergencyDirectoryData[district];

        if (subdivisions[location]) {
          return {
            district,
            subdivision: location,
            records: subdivisions[location]
          };
        }
      }
    } catch (error) {
      console.warn("Directory lookup error:", error);
    }

    return null;
  }

  function make(tag, text, className = "") {
    const node = document.createElement(tag);

    node.textContent = text;

    if (className) {
      node.className = className;
    }

    return node;
  }

  function showLocationResult(query) {
    const location = detectLocation(query);
    const department = detectDepartment(query);

    if (!department) return false;

    const panel = document.getElementById("npSmartPanel");

    if (!panel) return false;

    const directory = location
      ? getLocationDirectory(location)
      : null;

    const box = document.createElement("div");

    box.style.cssText = `
      padding:15px;
      margin-top:12px;
      border:2px solid #3b82f6;
      border-radius:16px;
      background:#eff6ff;
      color:#1e3a8a;
    `;

    box.appendChild(
      make(
        "h3",
        "📍 " +
        (location || "আপনার এলাকা") +
        " — " +
        department.name
      )
    );

    const emergency = document.createElement("a");

    emergency.href = "tel:" + department.emergency;

    emergency.textContent =
      "📞 জরুরি সহায়তা: " +
      department.emergency;

    emergency.style.cssText = `
      display:inline-block;
      margin-top:12px;
      padding:11px 15px;
      border-radius:10px;
      background:#16a34a;
      color:#ffffff;
      font-weight:800;
      text-decoration:none;
    `;

    box.appendChild(emergency);

    if (directory) {
      const records = directory.records.filter(
        item => item.type === department.tab
      );

      records.forEach(item => {
        const row = document.createElement("div");

        row.style.cssText = `
          margin-top:12px;
          padding:10px;
          border-radius:10px;
          background:#ffffff;
          border:1px solid #bfdbfe;
        `;

        row.appendChild(
          make("strong", item.name)
        );

        const approved =
          typeof verifiedContactsDB !== "undefined"
            ? verifiedContactsDB[location]?.[item.name]
            : "";

        const phone = approved || item.phone;

        if (phone && /^\+?[\d\s-]{8,18}$/.test(phone)) {
          const call = document.createElement("a");

          call.href =
            "tel:" +
            phone.replace(/[^\d+]/g, "");

          call.textContent =
            " 📞 " + phone;

          call.style.cssText = `
            display:block;
            margin-top:7px;
            font-weight:800;
            color:#15803d;
          `;

          row.appendChild(call);
        } else {
          row.appendChild(
            make(
              "p",
              "স্থানীয় নম্বর এখনও উপলব্ধ নয়।"
            )
          );
        }

        box.appendChild(row);
      });
    }

    const existing =
      document.getElementById("npLocationResult");

    if (existing) existing.remove();

    box.id = "npLocationResult";

    panel.prepend(box);

    panel.hidden = false;

    return true;
  }

  function initialize() {
    const input = document.getElementById(
      "searchInput"
    );

    if (!input) return;

    let timer;

    input.addEventListener("input", () => {
      clearTimeout(timer);

      timer = setTimeout(() => {
        const text = input.value.trim();

        if (!text) {
          document.getElementById(
            "npLocationResult"
          )?.remove();

          return;
        }

        showLocationResult(text);

      }, 400);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        setTimeout(() => {
          showLocationResult(input.value);
        }, 50);
      }
    });

    console.log(
      "Location-Aware Emergency Search Ready"
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
