// ==UserScript==
// @name         Anycard Add All
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Show Anycards (balance > 0) and automate adding cards on anycard.ca
// @match        https://anycard.ca/*
// @match        https://www.anycard.ca/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  "use strict";

  const BRIDGE_BASE_URL = "http://127.0.0.1:5091";
  const BASIC_AUTH_USERNAME = "admin";
  const BASIC_AUTH_PASSWORD = "Aionpyi0n19920502~";

  const SESSION_CURRENT_CARD_KEY = "tm.anycardAddAll.currentCard";
  const SESSION_RUNNING_KEY = "tm.anycardAddAll.running";

  const authHeader = "Basic " + btoa(`${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}`);

  if (typeof GM_xmlhttpRequest !== "function") {
    console.log("[anycard-addall] GM_xmlhttpRequest not available; check loader @grant and reinstall/refresh the script.");
    return;
  }

  function isBrandsPage() {
    return window.location.pathname === "/swap/brands";
  }

  function isLoadCardPage() {
    return window.location.pathname === "/swap/loadcard";
  }

  function gmGetJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url,
        headers: { Authorization: authHeader },
        timeout: 30000,
        onload: (res) => {
          if (res.status !== 200) {
            reject(new Error(`HTTP ${res.status}: ${res.responseText || ""}`));
            return;
          }
          try {
            resolve(JSON.parse(res.responseText));
          } catch (e) {
            reject(e);
          }
        },
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("Request timeout")),
      });
    });
  }

  function gmRequestJson({ method, url, body }) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method,
        url,
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        data: body ? JSON.stringify(body) : undefined,
        timeout: 30000,
        onload: (res) => {
          if (res.status < 200 || res.status >= 300) {
            reject(new Error(`HTTP ${res.status}: ${res.responseText || ""}`));
            return;
          }
          if (!res.responseText) {
            resolve(undefined);
            return;
          }
          try {
            resolve(JSON.parse(res.responseText));
          } catch {
            resolve(res.responseText);
          }
        },
        onerror: (err) => reject(err),
        ontimeout: () => reject(new Error("Request timeout")),
      });
    });
  }

  function parseBalance(value) {
    if (value === null || value === undefined) return NaN;
    const s = String(value).trim();
    if (!s) return NaN;
    const n = Number(s.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function hasPin(x) {
    return typeof x?.pin === "string" && x.pin.trim().length > 0;
  }

  function setInputValueAndNotify(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function readCurrentCard() {
    const raw = sessionStorage.getItem(SESSION_CURRENT_CARD_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
      return null;
    }
  }

  function writeCurrentCard(card) {
    sessionStorage.setItem(SESSION_CURRENT_CARD_KEY, JSON.stringify(card));
  }

  function isRunning() {
    return sessionStorage.getItem(SESSION_RUNNING_KEY) === "1";
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "tm-add-all-panel";
    panel.style.position = "fixed";
    panel.style.top = "52px";
    panel.style.right = "12px";
    panel.style.zIndex = "2147483647";
    panel.style.width = "600px";
    panel.style.maxHeight = "60vh";
    panel.style.overflow = "auto";
    panel.style.border = "1px solid #ddd";
    panel.style.borderRadius = "10px";
    panel.style.background = "white";
    panel.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
    panel.style.padding = "10px";

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <strong style="font-size:13px;">Anycards (balance &gt; 0)</strong>
        <button id="tm-anycard-refresh" style="margin-left:auto;padding:4px 8px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;">Refresh</button>
      </div>
      <div id="tm-anycard-status" style="font-size:12px;opacity:0.75;margin-bottom:8px;">Loading...</div>
      <div id="tm-anycard-tablewrap"></div>
    `;

    return panel;
  }

  function ensurePanel() {
    let panel = document.getElementById("tm-add-all-panel");
    if (!panel) {
      panel = createPanel();
      document.body.appendChild(panel);
    }
    return panel;
  }

  function setStatus(panel, text) {
    const status = panel.querySelector("#tm-anycard-status");
    status.textContent = text;
  }

  function renderTable(container, rows) {
    if (!rows.length) {
      container.innerHTML = `<div style="font-size:12px;opacity:0.7;">No anycards with balance &gt; 0.</div>`;
      return;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.fontSize = "12px";

    table.innerHTML = `
      <thead>
        <tr style="text-align:left;border-bottom:1px solid #eee;">
          <th style="padding:6px;">Card</th>
          <th style="padding:6px;">Serial</th>
          <th style="padding:6px;">PIN</th>
          <th style="padding:6px;">Type</th>
          <th style="padding:6px;">Balance</th>
          <th style="padding:6px;">Needs</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    for (const x of rows) {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #f3f3f3";
      const pinText = x.pin ? String(x.pin) : "";
      const pinShown = pinText ? pinText : "-";
      tr.innerHTML = `
        <td style="padding:6px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${x.cardNumber || "-"}</td>
        <td style="padding:6px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${x.serialNumber || "-"}</td>
        <td style="padding:6px;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;">${pinShown}</td>
        <td style="padding:6px;opacity:0.85;">${x.anycardType || "-"}</td>
        <td style="padding:6px;"><strong>${x.balance || "-"}</strong></td>
        <td style="padding:6px;opacity:0.85;">${x.needsRedeem ? "Yes" : "No"}</td>
      `;
      tbody.appendChild(tr);
    }

    container.innerHTML = "";
    container.appendChild(table);
  }

  async function loadAnycards(panel) {
    const wrap = panel.querySelector("#tm-anycard-tablewrap");
    setStatus(panel, "Loading...");
    wrap.innerHTML = "";

    const anycards = await gmGetJson(`${BRIDGE_BASE_URL}/api/anycards`);
    const rows = (Array.isArray(anycards) ? anycards : [])
      .filter((x) => parseBalance(x.balance) > 0)
      .sort((a, b) => parseBalance(b.balance) - parseBalance(a.balance));

    const eligibleCount = rows.filter((x) => hasPin(x)).length;
    setStatus(panel, `${isRunning() ? "Running • " : ""}Loaded ${rows.length} item(s) • eligible (PIN) ${eligibleCount}`);
    renderTable(wrap, rows);
    return { rows, anycards };
  }

  function findAddNewCardLink() {
    const links = Array.from(document.querySelectorAll("a.nav-link"));
    return links.find((a) => (a.getAttribute("href") || "").trim() === "/swap/loadcard") || null;
  }

  function findSwapBalanceForType(anycardType) {
    const cards = Array.from(document.querySelectorAll(".account-balance-card"));
    for (const c of cards) {
      const typeEl = c.querySelector("h4");
      const label = (typeEl?.innerText || typeEl?.textContent || "").trim();
      if (!label) continue;
      if (anycardType && label.toLowerCase() !== String(anycardType).trim().toLowerCase()) continue;

      const balEl = c.querySelector("h3");
      const raw = (balEl?.innerText || balEl?.textContent || "").trim();
      const n = parseBalance(raw);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  }

  async function pickNextCardAndGo(panel) {
    setStatus(panel, "Loading...");

    const anycards = await gmGetJson(`${BRIDGE_BASE_URL}/api/anycards`);
    const eligible = (Array.isArray(anycards) ? anycards : [])
      .filter((x) => parseBalance(x.balance) > 0)
      .filter((x) => hasPin(x))
      .sort((a, b) => parseBalance(b.balance) - parseBalance(a.balance));

    if (!eligible.length) {
      sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
      sessionStorage.removeItem(SESSION_RUNNING_KEY);
      setStatus(panel, "Done: no eligible anycards.");
      ensureAddAllButton(panel);
      await loadAnycards(panel);
      return;
    }

    const chosen = eligible[0];
    const preSwapBalance = isBrandsPage() ? findSwapBalanceForType(chosen.anycardType) : NaN;
    const expectedIncrease = parseBalance(chosen.balance);

    const current = {
      id: chosen.id,
      cardNumber: chosen.cardNumber,
      serialNumber: chosen.serialNumber,
      pin: chosen.pin,
      balance: chosen.balance,
      anycardType: chosen.anycardType,
      needsRedeem: chosen.needsRedeem,
      expectedIncrease: Number.isFinite(expectedIncrease) ? expectedIncrease : null,
      preSwapBalance: Number.isFinite(preSwapBalance) ? preSwapBalance : null,
      submitted: false,
      pickedAt: Date.now(),
    };
    writeCurrentCard(current);
    setStatus(panel, `Selected: ${current.cardNumber} (preBalance=${current.preSwapBalance ?? "?"})`);

    const link = findAddNewCardLink();
    if (link) link.click();
    else window.location.href = "https://www.anycard.ca/swap/loadcard";
  }

  async function onAddAllClicked(panel) {
    if (isRunning()) {
      sessionStorage.removeItem(SESSION_RUNNING_KEY);
      sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
      ensureAddAllButton(panel);
      await loadAnycards(panel);
      return;
    }

    sessionStorage.setItem(SESSION_RUNNING_KEY, "1");
    ensureAddAllButton(panel);
    await pickNextCardAndGo(panel);
  }

  function ensureAddAllButton(panel) {
    const existing = document.getElementById("tm-add-all-btn");
    if (!isBrandsPage()) {
      if (existing) existing.remove();
      return;
    }

    const label = isRunning() ? "Stop" : "Add All";
    if (existing) {
      existing.textContent = label;
      return;
    }

    const btn = document.createElement("button");
    btn.id = "tm-add-all-btn";
    btn.type = "button";
    btn.textContent = label;
    btn.style.position = "fixed";
    btn.style.top = "12px";
    btn.style.right = "12px";
    btn.style.zIndex = "2147483647";
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "8px";
    btn.style.border = "1px solid #ddd";
    btn.style.background = "white";
    btn.style.cursor = "pointer";

    btn.addEventListener("click", () => onAddAllClicked(panel).catch((e) => alert(e?.message || String(e))));
    document.body.appendChild(btn);
  }

  async function maybeHandleZeroBalanceWarning(card) {
    const warning = document.querySelector(".modal-content .worning-message");
    if (!warning) return false;
    if (!/\$0\s*balance/i.test(warning.textContent || "")) return false;

    if (card.id) {
      try {
        await gmRequestJson({
          method: "PUT",
          url: `${BRIDGE_BASE_URL}/api/anycards/${encodeURIComponent(card.id)}`,
          body: {
            cardNumber: card.cardNumber,
            serialNumber: card.serialNumber ?? null,
            pin: card.pin ?? null,
            anycardType: card.anycardType,
            balance: "0",
            needsRedeem: card.needsRedeem ?? false,
          },
        });
      } catch (e) {
        console.log("[anycard-addall] failed to zero balance after warning", e?.message || String(e));
      }
    }

    sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
    window.location.href = "https://www.anycard.ca/swap/brands";
    return true;
  }

  function maybeHandleLoadCardFlow() {
    if (!isLoadCardPage()) return;

    const card = readCurrentCard();
    if (!card?.cardNumber || !card?.pin) return;

    maybeHandleZeroBalanceWarning(card).catch(() => {});

    // If we already submitted the form, don't submit again on reload.
    if (card.submitted) return;

    const cardInput = document.querySelector("#cardnumber");
    const pinInput = document.querySelector("#pin");
    const submitBtn = document.querySelector("button.load-card");
    if (!cardInput || !pinInput || !submitBtn) return;

    setInputValueAndNotify(cardInput, String(card.cardNumber));
    setInputValueAndNotify(pinInput, String(card.pin));

    // After submit we DO NOT update backend balance yet. We will verify swap balance increase on /swap/brands first.
    writeCurrentCard({ ...card, submitted: true, submittedAt: Date.now() });
    submitBtn.click();
  }

  async function maybeFinalizeAfterSubmit(panel) {
    if (!isBrandsPage()) return;
    if (!isRunning()) return;

    const card = readCurrentCard();
    if (!card || !card.submitted) return;

    if (card.preSwapBalance === null || card.expectedIncrease === null) {
      setStatus(panel, "Cannot verify swap balance increase (missing preBalance or expectedIncrease). Not updating anycard.");
      sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
      return;
    }

    const currentSwapBalance = findSwapBalanceForType(card.anycardType);
    if (!Number.isFinite(currentSwapBalance)) return;

    const needed = card.preSwapBalance + card.expectedIncrease;
    if (currentSwapBalance + 0.00001 < needed) {
      setStatus(panel, `Waiting for balance update: now=${currentSwapBalance.toFixed(2)} need>=${needed.toFixed(2)}`);
      return;
    }

    // Verified increase: now update the backend anycard balance to 0.
    try {
      await gmRequestJson({
        method: "PUT",
        url: `${BRIDGE_BASE_URL}/api/anycards/${encodeURIComponent(card.id)}`,
        body: {
          cardNumber: card.cardNumber,
          serialNumber: card.serialNumber ?? null,
          pin: card.pin ?? null,
          anycardType: card.anycardType,
          balance: "0",
          needsRedeem: card.needsRedeem ?? false,
        },
      });
      sessionStorage.removeItem(SESSION_CURRENT_CARD_KEY);
      setStatus(panel, `Balance verified and cleared for ${card.cardNumber}`);
    } catch (e) {
      setStatus(panel, `Failed to clear balance for ${card.cardNumber}: ${e?.message || String(e)}`);
      return;
    }

    if (isRunning()) {
      await pickNextCardAndGo(panel);
    }
  }

  function init() {
    const panel = ensurePanel();
    ensureAddAllButton(panel);

    const refreshBtn = panel.querySelector("#tm-anycard-refresh");
    if (!refreshBtn.dataset.bound) {
      refreshBtn.addEventListener("click", () => loadAnycards(panel).catch(() => {}));
      refreshBtn.dataset.bound = "1";
    }

    loadAnycards(panel).catch((e) => setStatus(panel, `Error: ${e?.message || String(e)}`));
    maybeHandleLoadCardFlow();

    if (isBrandsPage()) {
      // Poll to finalize submitted card when swap balance updates.
      const id = window.setInterval(() => {
        maybeFinalizeAfterSubmit(panel).catch(() => {});
        ensureAddAllButton(panel);
      }, 2000);
      window.addEventListener("beforeunload", () => window.clearInterval(id), { once: true });

      // If running and idle (no current card), start.
      if (isRunning() && !readCurrentCard()) {
        pickNextCardAndGo(panel).catch((e) => setStatus(panel, e?.message || String(e)));
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

