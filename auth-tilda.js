(() => {
  "use strict";
  const API_BASE_URL = "https://itprorab.metasymbiont.com/api/v1";
  const PLATFORM_VERSION = "web-1.0.0";

  const KEYS = {
    token: "tildaAuthToken",
    phone: "tildaRegisterPhone",
    password: "tildaRegisterPassword",
    userName: "tildaUserName",
  };

  const ENDPOINTS = {
    login: "/auth/login",
    sendPin: "/auth/user/phone/pin",
    confirmPin: "/auth/user/phone/pin/confirm",
    createUser: "/auth/user",
    user: "/lk/user",
  };

  // ---------- helpers ----------

  function normalizePhone(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");

    if (!digits) return "";

    if (digits.length === 11 && digits[0] === "8") {
      return "+7" + digits.slice(1);
    }

    if (digits.length === 11 && digits[0] === "7") {
      return "+" + digits;
    }

    if (raw.startsWith("+")) {
      return "+" + digits;
    }

    return digits;
  }

  function input(name) {
    return document.querySelector(`input[name="${name}"]`);
  }

  function phone() {
    const hidden = input("phone");
    const visible = input("tildaspec-phone-part[]");

    return normalizePhone(
      (hidden && hidden.value) ||
      (visible && visible.value) ||
      ""
    );
  }

  function password() {
    return input("password")?.value || "";
  }

  function code() {
    return input("code")?.value.trim() || "";
  }

  function requestId() {
    return crypto.randomUUID();
  }

  async function api(method, endpoint, body, token = "") {
    const headers = {
      "Accept": "application/json",
      "x-platform-version": PLATFORM_VERSION,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.errorDescription ||
        data?.error ||
        `HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function setBusy(button, busy) {
    if (!button) return;

    button.dataset.authBusy = busy ? "1" : "0";
    button.disabled = busy;

    if (busy) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
  }

  function showError(error) {
    console.error("[Custom Auth]", error);

    const message = error?.message || "Произошла ошибка.";

    // Do not use Tilda's form validation/captcha.
    // Show our own error.
    let box = document.querySelector("[data-custom-auth-error]");

    if (!box) {
      box = document.createElement("div");
      box.dataset.customAuthError = "1";
      box.style.cssText =
        "margin-top:10px;color:#c00;font-size:14px;line-height:1.4;";

      const target =
        document.querySelector("input[name='code']") ||
        document.querySelector("input[name='password']") ||
        document.querySelector("input[name='tildaspec-phone-part[]']") ||
        document.querySelector("input[name='phone']");

      (target?.parentElement || document.body).appendChild(box);
    }

    box.textContent = message;
  }

  function clearError() {
    document.querySelector("[data-custom-auth-error]")?.remove();
  }

  function redirect(path) {
    window.location.assign(path);
  }

  async function getUserAndOpenStatus(token) {
    const user = await api("GET", ENDPOINTS.user, undefined, token);

    const fullName = [
      user?.name,
      user?.surname,
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .join(" ");

    sessionStorage.setItem(KEYS.userName, fullName);

    redirect("/status");
  }

  // ---------- API flows ----------

  async function loginFlow() {
    const login = phone();
    const pass = password();

    if (!login) throw new Error("Введите телефон.");
    if (!pass) throw new Error("Введите пароль.");

    const result = await api("POST", ENDPOINTS.login, {
      login,
      password: pass,
      phone: "",
    });

    if (!result?.token) {
      throw new Error("Сервер не вернул токен.");
    }

    sessionStorage.setItem(KEYS.token, result.token);

    await getUserAndOpenStatus(result.token);
  }

  async function registerSendPinFlow() {
    const login = phone();
    const pass = password();

    if (!login) throw new Error("Введите телефон.");
    if (!pass) throw new Error("Введите пароль.");

    sessionStorage.setItem(KEYS.phone, login);
    sessionStorage.setItem(KEYS.password, pass);

    await api("POST", ENDPOINTS.sendPin, {
      login,
    });

    redirect("/confirm");
  }

  async function registerConfirmFlow() {
    const login = sessionStorage.getItem(KEYS.phone) || "";
    const pass = sessionStorage.getItem(KEYS.password) || "";
    const pin = code();

    if (!login || !pass) {
      throw new Error("Данные регистрации потеряны. Начните регистрацию заново.");
    }

    if (!pin) {
      throw new Error("Введите код из SMS.");
    }

    const confirmation = await api("POST", ENDPOINTS.confirmPin, {
      pin,
      login,
    });

    if (confirmation?.status !== "PHONE_CONFIRMED") {
      throw new Error("Телефон не подтвержден.");
    }

    // IMPORTANT:
    // No login request here.
    // User is created immediately after phone confirmation.
    const createdUser = await api("POST", ENDPOINTS.createUser, {
      login,
      password: pass,
      politicAgreements: true,
      hash: requestId(),
    });

    if (!createdUser?.token) {
      throw new Error("Пользователь создан, но сервер не вернул токен.");
    }

    sessionStorage.setItem(KEYS.token, createdUser.token);

    // Immediately request user data using the token returned by /auth/user.
    await getUserAndOpenStatus(createdUser.token);
  }

  function statusFlow() {
    const element = document.querySelector(".auth-token .tn-atom");

    if (!element) return;

    element.textContent =
      sessionStorage.getItem(KEYS.userName) || "";
  }

  // ---------- OUR OWN BUTTON HANDLING ----------

  /*
   * We intentionally DO NOT listen to "submit".
   *
   * This is the important difference from the previous version.
   * Tilda's submit/captcha system is never invoked by our flow.
   */

  function findButton() {
    // First priority: an explicitly marked custom auth button.
    const explicit = document.querySelector(
      "[data-custom-auth-button]"
    );

    if (explicit) return explicit;

    // Otherwise use the visible submit/button control inside the page.
    return (
      document.querySelector("button[type='submit']") ||
      document.querySelector("input[type='submit']") ||
      document.querySelector(".t-submit")
    );
  }

  function bindButton(handler) {
    const button = findButton();

    if (!button) {
      console.warn("[Custom Auth] Auth button not found.");
      return;
    }

    if (button.dataset.customAuthBound === "1") return;

    button.dataset.customAuthBound = "1";
    button.setAttribute("type", "button");

    button.addEventListener("click", async event => {
      // Stop Tilda's click/submit chain.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (button.dataset.authBusy === "1") return;

      clearError();
      setBusy(button, true);

      try {
        await handler();
      } catch (error) {
        showError(error);
      } finally {
        setBusy(button, false);
      }
    }, true);
  }

  function init() {
    const path =
      window.location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/auth") {
      bindButton(loginFlow);
      return;
    }

    if (path === "/register") {
      bindButton(registerSendPinFlow);
      return;
    }

    if (path === "/confirm") {
      bindButton(registerConfirmFlow);
      return;
    }

    if (path === "/status") {
      statusFlow();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
