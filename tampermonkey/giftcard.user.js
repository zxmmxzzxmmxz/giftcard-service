// ==UserScript==
// @name         Giftcard Bridge Anycard Automation
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Pull a fresh task and automate getmybonus anycard flow; complete or fail the task.
// @match        *://getmybonus.ca/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const BRIDGE_BASE_URL = "http://127.0.0.1:5091";
  const BASIC_AUTH_USERNAME = "admin";
  const BASIC_AUTH_PASSWORD = "Aionpyi0n19920502~";
  const DEFAULT_EMAIL = "zxmmxzzxmmxz@gmail.com";

  const params = new URLSearchParams(window.location.search);
  const urlTaskType = params.get("task_type");
  const urlTaskId = params.get("task_id");

  const SESSION_TASK_ID_KEY = "giftcard.taskId";
  const SESSION_TASK_TYPE_KEY = "giftcard.taskType";

  const sessionTaskId = sessionStorage.getItem(SESSION_TASK_ID_KEY);
  const sessionTaskType = sessionStorage.getItem(SESSION_TASK_TYPE_KEY);

  // If URL doesn't carry task context, allow recovery from sessionStorage (minimal persistence across redirects).
  if (!urlTaskType && !urlTaskId && !sessionTaskId) return;

  const authHeader = "Basic " + btoa(`${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}`);

  function gmRequest({ method, url, headers, data }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers,
        data,
        timeout: 30000,
        onload: (res) => resolve(res),
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("Request timeout")),
      });
    });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function isClickable(el) {
    if (!el) return false;
    if ("disabled" in el && el.disabled) return false;
    const ariaDisabled = el.getAttribute && el.getAttribute("aria-disabled");
    if (ariaDisabled === "true") return false;
    return true;
  }

  function appendQueryParam(url, key, value) {
    const u = new URL(url, window.location.href);
    u.searchParams.set(key, value);
    return u.toString();
  }

  function appendTaskParams(url, task) {
    let out = url;
    out = appendQueryParam(out, "task_type", task.type);
    out = appendQueryParam(out, "task_id", task.id);
    return out;
  }

  function setInputValueAndNotify(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fetchTask() {
    const effectiveTaskId = urlTaskId || sessionTaskId;
    const effectiveTaskType = urlTaskType || sessionTaskType;

    if (effectiveTaskId) {
      const res = await gmRequest({
        method: "GET",
        url: `${BRIDGE_BASE_URL}/api/tasks/${encodeURIComponent(effectiveTaskId)}`,
        headers: { Authorization: authHeader },
      });
      if (res.status !== 200) {
        sessionStorage.removeItem(SESSION_TASK_ID_KEY);
        sessionStorage.removeItem(SESSION_TASK_TYPE_KEY);
        return null;
      }
      return JSON.parse(res.responseText);
    }

    const nextRes = await gmRequest({
      method: "GET",
      url: `${BRIDGE_BASE_URL}/api/tasks/next?type=${encodeURIComponent(effectiveTaskType)}`,
      headers: { Authorization: authHeader },
    });

    if (nextRes.status === 204) return null;
    if (nextRes.status !== 200) throw new Error(`next failed: ${nextRes.status} ${nextRes.responseText}`);
    return JSON.parse(nextRes.responseText);
  }

  async function completeTask(task, result) {
    const completeUrl = `${BRIDGE_BASE_URL}/api/tasks/${encodeURIComponent(task.id)}/complete`;
    const res = await gmRequest({
      method: "POST",
      url: completeUrl,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({ result }),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`complete failed: ${res.status} ${res.responseText}`);
    }
  }

  async function failTask(task, error, result) {
    const failUrl = `${BRIDGE_BASE_URL}/api/tasks/${encodeURIComponent(task.id)}/fail`;
    const payload = { error };
    if (result !== undefined) payload.result = result;
    const res = await gmRequest({
      method: "POST",
      url: failUrl,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(payload),
    });
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`fail failed: ${res.status} ${res.responseText}`);
    }
  }

  function findAnycardLink() {
    const links = Array.from(document.querySelectorAll("a"));
    for (const link of links) {
      const text = (link.innerText || link.textContent || "").trim();
      if (!text) continue;
      if (text.toLowerCase().includes("anycard") && link.href) return link;
    }
    return null;
  }

  function findGetMyBonusButton() {
    const btns = Array.from(document.querySelectorAll('input[type="button"]'));
    for (const btn of btns) {
      const v = (btn.value || "").trim();
      if (!v) continue;
      if (v.toLowerCase().includes("get my bonus") && isClickable(btn)) return btn;
    }
    return null;
  }

  function findSerialInput() {
    return document.querySelector("input.wizard-serial-number");
  }

  function findSaveButton() {
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const btn of buttons) {
      const text = (btn.innerText || btn.textContent || "").trim();
      if (text.toLowerCase() === "save" && isClickable(btn)) return btn;
    }
    return null;
  }

  function findNextButton() {
    const btns = Array.from(document.querySelectorAll('input[type="button"]'));
    for (const btn of btns) {
      const v = (btn.value || "").trim();
      if (v.toLowerCase() === "next" && isClickable(btn)) return btn;
    }
    return null;
  }

  function findEmailStep() {
    const email = document.querySelector("#workflow_data_email");
    const email2 = document.querySelector("#workflow_data_email_confirmation");
    const tos = document.querySelector("#workflow_data_terms_of_service");
    return email && email2 && tos ? { email, email2, tos } : null;
  }

  function findShowEmailCodeSubmit() {
    const submits = Array.from(document.querySelectorAll('input[type="submit"]'));
    for (const s of submits) {
      const v = (s.value || "").trim().toLowerCase();
      if (!v) continue;
      if (v.includes("show") && v.includes("email") && isClickable(s)) return s;
    }
    return null;
  }

  function findCodesContainer() {
    return document.querySelector(".codes-container");
  }

  function findEligibleCardSerial() {
    const divs = Array.from(document.querySelectorAll("div"));
    for (const d of divs) {
      const text = (d.innerText || d.textContent || "").trim();
      if (!text) continue;
      if (!text.toLowerCase().includes("eligible card")) continue;
      // Prefer the number that appears after the "Eligible Card:" label to avoid accidentally
      // matching Bonus Code digits that may also be present in the same container text.
      const labeled = text.match(/eligible\s*card\s*:\s*([0-9]{10,})/i);
      if (labeled) return labeled[1];

      // Fallback: take the last long digit sequence (eligible card often appears after the label).
      const all = text.match(/[0-9]{10,}/g);
      if (all && all.length) return all[all.length - 1];
    }
    return null;
  }

  function extractBonusCodeAndPin(container) {
    let bonusCode = null;
    let pin = null;

    const titles = Array.from(container.querySelectorAll(".title"));
    for (const titleEl of titles) {
      const title = (titleEl.innerText || titleEl.textContent || "").trim().toLowerCase();
      const textEl = titleEl.nextElementSibling;
      const text = textEl ? (textEl.innerText || textEl.textContent || "").trim() : "";
      if (!text) continue;

      if (!bonusCode && title.includes("bonus code")) bonusCode = text;
      if (!pin && title === "pin") pin = text;
    }

    return { bonusCode, pin };
  }

  async function waitFor(fn, { timeoutMs = 20000, intervalMs = 300, name = "element" } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = fn();
      if (v) return v;
      await sleep(intervalMs);
    }
    throw new Error(`Timeout waiting for ${name}`);
  }

  async function processGetmybonusAnycard(task) {
    const serialNumber =
      task?.data?.serialNumber ??
      task?.data?.serial_number ??
      task?.data?.["serialNumber"] ??
      task?.data?.["serial_number"];

    // Codes page (after Show & Email Code) => verify eligible card serial matches and complete task
    const codesPage = findCodesContainer();
    if (codesPage) {
      const eligible = findEligibleCardSerial();
      if (!eligible) throw new Error("Eligible Card serial not found");
      if (!serialNumber) throw new Error("task.data.serialNumber missing");
      if (String(eligible).trim() !== String(serialNumber).trim()) {
        throw new Error(`Eligible Card serial mismatch: page=${eligible} task=${serialNumber}`);
      }

      const { bonusCode, pin } = extractBonusCodeAndPin(codesPage);
      if (!bonusCode || !pin) throw new Error("Failed to extract Bonus Code or PIN");

      console.log("[giftcard] codes page complete task", { bonusCode, pin });
      await completeTask(task, {
        card_number: bonusCode,
        PIN: pin,
        card_type: "Celebrate",
        serial_number: serialNumber ?? null,
        balance: "10",
        status: "ACTIVE",
      });
      sessionStorage.removeItem(SESSION_TASK_ID_KEY);
      sessionStorage.removeItem(SESSION_TASK_TYPE_KEY);
      return;
    }

    // Step 1: find AnyCard promo link and navigate (if present)
    const anycardLink = findAnycardLink();
    if (anycardLink && anycardLink.href && !window.location.href.startsWith(anycardLink.href)) {
      const nextUrl = appendTaskParams(anycardLink.href, task);
      console.log("[giftcard] step1 navigate anycard promo", nextUrl);
      window.location.href = nextUrl;
      return;
    }

    // Step 2: click "Get My Bonus"
    const getMyBonusBtn = findGetMyBonusButton();
    if (getMyBonusBtn) {
      console.log("[giftcard] step2 click Get My Bonus");
      getMyBonusBtn.click();
      await sleep(500);
    }

    // Step 3: fill serial number input
    const serialInput = findSerialInput();
    if (serialInput) {
      if (!serialNumber) throw new Error("task.data.serialNumber missing");
      console.log("[giftcard] step3 fill serial number");
      setInputValueAndNotify(serialInput, String(serialNumber));

      // Step 4: click Save, wait Next enabled, click Next
      const saveBtn = await waitFor(findSaveButton, { timeoutMs: 20000, name: "Save button" });
      console.log("[giftcard] step4 click Save");
      saveBtn.click();

      // Captcha may block; wait until Next becomes clickable.
      const nextBtn = await waitFor(findNextButton, { timeoutMs: 10 * 60 * 1000, intervalMs: 1000, name: "Next button enabled" });
      console.log("[giftcard] step4 click Next");
      nextBtn.click();

      // Step 5: fill email + tos + click Show&Email Code (when enabled)
      const emailStep = await waitFor(findEmailStep, { timeoutMs: 60000, intervalMs: 500, name: "Email inputs" });
      console.log("[giftcard] step5 fill email + accept terms");
      setInputValueAndNotify(emailStep.email, DEFAULT_EMAIL);
      setInputValueAndNotify(emailStep.email2, DEFAULT_EMAIL);
      if (!emailStep.tos.checked) {
        emailStep.tos.checked = true;
        emailStep.tos.dispatchEvent(new Event("change", { bubbles: true }));
      }

      const submit = await waitFor(findShowEmailCodeSubmit, { timeoutMs: 10 * 60 * 1000, intervalMs: 1000, name: "Show & Email Code enabled" });
      console.log("[giftcard] step5 click Show & Email Code");
      // Minimal persistence: store task context before redirect/captcha/submit.
      sessionStorage.setItem(SESSION_TASK_ID_KEY, task.id);
      sessionStorage.setItem(SESSION_TASK_TYPE_KEY, task.type);
      submit.click();
      return;
    }

    // If we are here, we couldn't find expected elements for the current step.
    throw new Error("No Anycard link / Get My Bonus / serial input found on this page");
  }

  async function run() {
    const task = await fetchTask();
    if (!task) {
      console.log("[giftcard] no READY task");
      sessionStorage.removeItem(SESSION_TASK_ID_KEY);
      sessionStorage.removeItem(SESSION_TASK_TYPE_KEY);
      return;
    }

    console.log("[giftcard] task", task);

    // Ensure URL keeps task context across navigations without storage.
    if (!urlTaskId || urlTaskId !== task.id || !urlTaskType || urlTaskType !== task.type) {
      const here = new URL(window.location.href);
      here.searchParams.set("task_id", task.id);
      here.searchParams.set("task_type", task.type);
      window.history.replaceState(null, "", here.toString());
    }

    try {
      // If we recovered a task that is already completed, clear session state and stop.
      if (task.status && task.status !== "IN_PROGRESS") {
        sessionStorage.removeItem(SESSION_TASK_ID_KEY);
        sessionStorage.removeItem(SESSION_TASK_TYPE_KEY);
      }

      if (task.type === "getmybonus_anycard") {
        await processGetmybonusAnycard(task);
      } else {
        throw new Error(`Unsupported task type: ${task.type}`);
      }
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      console.log("[giftcard] fail", msg);
      try {
        await failTask(task, msg);
      } finally {
        sessionStorage.removeItem(SESSION_TASK_ID_KEY);
        sessionStorage.removeItem(SESSION_TASK_TYPE_KEY);
      }
    }

    // Clear session state once task is completed successfully on codes page.
    // (completeTask doesn't return server task state, so we clear after success path in codes page only.)
  }

  run().catch((e) => console.log("[giftcard] error", e));
})();
