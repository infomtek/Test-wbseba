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

      await state.scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        decodedText => {
          setResult(decodedText);
          stopCamera();
        },
        () => {}
      );

      state.scanning = true;

    } catch (error) {
      state.scanning = false;

      console.error(
        "Camera scanner error:",
        error
      );

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

  /* ---------- INITIALIZE ---------- */
/* ---------- HOMEPAGE SCANNER BUTTON ---------- */

/* ===== SCANNER CARD BESIDE EMERGENCY ===== */


  function initialize() {
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
