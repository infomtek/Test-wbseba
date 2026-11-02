(function () {
  "use strict";

  if (window.NPSmartScanner) return;

  const $ = id => document.getElementById(id);
  const state = {
    mode: "",
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
    contactMeta: { name: "", org: "", email: "", website: "" }
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
      $("npScannerStart").hidden = !["camera", "gallery"].includes(state.mode);
      $("npScannerStart").textContent = state.mode === "gallery" ? "নতুন ছবি বাছুন" : "Camera আবার চালু করুন";
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
    stopDocumentCamera();
    if (state.canvas) {
      state.canvas.width = 0;
      state.canvas.height = 0;
      state.canvas = null;
    }
    safeRevokePreview();
    state.phones = [];
    state.contactMeta = { name: "", org: "", email: "", website: "" };
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
    await workerCleanup;
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
    $("npScannerFrame").hidden = false;
    cameraStage.hidden = false;
    if (mode === "camera") {
      setStatus("Camera চালু হচ্ছে… নথিটি ফ্রেমের মধ্যে স্থির রাখুন।");
      void startDocumentCamera();
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
    state.image = file;
    state.previewUrl = URL.createObjectURL(file);
    preview.src = state.previewUrl;
    previewWrap.hidden = false;
    if (cameraStage) cameraStage.hidden = true;
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
    results.replaceChildren();
    setStatus("ছবির লেখা ডিভাইসেই পড়া হচ্ছে…");
    try {
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
      const phones = numberCandidates(text);
      state.contactMeta = contactDetails(text);
      const name = explicitName(text);
      if (phones.length === 1) phones[0].name = name;
      renderPhoneResults(phones);
      setStatus(phones.length ? `${phones.length}টি পৃথক নম্বর পাওয়া গেছে। প্রতিটি নম্বর যাচাই করুন।` : "নিশ্চিত ফোন নম্বর পাওয়া যায়নি। নাম, Email বা Organization থাকলে দেখে নিন; ছবি পরিষ্কার করে আবার চেষ্টা করুন।");
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
      if (state.mode === "gallery") $("npScannerUpload").click();
      else void startDocumentCamera();
    });
    $("npScannerStop")?.addEventListener("click", () => {
      stopDocumentCamera();
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
      else $("npScannerUpload").click();
    });
    $("npScannerRun")?.addEventListener("click", () => void runScan());
    $("npScannerClear")?.addEventListener("click", () => void clearTemporary({ keepMode: true, message: "ছবি ও ফলাফল মুছে ফেলা হয়েছে। আবার স্ক্যান করতে নিচের নিয়ন্ত্রণ ব্যবহার করুন।" }));

    console.info("NP Smart Scanner Ready");
  }

  function openScannerHomeCard() {
    if ($("npSmartScannerHomeCard")) return;
    const emergency = document.querySelector(".standalone-emergency-card");
    if (!emergency) return;
    const row = document.createElement("div");
    row.id = "npSmartScannerHomeRow";
    row.className = "np-smart-scanner-home-row";
    const card = document.createElement("button");
    card.id = "npSmartScannerHomeCard";
    card.type = "button";
    card.className = "category-group soft-cat-blue np-smart-scanner-home-card";
    card.setAttribute("aria-label", "ডকুমেন্ট ও যোগাযোগ স্ক্যানার খুলুন");
    card.innerHTML = '<span aria-hidden="true">📷</span><span>ডকুমেন্ট ও যোগাযোগ স্ক্যানার</span><span class="material-symbols-outlined" aria-hidden="true">document_scanner</span>';
    card.addEventListener("click", () => window.openModal?.("npSmartScannerModal"));
    emergency.before(row);
    row.append(emergency, card);
  }

  window.NPSmartScanner = {
    startCamera: () => startDocumentCamera(),
    stopCamera: () => stopDocumentCamera(),
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
