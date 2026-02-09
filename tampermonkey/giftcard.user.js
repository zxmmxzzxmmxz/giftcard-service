// ==UserScript==
// @name         Giftcard Bridge Demo
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Pull task from local bridge by ?task_type= and complete with sample result (dev)
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
  const CURRENT_TASK_STORAGE_KEY = "giftcard.currentTask";

  const params = new URLSearchParams(window.location.search);
  const taskType = params.get("task_type");
  if (!taskType) return;

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

  function appendQueryParam(url, key, value) {
    try {
      const u = new URL(url, window.location.href);
      u.searchParams.set(key, value);
      return u.toString();
    } catch {
      return url;
    }
  }

  async function waitForAnycardLink({ timeoutMs = 15000, intervalMs = 300 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const links = Array.from(document.querySelectorAll("a"));
      for (const link of links) {
        const text = (link.innerText || link.textContent || "").trim();
        if (!text) continue;
        if (text.toLowerCase().includes("anycard")) return link;
      }
      await sleep(intervalMs);
    }
    return null;
  }

  async function waitForGetMyBonusButton({ timeoutMs = 15000, intervalMs = 300 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const buttons = Array.from(document.querySelectorAll('input[type="button"]'));
      for (const btn of buttons) {
        const v = (btn.value || "").trim();
        if (!v) continue;
        if (v.toLowerCase().includes("get my bonus")) return btn;
      }
      await sleep(intervalMs);
    }
    return null;
  }

  async function waitForSerialNumberInput({ timeoutMs = 15000, intervalMs = 300 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const input = document.querySelector("input.wizard-serial-number[type='text']");
      if (input) return input;
      await sleep(intervalMs);
    }
    return null;
  }

  function setInputValueAndNotify(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (nativeSetter) nativeSetter.call(input, value);
    else input.value = value;

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function run() {
    let task = null;
    try {
      const cached = sessionStorage.getItem(CURRENT_TASK_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id && parsed.type === taskType && parsed.status === "IN_PROGRESS") {
          task = parsed;
          console.log("[giftcard] resume task", task);
        }
      }
    } catch {
      sessionStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
    }

    if (!task) {
      const nextUrl = `${BRIDGE_BASE_URL}/api/tasks/next?type=${encodeURIComponent(taskType)}`;
      const nextRes = await gmRequest({
        method: "GET",
        url: nextUrl,
        headers: { Authorization: authHeader },
      });

      if (nextRes.status === 204) {
        console.log("[giftcard] no task");
        return;
      }
      if (nextRes.status !== 200) {
        console.log("[giftcard] next failed", nextRes.status, nextRes.responseText);
        return;
      }

      task = JSON.parse(nextRes.responseText);
      sessionStorage.setItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify(task));
    }

    console.log("[giftcard] task", task);

    if (task.type === "getmybonus_anycard") {
      console.log("is anycard");
      const link = await waitForAnycardLink({ timeoutMs: 2500, intervalMs: 200 });
      if (link) {
        const nextUrl = appendQueryParam(link.href, "task_type", taskType);
        console.log("[giftcard] navigating to anycard link", nextUrl);
        window.location.href = nextUrl;
      } else {
        const btn = await waitForGetMyBonusButton({ timeoutMs: 2500, intervalMs: 200 });
        if (btn) {
          console.log("[giftcard] clicking Get My Bonus button");
          btn.click();
        } else {
          console.log("[giftcard] anycard link/button not found");
        }
      }

      const cardNumber =
        task?.data?.cardNumber ??
        task?.data?.card_number ??
        task?.data?.["cardNumber"] ??
        task?.data?.["card_number"];

      if (cardNumber) {
        const serialInput = await waitForSerialNumberInput({ timeoutMs: 2500, intervalMs: 200 });
        if (serialInput) {
          console.log("[giftcard] filling cardNumber", cardNumber);
          setInputValueAndNotify(serialInput, String(cardNumber));
        } else {
          console.log("[giftcard] serial number input not found yet");
        }
      } else {
        console.log("[giftcard] task.data.cardNumber missing");
      }
    }

    const completeUrl = `${BRIDGE_BASE_URL}/api/tasks/${encodeURIComponent(task.id)}/complete`;
    const sampleBody = {
      result: {
        card_number: "12345",
        PIN: "123",
        balance: "10.00",
        status: "ACTIVE",
        card_type: "Celebrate",
      },
    };

    const completeRes = await gmRequest({
      method: "POST",
      url: completeUrl,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      data: JSON.stringify(sampleBody),
    });

    console.log("[giftcard] complete", completeRes.status, completeRes.responseText);
  }

  run().catch((e) => console.log("[giftcard] error", e));
})();
