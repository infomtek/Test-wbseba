(function () {
  "use strict";

  if (window.NPSmartScanner) return;

  const $ = id => document.getElementById(id);
  const state = {
    mode: "",
    qrScanner: null,
    qrScanning: false,
    fileScanner: null,
    stream: null,
    autoCaptureTimer: null,
    capturePending: false,
    autoStableFrames: 0,
    lastFrameData: null,
    image: null,
    previewUrl: "",
    worker: null,
    canvas: null,
    job: 0,
    phones: [],
    contactMeta: { name: "", org: "", email: "", website: "" },
    identity: null,
    qrPayload: ""
  };

  const modeButtons = [...document.querySelectorAll("[data-scan-mode]")];
  const choices = $("npScannerChoices");
  const workspace = $("npScannerWorkspace");
  const cameraStage = $("npScannerStage");
  const video = $("npScannerVideo");
  const previewWrap = $("npScannerPreviewWrap");
  const preview = $("npScannerPreview");
  const status = $("npScannerStatus");
  const results = $("npScannerResults");

  function setStatus(message) {
    if (status) status.textContent = message || "";
  }

  function safeRevokePreview() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = "";
    }
    if (preview) preview.removeAttribute("src");
    if (previewWrap) previewWrap.hidden = true;
    state.image = null;
  }

  async function stopQrCamera() {
    const scanner = state.qrScanner;
    const wasScanning = state.qrScanning;
    state.qrScanner = null;
    state.qrScanning = false;
    if (!scanner) return;
    try {
      if (wasScanning) await scanner.stop();
    } catch (_) {
      // The scanner may already have stopped after decoding or a browser error.
    }
    try {
      await scanner.clear();
    } catch (_) {}
    if ($("npScannerFrame")) $("npScannerFrame").hidden = true;
    if (cameraStage) cameraStage.hidden = true;
    if ($("npScannerStart")) {
      $("npScannerStart").hidden = !["qr", "camera", "gallery"].includes(state.mode);
      $("npScannerStart").textContent = state.mode === "qr" ? "QR আবার স্ক্যান করুন" : state.mode === "gallery" ? "নতুন ছবি বাছুন" : "Camera আবার চালু করুন";
    }
  }

  function stopDocumentCamera() {
    if (state.autoCaptureTimer) window.clearInterval(state.autoCaptureTimer);
    state.autoCaptureTimer = null;
    state.autoStableFrames = 0;
    state.lastFrameData = null;
    state.capturePending = false;
    const stream = state.stream;
    state.stream = null;
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (video) {
      video.pause();
      video.srcObject = null;
      video.hidden = true;
    }
    if ($("npScannerCapture")) $("npScannerCapture").hidden = true;
    if ($("npScannerStop")) $("npScannerStop").hidden = true;
    if ($("npScannerFrame")) $("npScannerFrame").hidden = true;
    if (cameraStage) cameraStage.hidden = true;
    if ($("npScannerStart")) {
      $("npScannerStart").hidden = !["camera", "qr", "gallery"].includes(state.mode);
      $("npScannerStart").textContent = state.mode === "qr" ? "QR আবার স্ক্যান করুন" : state.mode === "gallery" ? "নতুন ছবি বাছুন" : "Camera আবার চালু করুন";
    }
  }

  function tryAutomaticCapture() {
    if (!state.stream || !video?.videoWidth || state.autoCaptureTimer) return;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    state.autoCaptureTimer = window.setInterval(() => {
      if (!state.stream || video.readyState < 2) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const current = new Uint8Array(canvas.width * canvas.height);
      let edgeScore = 0;
      let difference = 0;
      for (let y = 1; y < canvas.height; y += 2) {
        for (let x = 1; x < canvas.width; x += 2) {
          const p = (y * canvas.width + x) * 4;
          const value = (pixels[p] * 3 + pixels[p + 1] * 6 + pixels[p + 2]) / 10;
          current[y * canvas.width + x] = value;
          edgeScore += Math.abs(value - (pixels[p - 4] * 3 + pixels[p - 3] * 6 + pixels[p - 2]) / 10);
          if (state.lastFrameData) difference += Math.abs(value - state.lastFrameData[y * canvas.width + x]);
        }
      }
      const samples = Math.floor((canvas.width / 2) * (canvas.height / 2));
      const sharpEnough = edgeScore / samples > 12;
      const stableEnough = state.lastFrameData && difference / samples < 10;
      state.autoStableFrames = sharpEnough && stableEnough ? state.autoStableFrames + 1 : 0;
      state.lastFrameData = current;
      if (state.autoStableFrames >= 3) {
        setStatus("ছবিটি স্থির ও পরিষ্কার মনে হচ্ছে—স্বয়ংক্রিয়ভাবে ছবি তোলা হচ্ছে।");
        captureFrame();
      }
    }, 700);
  }

  async function terminateWorker() {
    const worker = state.worker;
    state.worker = null;
    if (worker) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
  }

  async function clearTemporary({ keepMode = true, message = "" } = {}) {
    state.job += 1;
    const qrCleanup = stopQrCamera();
    const fileScanner = state.fileScanner;
    state.fileScanner = null;
    if (fileScanner) { try { void fileScanner.clear(); } catch (_) {} }
    stopDocumentCamera();
    if (state.canvas) {
      state.canvas.width = 0;
      state.canvas.height = 0;
      state.canvas = null;
    }
    safeRevokePreview();
    state.phones = [];
    state.contactMeta = { name: "", org: "", email: "", website: "" };
    state.identity = null;
    state.qrPayload = "";
    if (results) results.replaceChildren();
    const upload = $("npScannerUpload");
    if (upload) upload.value = "";
    const workerCleanup = terminateWorker();
    if (!keepMode) {
      state.mode = "";
      if (workspace) workspace.hidden = true;
      if (choices) choices.hidden = false;
      modeButtons.forEach(button => button.setAttribute("aria-pressed", "false"));
    }
    setStatus(message);
    await Promise.allSettled([qrCleanup, workerCleanup]);
  }

  async function chooseMode(mode) {
    await clearTemporary({ keepMode: true });
    state.mode = mode;
    choices.hidden = true;
    workspace.hidden = false;
    modeButtons.forEach(button => button.removeAttribute("aria-pressed"));
    $("npScannerStart").hidden = true;
    $("npScannerCapture").hidden = true;
    $("npScannerRun").textContent = "আবার পড়ুন";
    $("npScannerVideo").hidden = true;
    $("npScannerCamera").hidden = true;
    $("npScannerFrame").hidden = false;
    cameraStage.hidden = false;
    if (mode === "camera") {
      setStatus("Camera চালু হচ্ছে… নথিটি ফ্রেমের মধ্যে স্থির রাখুন।");
      void startDocumentCamera();
    } else if (mode === "qr") {
      setStatus("QR/Barcode-টি ফ্রেমের মধ্যে ধরুন।");
      void startQrCamera();
    }
  }

  async function selectGalleryImage(file) {
    if (!file || !validImage(file)) {
      if (file) setStatus("একটি JPG, PNG বা WEBP ছবি বেছে নিন।");
      return;
    }
    await clearTemporary({ keepMode: true });
    state.mode = "gallery";
    choices.hidden = true;
    workspace.hidden = false;
    $("npScannerStart").hidden = true;
    $("npScannerCapture").hidden = true;
    $("npScannerCamera").hidden = true;
    $("npScannerVideo").hidden = true;
    $("npScannerFrame").hidden = true;
    cameraStage.hidden = true;
    if (showImage(file)) void runScan();
  }

  function returnToChoices(message = "") {
    void clearTemporary({ keepMode: false, message });
    if (choices) choices.hidden = false;
  }

  function validImage(file) {
    if (!file) return false;
    const typeOkay = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const extensionOkay = /\.(jpe?g|png|webp)$/i.test(file.name || "");
    if (file.size > 15 * 1024 * 1024) {
      setStatus("ছবিটি ১৫ MB-এর বেশি। ছোট/কম রেজোলিউশনের ছবি নিন।");
      return false;
    }
    return typeOkay || (!file.type && extensionOkay);
  }

  function showImage(file) {
    if (!validImage(file)) {
      setStatus("JPG, JPEG, PNG বা WEBP ছবি বেছে নিন।");
      return false;
    }
    safeRevokePreview();
    if (results) results.replaceChildren();
    state.phones = [];
    state.contactMeta = { name: "", org: "", email: "", website: "" };
    state.identity = null;
    state.qrPayload = "";
    state.image = file;
    state.previewUrl = URL.createObjectURL(file);
    preview.src = state.previewUrl;
    previewWrap.hidden = false;
    if (cameraStage) cameraStage.hidden = true;
    $("npScannerCamera").hidden = true;
    setStatus("ছবি প্রস্তুত। ডিভাইসে স্ক্যান হচ্ছে…");
    return true;
  }

  async function startDocumentCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("এই ব্রাউজারে Camera ব্যবহার করা যাচ্ছে না। Gallery থেকে ছবি নিন।");
      return;
    }
    await clearTemporary({ keepMode: true });
    $("npScannerStart").hidden = true;
    const cameraJob = state.job;
    setStatus("Camera permission চাইলে অনুমতি দিন…");
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
      } catch (_) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
      }
      if (cameraJob !== state.job) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      state.stream = stream;
      video.srcObject = stream;
      cameraStage.hidden = false;
      video.hidden = false;
      await video.play();
      $("npScannerCapture").hidden = false;
      $("npScannerStop").hidden = false;
      $("npScannerFrame").hidden = false;
      setStatus("ক্যামেরা স্থির ও ফোকাসে থাকলে স্বয়ংক্রিয় ছবি নেওয়ার চেষ্টা করবে; চাইলে নিজে ছবি তুলুন।");
      tryAutomaticCapture();
    } catch (_) {
      stopDocumentCamera();
      setStatus("Camera চালু হয়নি। Permission বা Camera availability দেখে Gallery থেকে চেষ্টা করুন।");
    }
  }

  function captureFrame() {
    if (state.capturePending) return;
    if (!video || !state.stream || !video.videoWidth) {
      setStatus("Camera ছবি নেওয়ার জন্য প্রস্তুত নয়।");
      return;
    }
    state.capturePending = true;
    const canvas = document.createElement("canvas");
    const captureJob = state.job;
    const scale = Math.min(1, 1800 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      state.capturePending = false;
      if (captureJob !== state.job) {
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      if (!blob) {
        setStatus("ছবি তৈরি করা যায়নি। আবার চেষ্টা করুন।");
        return;
      }
      stopDocumentCamera();
      if (showImage(new File([blob], "wbseba-scan.jpg", { type: "image/jpeg" }))) void runScan();
      canvas.width = 0;
      canvas.height = 0;
    }, "image/jpeg", 0.92);
  }

  async function startQrCamera() {
    if (typeof Html5Qrcode === "undefined") {
      setStatus("QR/Barcode লাইব্রেরি লোড হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।");
      return;
    }
    await clearTemporary({ keepMode: true });
    $("npScannerStart").hidden = true;
    const cameraJob = state.job;
    $("npScannerCamera").hidden = false;
    $("npScannerFrame").hidden = false;
    cameraStage.hidden = false;
    $("npScannerStop").hidden = false;
    setStatus("কোডটি Camera-র সামনে ধরুন।");
    try {
      const scanner = new Html5Qrcode("npScannerCamera");
      state.qrScanner = scanner;
      state.qrScanning = true;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 180 } },
        async payload => {
          if (state.qrScanner !== scanner || cameraJob !== state.job) return;
          state.qrPayload = String(payload || "");
          await stopQrCamera();
          if (cameraJob !== state.job) return;
          renderQrPayload(state.qrPayload);
          setStatus(upiDetails(state.qrPayload) ? "UPI QR চেনা হয়েছে। পেমেন্ট অ্যাপে তথ্য যাচাই করে নিজে নিশ্চিত করুন।" : "কোড পড়া হয়েছে। ফলাফল ডিভাইসেই রয়েছে।");
        },
        () => {}
      );
      if (state.qrScanner !== scanner || cameraJob !== state.job) {
        try { await scanner.stop(); } catch (_) {}
        try { await scanner.clear(); } catch (_) {}
        return;
      }
    } catch (_) {
      await stopQrCamera();
      $("npScannerStop").hidden = true;
      setStatus("Camera চালু হয়নি। Permission পরীক্ষা করুন, অথবা Gallery থেকে ছবি নিন।");
    }
  }

  function numberCandidates(text) {
    const matches = String(text || "").match(/(?<!\d)(?:\+?\s*91[\s().-]*)?(?:0[\s().-]*)?(?:\d[\s().-]?){8,12}\d(?!\d)/g) || [];
    const found = [];
    const seen = new Set();
    for (const raw of matches) {
      const digits = raw.replace(/\D/g, "");
      let national = digits;
      let dial = digits;
      if (digits.length === 12 && digits.startsWith("91")) {
        national = digits.slice(2);
        dial = `+${digits}`;
      } else if (digits.length === 11 && digits.startsWith("0")) {
        national = digits.slice(1);
      }
      const mobile = national.length === 10 && /^[6-9]/.test(national);
      const landline = national.length >= 8 && national.length <= 11 && /^[0-5]/.test(national);
      if (!mobile && !landline) continue;
      if (/^(\d)\1+$/.test(national)) continue;
      const key = national.replace(/^0(?=\d{8,10}$)/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ number: raw.trim(), dial: dial.startsWith("+") ? dial : raw.trim().replace(/[^+\d]/g, ""), type: mobile ? "CELL" : "WORK,VOICE", name: "" });
    }
    return found;
  }

  function explicitName(text) {
    const source = String(text || "");
    const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/^(?:name|cardholder(?:\s+name)?|beneficiary(?:\s+name)?|member(?:\s+name)?)\s*[:\-]?\s*(.*)$/i);
      if (!match) continue;
      const candidate = match[1].trim() || lines[i + 1] || "";
      if (candidate && !/\d/.test(candidate) && /[A-Za-z]{2,}/.test(candidate) && candidate.length <= 70) {
        return candidate;
      }
    }
    const attribute = source.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "";
    if (attribute && !/\d/.test(attribute) && /[A-Za-z]{2,}/.test(attribute) && attribute.length <= 70) return attribute;
    return "";
  }

  function contactDetails(text) {
    const source = String(text || "");
    const name = explicitName(source);
    const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const website = source.match(/(?:https?:\/\/)?(?:www\.)?[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.(?:com|in|org|net|co\.in|gov\.in|edu\.in)\b/i)?.[0] || "";
    const org = source.match(/^(?:company|organization|organisation|org)\s*[:\-]?\s*(.+)$/im)?.[1]?.trim() || "";
    return { name, org, email, website };
  }

  function identityFields(text) {
    const source = String(text || "");
    const upper = source.toUpperCase();
    const name = explicitName(source);
    const pan = upper.match(/\b[A-Z]{5}\d{4}[A-Z]\b/);
    const epic = upper.match(/\b[A-Z]{3}\s?\d{7}\b/);
    const rawAadhaarUid = source.match(/\buid\s*=\s*["']?(\d{12})["']?\b/i)?.[1] || "";
    const aadhaarUid = rawAadhaarUid && !/^(\d)\1{11}$/.test(rawAadhaarUid) ? rawAadhaarUid : "";
    const groupedDigits = source.match(/(?:\d[\s-]?){11}\d/g) || [];
    const twelve = groupedDigits.map(value => value.replace(/\D/g, "")).find(value => value.length === 12 && !/^(\d)\1{11}$/.test(value));
    const fourteen = (source.match(/(?:\d[\s-]?){13}\d/g) || []).map(value => value.replace(/\D/g, "")).find(value => value.length === 14);
    const dl = upper.match(/\b[A-Z]{2}\s?\d{2}\s?\d{4}\s?\d{7,8}\b/);
    const has = pattern => pattern.test(source);
    let type = "অজানা পরিচয়পত্র";
    let idNumber = "";
    if (pan || has(/\bpan(?:\s+card)?\b/i)) { type = "PAN Card (সম্ভাব্য)"; idNumber = pan?.[0] || ""; }
    else if (epic || has(/\b(?:voter\s+id|epic)\b/i)) { type = "Voter ID / EPIC (সম্ভাব্য)"; idNumber = epic?.[0].replace(/\s/g, "") || ""; }
    else if (aadhaarUid || has(/\b(?:aadhaar|aadhar|uidai|unique identification)\b/i)) { type = "Aadhaar (সম্ভাব্য)"; idNumber = aadhaarUid || twelve || ""; }
    else if (has(/\b(?:abha|health account)\b/i) && fourteen) { type = "ABHA Health Card (সম্ভাব্য)"; idNumber = fourteen; }
    else if (has(/\b(?:driving licence|driving license|dl no|licence no|license no)\b/i)) {
      type = "Driving Licence (সম্ভাব্য)";
      idNumber = dl?.[0].replace(/\s/g, "") || source.match(/\b[A-Z]{2}\d{2}[A-Z0-9-]{8,16}\b/i)?.[0] || "";
    } else if (has(/\b(?:ration|pds|food security)\b/i)) {
      type = "Ration Card (সম্ভাব্য)";
      idNumber = source.match(/\b(?:ration\s+card|pds|food\s+security)(?:\s+(?:id|no\.?|number))?\s*[:#-]\s*([A-Z0-9-]{8,20})/i)?.[1] || twelve || "";
    } else if (has(/\b(?:ayushman|pmjay|beneficiary id|beneficiary no)\b/i)) {
      type = "Ayushman Bharat / PMJAY (সম্ভাব্য)";
      idNumber = source.match(/\b(?:ayushman(?:\s+bharat)?|pmjay|beneficiary)\s*(?:(?:id|no\.?|number)\s*)?[:#-]\s*([A-Z0-9-]{8,20})/i)?.[1] || twelve || "";
    }
    const email = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
    const phones = numberCandidates(source);
    return { type, name, idNumber, email, phones };
  }

  function copyButton(value, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "np-scanner-icon-button";
    button.setAttribute("aria-label", `${label} কপি করুন`);
    const icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = "content_copy";
    button.append(icon);
    button.addEventListener("click", async () => {
      const copied = await copyText(typeof value === "function" ? value() : value);
      if (!copied) {
        setStatus("কপি করা যায়নি। ফলাফলটি নির্বাচন করে কপি করুন।");
        return;
      }
      icon.textContent = "check";
      button.classList.add("is-copied");
      setStatus(`${label} কপি হয়েছে।`);
      window.setTimeout(() => {
        if (button.isConnected) {
          icon.textContent = "content_copy";
          button.classList.remove("is-copied");
        }
      }, 1400);
    });
    return button;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text));
      return true;
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.value = String(text);
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      let copied = false;
      try { copied = document.execCommand("copy"); } catch (_) {}
      helper.remove();
      return copied;
    }
  }

  function renderPhoneResults(phones, target = results) {
    state.phones = phones;
    target.replaceChildren();
    [["Name", state.contactMeta.name], ["Organization", state.contactMeta.org], ["Email", state.contactMeta.email], ["Website", state.contactMeta.website]].forEach(([label, value]) => {
      if (!value) return;
      const detail = document.createElement("div");
      detail.className = "np-phone-detail";
      const name = document.createElement("strong");
      name.textContent = `${label}: `;
      const content = document.createElement("span");
      content.textContent = value;
      detail.append(name, content, copyButton(value, label));
      target.append(detail);
    });
    if (!phones.length) {
      const note = document.createElement("p");
      note.textContent = "কোনো নিশ্চিত ফোন নম্বর পাওয়া যায়নি। ছবিটি ঠিক করে নিন বা নম্বর হাতে যাচাই করুন।";
      target.append(note);
      return;
    }
    phones.forEach((phone, index) => {
      const card = document.createElement("article");
      card.className = "np-phone-result";
      const row = document.createElement("div");
      row.className = "np-phone-result-row";
      const number = document.createElement("span");
      number.className = "np-phone-number";
      number.textContent = phone.number;
      const dial = document.createElement("a");
      dial.className = "np-scanner-icon-button np-dial-link";
      dial.href = `tel:${phone.dial}`;
      dial.setAttribute("aria-label", `${phone.number} ডায়াল করুন`);
      const dialIcon = document.createElement("span");
      dialIcon.className = "material-symbols-outlined";
      dialIcon.textContent = "call";
      dial.append(dialIcon);
      row.append(number, copyButton(phone.number, "ফোন নম্বর"), dial);
      card.append(row);
      const actions = document.createElement("div");
      actions.className = "np-phone-actions";
      const add = document.createElement("button");
      add.type = "button";
      add.className = "np-scanner-pill";
      add.textContent = "+ Add to Contact";
      add.addEventListener("click", () => renderContactEditor(index));
      actions.append(add);
      card.append(actions);
      target.append(card);
    });
  }

  function renderIdentity(fields) {
    state.identity = { ...fields };
    results.replaceChildren();
    const type = document.createElement("p");
    type.className = "np-id-type";
    type.textContent = `সম্ভাব্য কার্ডের ধরন: ${fields.type}`;
    results.append(type);
    if (!fields.name && !fields.idNumber) {
      const note = document.createElement("p");
      note.textContent = "নাম বা ID নম্বর নিশ্চিতভাবে পড়া যায়নি। নিজে যাচাই করে লিখুন।";
      results.append(note);
    }
    addEditableCopyRow("নাম", fields.name, value => { state.identity.name = value; });
    addEditableCopyRow("ID নম্বর", fields.idNumber, value => { state.identity.idNumber = value; });
  }

  function addEditableCopyRow(label, value, onChange) {
    const row = document.createElement("div");
    row.className = "np-id-field";
    const fieldLabel = document.createElement("label");
    fieldLabel.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.autocomplete = "off";
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => onChange(input.value));
    const copy = copyButton(() => input.value, label);
    row.append(fieldLabel, input, copy);
    results.append(row);
  }

  function renderContactEditor(index) {
    const phone = state.phones[index];
    if (!phone) return;
    results.querySelector(".np-contact-editor")?.remove();
    const form = document.createElement("form");
    form.className = "np-contact-editor";
    form.addEventListener("submit", event => event.preventDefault());
    const heading = document.createElement("h5");
    heading.textContent = "Contact তথ্য যাচাই ও সম্পাদনা করুন";
    form.append(heading);
    const fields = [
      ["Name", phone.name || (state.phones.length === 1 ? state.contactMeta.name : ""), "name"],
      ["Phone", phone.number, "tel"],
      ["Organization (ঐচ্ছিক)", state.contactMeta.org, "org"],
      ["Email (ঐচ্ছিক)", state.contactMeta.email, "email"],
      ["Website (ঐচ্ছিক)", state.contactMeta.website, "url"]
    ];
    const inputs = {};
    fields.forEach(([label, value, name]) => {
      const wrap = document.createElement("label");
      wrap.className = "np-contact-field";
      wrap.append(document.createTextNode(label));
      const input = document.createElement("input");
      input.type = name === "email" ? "email" : (name === "url" ? "url" : "text");
      input.value = value;
      input.autocomplete = "off";
      input.required = name === "tel";
      input.setAttribute("aria-label", label);
      inputs[name] = input;
      wrap.append(input);
      form.append(wrap);
    });
    const save = document.createElement("button");
    save.type = "button";
    save.className = "np-scanner-pill np-contact-save";
    save.textContent = "Contacts-এ খুলুন / .vcf তৈরি করুন";
    save.addEventListener("click", async () => {
      const tel = inputs.tel.value.trim();
      if (!tel) { setStatus("Contact-এর জন্য ফোন নম্বর লিখুন।"); return; }
      await exportContact({ name: inputs.name.value.trim(), tel, phoneType: phone.type, org: inputs.org.value.trim(), email: inputs.email.value.trim(), url: inputs.url.value.trim() });
    });
    form.append(save);
    results.append(form);
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function vCardEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  }

  async function exportContact(contact) {
    const phoneType = contact.phoneType === "CELL" ? "CELL" : "WORK,VOICE";
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${vCardEscape(contact.name)}`, `TEL;TYPE=${phoneType}:${vCardEscape(contact.tel)}`];
    if (contact.org) lines.push(`ORG:${vCardEscape(contact.org)}`);
    if (contact.email) lines.push(`EMAIL:${vCardEscape(contact.email)}`);
    if (contact.url) lines.push(`URL:${vCardEscape(contact.url)}`);
    lines.push("END:VCARD");
    const file = new File([lines.join("\r\n")], "contact.vcf", { type: "text/vcard;charset=utf-8" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Contact" });
        setStatus("Share sheet খোলা হয়েছে। Contacts বেছে নিয়ে নিজে Save নিশ্চিত করুন।");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contact.vcf";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(".vcf Contact file তৈরি হয়েছে। Contacts app-এ খুলে তথ্য দেখে Save নিশ্চিত করুন।");
  }

  function upiDetails(payload) {
    try {
      const url = new URL(String(payload || ""));
      const payeeAddress = url.searchParams.get("pa") || "";
      if (url.protocol.toLowerCase() !== "upi:" || url.hostname.toLowerCase() !== "pay" ||
          !/^[A-Z0-9._-]{2,256}@[A-Z0-9.-]{2,64}$/i.test(payeeAddress)) return null;
      const amount = url.searchParams.get("am") || "";
      const safeParams = new URLSearchParams();
      ["pa", "pn", "am", "cu", "tn", "mc"].forEach(key => {
        const value = url.searchParams.get(key);
        if (value) safeParams.set(key, value);
      });
      return {
        payeeAddress,
        payeeName: url.searchParams.get("pn") || "",
        amount: /^\d+(?:\.\d{1,2})?$/.test(amount) ? amount : "",
        currency: url.searchParams.get("cu") || "INR",
        query: safeParams.toString()
      };
    } catch (_) {
      return null;
    }
  }

  function renderQrPayload(payload) {
    state.qrPayload = String(payload || "");
    results.replaceChildren();
    const payment = upiDetails(state.qrPayload);
    if (payment) {
      const heading = document.createElement("p");
      heading.className = "np-id-type";
      heading.textContent = "UPI Payment QR";
      results.append(heading);
      const merchant = document.createElement("p");
      merchant.textContent = payment.payeeName ? "প্রাপক: " + payment.payeeName : "UPI ID: " + payment.payeeAddress;
      results.append(merchant);
      if (payment.payeeName) {
        const vpa = document.createElement("p");
        vpa.textContent = "UPI ID: " + payment.payeeAddress;
        results.append(vpa);
      }
      if (payment.amount) {
        const amount = document.createElement("p");
        amount.textContent = "পরিমাণ: " + payment.amount + " " + payment.currency;
        results.append(amount);
      }
      const note = document.createElement("p");
      note.className = "np-upi-safety-note";
      note.textContent = "Android-এর ইনস্টল করা পেমেন্ট অ্যাপ খুলবে মাত্র। প্রাপক ও পরিমাণ যাচাই করে অ্যাপের ভেতরে নিজে নিশ্চিত করুন; এখানে কোনো পেমেন্ট শুরু হয় না।";
      results.append(note);
      [
        ["BHIM", "in.org.npci.upiapp"],
        ["Google Pay", "com.google.android.apps.nbu.paisa.user"],
        ["PhonePe", "com.phonepe.app"],
        ["Paytm", "net.one97.paytm"]
      ].forEach(([name, packageId]) => {
        const link = document.createElement("a");
        link.className = "np-scanner-button np-scanner-secondary np-upi-app-link";
        link.href = "intent://pay?" + payment.query + "#Intent;scheme=upi;package=" + packageId + ";end";
        link.textContent = name + " খুলুন";
        link.setAttribute("aria-label", name + " দিয়ে পেমেন্ট অ্যাপ খুলুন; পেমেন্ট নিজে যাচাই করে নিশ্চিত করুন");
        link.rel = "noopener noreferrer";
        results.append(link);
      });
      return;
    }
    const fields = identityFields(state.qrPayload);
    if (fields.type !== "অজানা পরিচয়পত্র" && fields.idNumber) {
      renderIdentity(fields);
    } else {
      const heading = document.createElement("p");
      heading.className = "np-id-type";
      heading.textContent = "অজানা বা অসমর্থিত QR / Barcode";
      const text = document.createElement("textarea");
      text.className = "np-qr-payload";
      text.readOnly = true;
      text.value = state.qrPayload;
      text.setAttribute("aria-label", "সম্পূর্ণ decoded payload");
      results.append(heading, text, copyButton(state.qrPayload, "সম্পূর্ণ কোডের তথ্য"));
    }
  }

  async function tryDecodeImage(file, job) {
    if (typeof Html5Qrcode === "undefined") return "";
    const scanner = new Html5Qrcode("npScannerCamera");
    state.fileScanner = scanner;
    try {
      return await scanner.scanFile(file, false);
    } catch (_) {
      return "";
    } finally {
      if (state.fileScanner === scanner) state.fileScanner = null;
      try { await scanner.clear(); } catch (_) {}
    }
  }

  function loadTesseract() {
    if (window.Tesseract?.createWorker) return Promise.resolve(window.Tesseract);
    if (window.__npTesseractPromise) return window.__npTesseractPromise;
    window.__npTesseractPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => {
        if (window.Tesseract?.createWorker) resolve(window.Tesseract);
        else { window.__npTesseractPromise = null; reject(new Error("OCR library unavailable")); }
      };
      script.onerror = () => { window.__npTesseractPromise = null; reject(new Error("OCR library download failed")); };
      document.head.append(script);
    });
    return window.__npTesseractPromise;
  }

  async function createOcrWorker(job) {
    const Tesseract = await loadTesseract();
    if (job !== state.job) throw new Error("Scan cancelled");
    state.worker = await Tesseract.createWorker("eng", 1, {
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
      cacheMethod: "none",
      gzip: true,
      logger: message => {
        if (job === state.job && message?.status === "recognizing text") {
          const percent = Math.round((message.progress || 0) * 100);
          setStatus(`ছবি ডিভাইসেই পড়া হচ্ছে… ${percent}%`);
        }
      }
    });
    if (job !== state.job) {
      await state.worker.terminate();
      state.worker = null;
      throw new Error("Scan cancelled");
    }
    return state.worker;
  }

  function preprocessImage(file, job) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const temporaryUrl = URL.createObjectURL(file);
      image.onload = () => {
        if (job !== state.job) {
          URL.revokeObjectURL(temporaryUrl);
          image.src = "";
          reject(new Error("Scan cancelled"));
          return;
        }
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < frame.data.length; i += 4) {
          const gray = 0.299 * frame.data[i] + 0.587 * frame.data[i + 1] + 0.114 * frame.data[i + 2];
          const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.18 + 128));
          frame.data[i] = contrast;
          frame.data[i + 1] = contrast;
          frame.data[i + 2] = contrast;
        }
        context.putImageData(frame, 0, 0);
        URL.revokeObjectURL(temporaryUrl);
        image.src = "";
        state.canvas = canvas;
        resolve(canvas);
      };
      image.onerror = () => {
        URL.revokeObjectURL(temporaryUrl);
        reject(new Error("Image decode failed"));
      };
      image.src = temporaryUrl;
    });
  }

  async function runScan() {
    if (!state.image) {
      setStatus("আগে একটি ছবি তুলুন বা Gallery থেকে নিন।");
      return;
    }
    const job = ++state.job;
    await terminateWorker();
    state.phones = [];
    state.contactMeta = { name: "", org: "", email: "", website: "" };
    state.identity = null;
    state.qrPayload = "";
    results.replaceChildren();
    setStatus("ছবির QR/Barcode খোঁজা হচ্ছে…");
    try {
      const payload = await tryDecodeImage(state.image, job);
      if (job !== state.job) return;
      if (state.mode === "qr") {
        if (payload) {
          renderQrPayload(payload);
          setStatus(upiDetails(payload) ? "UPI QR চেনা হয়েছে। পেমেন্ট অ্যাপে তথ্য যাচাই করে নিজে নিশ্চিত করুন।" : "কোড পড়া হয়েছে। ফলাফল ডিভাইসেই রয়েছে।");
        } else {
          setStatus("এই ছবিতে সমর্থিত QR/Barcode পাওয়া যায়নি।");
        }
        return;
      }
      if (state.mode === "gallery" && payload) {
        renderQrPayload(payload);
        setStatus(upiDetails(payload) ? "UPI QR চেনা হয়েছে। পেমেন্ট অ্যাপে তথ্য যাচাই করে নিজে নিশ্চিত করুন।" : "QR/Barcode পড়া হয়েছে। ফলাফল ডিভাইসেই রয়েছে।");
        return;
      }

      setStatus("ইংরেজি লেখা ডিভাইসেই পড়া হচ্ছে…");
      const canvas = await preprocessImage(state.image, job);
      if (job !== state.job) return;
      const worker = await createOcrWorker(job);
      const recognized = await worker.recognize(canvas);
      canvas.width = 0;
      canvas.height = 0;
      state.canvas = null;
      await terminateWorker();
      if (job !== state.job) return;
      const text = recognized?.data?.text || "";
      const fields = identityFields(text);
      if (state.mode !== "qr" && fields.type !== "অজানা পরিচয়পত্র") {
        renderIdentity(fields);
        setStatus("সম্ভাব্য পরিচয়পত্রের তথ্য পাওয়া গেছে। মূল কার্ড দেখে নিজে যাচাই করুন।");
        return;
      }
      if (state.mode !== "qr") {
        const phones = numberCandidates(text);
        state.contactMeta = contactDetails(text);
        if (!phones.length && payload) {
          renderQrPayload(payload);
          setStatus("ছবির কোড পড়া হয়েছে; ফোন নম্বর OCR-এ পাওয়া যায়নি।");
        } else {
          const name = explicitName(text);
          if (phones.length === 1) phones[0].name = name;
          renderPhoneResults(phones);
          setStatus(phones.length ? `${phones.length}টি পৃথক নম্বর পাওয়া গেছে। প্রতিটি নম্বর যাচাই করুন।` : "কোনো নিশ্চিত ফোন নম্বর পাওয়া যায়নি। ছবি পরিষ্কার করে আবার চেষ্টা করুন।");
        }
      } else {
        const fields = identityFields(text);
        renderIdentity(fields);
        if (payload && !fields.idNumber && !fields.name) {
          renderQrPayload(payload);
          setStatus("ছবির কোড পড়া হয়েছে; OCR-এ পরিচয় তথ্য পাওয়া যায়নি।");
        } else {
          setStatus(fields.idNumber || fields.name ? "সম্ভাব্য তথ্য পাওয়া গেছে। মূল কার্ড দেখে নিজে যাচাই ও সংশোধন করুন।" : "পরিচয়পত্রের তথ্য নিশ্চিতভাবে পড়া যায়নি। নিজে যাচাই করুন।");
        }
      }
    } catch (_) {
      await terminateWorker();
      if (job === state.job) setStatus("ছবি পড়া যায়নি। অন্য/পরিষ্কার ছবি নিন; স্ক্যান ব্যর্থ হয়েছে বলে কোনো তথ্য সংরক্ষণ করা হয়নি।");
    }
  }

  function initialize() {
    openScannerHomeCard();
    modeButtons.forEach(button => button.addEventListener("click", () => chooseMode(button.dataset.scanMode)));
    $("npScannerBack")?.addEventListener("click", () => returnToChoices("স্ক্যানার পদ্ধতি বেছে নিন।"));
    $("npScannerStart")?.addEventListener("click", () => {
      if (state.mode === "qr") void startQrCamera();
      else if (state.mode === "gallery") $("npScannerUpload").click();
      else void startDocumentCamera();
    });
    $("npScannerStop")?.addEventListener("click", async () => {
      await stopQrCamera();
      stopDocumentCamera();
      $("npScannerCamera").replaceChildren();
      setStatus("Camera বন্ধ হয়েছে।");
    });
    $("npScannerCapture")?.addEventListener("click", captureFrame);
    $("npScannerUpload")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      event.target.value = "";
      void selectGalleryImage(file);
    });
    $("npScannerRetake")?.addEventListener("click", () => {
      if (state.mode === "camera") void startDocumentCamera();
      else if (state.mode === "qr") void startQrCamera();
      else $("npScannerUpload").click();
    });
    $("npScannerRun")?.addEventListener("click", () => void runScan());
    $("npScannerClear")?.addEventListener("click", () => void clearTemporary({ keepMode: true, message: "ছবি ও ফলাফল মুছে ফেলা হয়েছে। আবার স্ক্যান করতে নিচের নিয়ন্ত্রণ ব্যবহার করুন।" }));

    const card = $("npQrHomeCard");
    if (card) {
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", "স্মার্ট ডকুমেন্ট ও কন্টাক্ট সহায়ক খুলুন");
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          window.openModal?.("npQrScannerModal");
        }
      });
      const title = card.querySelector(".category-header-title > span");
      if (title) title.textContent = "ডকুমেন্ট ও QR স্ক্যানার";
    }
    console.info("NP Smart Scanner Ready");
  }

  function openScannerHomeCard() {
    if ($("npQrHomeCard")) return;
    const emergency = document.querySelector(".standalone-emergency-card");
    if (!emergency) return;
    const row = document.createElement("div");
    row.id = "npQrHomeRow";
    row.className = "np-qr-home-row";
    const card = document.createElement("button");
    card.id = "npQrHomeCard";
    card.type = "button";
    card.className = "category-group soft-cat-blue np-qr-home-card";
    card.innerHTML = '<span aria-hidden="true">📷</span><span>ডকুমেন্ট ও QR স্ক্যানার</span><span class="material-symbols-outlined" aria-hidden="true">qr_code_scanner</span>';
    card.addEventListener("click", () => window.openModal?.("npQrScannerModal"));
    emergency.before(row);
    row.append(emergency, card);
  }

  window.NPSmartScanner = {
    startCamera: () => state.mode === "qr" ? startQrCamera() : startDocumentCamera(),
    stopCamera: async () => { await stopQrCamera(); stopDocumentCamera(); },
    clear: () => clearTemporary({ keepMode: true }),
    onModalClose: () => clearTemporary({ keepMode: false })
  };

  window.addEventListener("pagehide", () => {
    void clearTemporary({ keepMode: false });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
