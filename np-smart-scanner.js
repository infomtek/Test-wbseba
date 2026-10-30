/* =====================================================
   NAGORIK PORISHEBA 2.5
   SMART QR & BARCODE SCANNER
   Scan → Read → Copy → Paste
   ===================================================== */

(function () {
  "use strict";

  if (window.NPSmartScanner) return;

  const state = {
    scanner: null,
    scanning: false,
    lastResult: ""
  };

  /* ---------- RESULT ---------- */

  function setResult(text) {
    const result = document.getElementById(
      "npScannerResult"
    );

    if (!result) return;

    state.lastResult = String(text);

    result.value = state.lastResult;

    result.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  /* ---------- COPY ---------- */

  async function copyResult() {
    if (!state.lastResult) {
      alert("আগে QR বা Barcode স্ক্যান করুন।");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        state.lastResult
      );

      alert("✅ স্ক্যান করা তথ্য কপি হয়েছে।");

    } catch (error) {
      const result = document.getElementById(
        "npScannerResult"
      );

      if (result) {
        result.removeAttribute("readonly");
        result.select();

        try {
          document.execCommand("copy");
          alert("✅ তথ্য কপি হয়েছে।");
        } catch {
          alert("Text নির্বাচন করে Copy করুন।");
        }

        result.setAttribute("readonly", "");
      }
    }
  }

  /* ---------- STOP CAMERA ---------- */

  async function stopCamera() {
    if (!state.scanner) return;

    try {
      if (state.scanning) {
        await state.scanner.stop();
      }

      await state.scanner.clear();

    } catch (error) {
      console.warn(
        "Scanner stop error:",
        error
      );
    }

    state.scanning = false;
    state.scanner = null;
  }

  /* ---------- CAMERA SCAN ---------- */

  /* ---------- SMART LIVE CAMERA SCAN ---------- */

async function startCamera() {
  if (state.scanning) return;

  if (typeof Html5Qrcode === "undefined") {
    alert("Scanner Library Load হয়নি।");
    return;
  }

  await stopCamera();

  try {
    state.scanner = new Html5Qrcode(
      "npScannerCamera"
    );

    state.scanning = true;

    await state.scanner.start(
      { facingMode: "environment" },
      {
        fps: 12,
        qrbox: {
          width: 250,
          height: 250
        }
      },
      decodedText => {
        if (!state.scanning) return;

        state.scanning = false;

        setResult(decodedText);

        const activeScanner = state.scanner;

        if (activeScanner) {
          activeScanner.stop()
            .then(() => activeScanner.clear())
            .catch(error => {
              console.warn("Scanner stop:", error);
            });
        }

        state.scanner = null;
      },
      () => {}
    );

  } catch (error) {
    state.scanning = false;

    console.error("Camera error:", error);

    alert(
      "Camera চালু করা যায়নি। Camera Permission পরীক্ষা করুন।"
    );
  }
}

  /* ---------- IMAGE UPLOAD SCAN ---------- */

  async function scanImage(file) {
    if (!file) return;

    if (typeof Html5Qrcode === "undefined") {
      alert("Scanner Library Load হয়নি।");
      return;
    }

    await stopCamera();

    const scanner = new Html5Qrcode(
      "npScannerCamera"
    );

    try {
      const decodedText =
        await scanner.scanFile(file, true);

      setResult(decodedText);

    } catch (error) {
      console.warn(
        "Image scan error:",
        error
      );

      alert(
        "ছবি থেকে QR বা Barcode পড়া যায়নি। পরিষ্কার ছবি ব্যবহার করুন।"
      );

    } finally {
      try {
        await scanner.clear();
      } catch {}
    }
  }
/* ===== HOMEPAGE QR SCANNER CARD ===== */

function addQrScannerHomeCard() {
  if (document.getElementById("npQrHomeCard")) return;

  const emergency = document.querySelector(
    ".standalone-emergency-card"
  );

  if (!emergency) return;

  const row = document.createElement("div");
  row.id = "npQrHomeRow";
  row.className = "np-qr-home-row";

  const card = document.createElement("div");
  card.id = "npQrHomeCard";
  card.className = "category-group soft-cat-blue np-qr-home-card";

  card.innerHTML = `
    <div class="category-header">
      <div class="category-header-title">
        <div class="category-icon-badge">📷</div>
        <span>QR & Barcode Scanner</span>
      </div>
      <span class="material-symbols-outlined category-arrow">
        qr_code_scanner
      </span>
    </div>
  `;

  card.addEventListener("click", () => {
    if (typeof window.openModal === "function") {
      window.openModal("npQrScannerModal");
    }
  });

  emergency.before(row);

  row.appendChild(emergency);
  row.appendChild(card);
}
  /* ---------- INITIALIZE ---------- */
/* ---------- HOMEPAGE SCANNER BUTTON ---------- */

/* ===== SCANNER CARD BESIDE EMERGENCY ===== */


  function initialize() {
    addQrScannerHomeCard();
     document.getElementById("npScannerStart")
      ?.addEventListener(
        "click",
        startCamera
      );

    document.getElementById("npScannerStop")
      ?.addEventListener(
        "click",
        stopCamera
      );

    document.getElementById("npScannerCopy")
      ?.addEventListener(
        "click",
        copyResult
      );

    document.getElementById("npScannerUpload")
      ?.addEventListener(
        "change",
        event => {
          scanImage(
            event.target.files?.[0]
          );
        }
      );

    console.log(
      "NP Smart QR Scanner Ready"
    );
  }

  /* ---------- PUBLIC API ---------- */

  window.NPSmartScanner = {
    startCamera,
    stopCamera,
    scanImage,
    copyResult
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
