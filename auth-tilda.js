(() => {
  "use strict";

  const API_BASE_URL = "https://itprorab.metasymbiont.com/api/v1";
  const PLATFORM_VERSION = "web-1.0.0";

  const TOKEN_KEY = "tildaAuthToken";
  const REGISTER_PHONE_KEY = "tildaRegisterPhone";
  const REGISTER_PASSWORD_KEY = "tildaRegisterPassword";
  const USER_NAME_KEY = "tildaUserName";

  const ENDPOINTS = {
    login: "/auth/login",
    registerPin: "/auth/user/phone/pin",
    registerPinConfirm: "/auth/user/phone/pin/confirm",
    registerUser: "/auth/user",
    user: "/lk/user",
  };

  function normalizePhone(value) {
    const raw = String(value || "").trim();
    const digits = raw.replace(/\D/g, "");

    if (!digits) return "";

    if (digits.startsWith("8") && digits.length === 11) {
      return "+7" + digits.slice(1);
    }

    if (digits.startsWith("7") && digits.length === 11) {
      return "+" + digits;
    }

    if (raw.startsWith("+")) {
      return "+" + digits;
    }

    return digits;
  }

  function getField(name) {
    return document.querySelector(`input[name="${name}"]`);
  }

  function getPhone() {
    const hidden = getField("phone");
    const visible = getField("tildaspec-phone-part[]");
    return normalizePhone((hidden && hidden.value) || (visible && visible.value) || "");
  }

  function getPassword() {
    const field = getField("password");
    return field ? field.value : "";
  }

  function getCode() {
    const field = getField("code");
    return field ? field.value.trim() : "";
  }

  function generateRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    // Fallback for older browsers.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function apiRequest(method, endpoint, body, token) {
    const headers = {
      "accept": "application/json",
      "x-platform-version": PLATFORM_VERSION,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    const response = await fetch(API_BASE_URL + endpoint, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const message =
        (data && typeof data === "object" && (data.message || data.errorDescription || data.error)) ||
        `HTTP ${response.status}`;

      throw new Error(message);
    }

    return data;
  }

  function saveToken(token) {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || "";
  }

  function showStatus(text) {
    const element = document.querySelector(".auth-token .tn-atom");
    if (element) {
      element.textContent = text;
    }
  }

  async function loadUserAndGoToStatus(token) {
    const user = await apiRequest("GET", ENDPOINTS.user, undefined, token);

    const name = String(user?.name || "").trim();
    const surname = String(user?.surname || "").trim();
    const fullName = [name, surname].filter(Boolean).join(" ");

    sessionStorage.setItem(USER_NAME_KEY, fullName);
    window.location.href = "/status";
  }

  async function login() {
    const loginValue = getPhone();
    const password = getPassword();

    if (!loginValue || !password) {
      throw new Error("Введите телефон и пароль.");
    }

    const result = await apiRequest("POST", ENDPOINTS.login, {
      login: loginValue,
      password,
      phone: "",
    });

    if (!result?.token) {
      throw new Error("Сервер не вернул токен.");
    }

    saveToken(result.token);
    await loadUserAndGoToStatus(result.token);
  }

  async function sendRegisterPin() {
    const loginValue = getPhone();
    const password = getPassword();

    if (!loginValue || !password) {
      throw new Error("Введите телефон и пароль.");
    }

    sessionStorage.setItem(REGISTER_PHONE_KEY, loginValue);
    sessionStorage.setItem(REGISTER_PASSWORD_KEY, password);

    await apiRequest("POST", ENDPOINTS.registerPin, {
      login: loginValue,
    });

    window.location.href = "/confirm";
  }

  async function confirmRegisterPin() {
    const loginValue = sessionStorage.getItem(REGISTER_PHONE_KEY) || "";
    const password = sessionStorage.getItem(REGISTER_PASSWORD_KEY) || "";
    const pin = getCode();

    if (!loginValue || !password) {
      throw new Error("Данные регистрации не найдены. Начните регистрацию заново.");
    }

    if (!pin) {
      throw new Error("Введите код из SMS.");
    }

    const confirmation = await apiRequest("POST", ENDPOINTS.registerPinConfirm, {
      pin,
      login: loginValue,
    });

    if (confirmation?.status !== "PHONE_CONFIRMED") {
      throw new Error("Телефон не подтвержден.");
    }

    // После подтверждения SMS логин НЕ выполняем.
    // Сразу создаем пользователя и получаем новый Bearer token.
    const userCreation = await apiRequest("POST", ENDPOINTS.registerUser, {
      login: loginValue,
      password,
      politicAgreements: true,
      hash: generateRequestId(),
    });

    if (!userCreation?.token) {
      throw new Error("Сервер не вернул токен после создания пользователя.");
    }

    saveToken(userCreation.token);

    // После создания пользователя сразу запрашиваем данные текущего пользователя.
    await loadUserAndGoToStatus(userCreation.token);
  }

  function showSavedUserName() {
    const fullName = sessionStorage.getItem(USER_NAME_KEY) || "";
    showStatus(fullName);
  }

  function bindOnce(selector, handler) {
    const form = document.querySelector(selector);
    if (!form || form.dataset.tildaAuthBound === "1") return;

    form.dataset.tildaAuthBound = "1";

    form.addEventListener("submit", async event => {
      event.preventDefault();

      try {
        await handler();
      } catch (error) {
        console.error("[Tilda Auth]", error);
        alert(error?.message || "Произошла ошибка.");
      }
    });
  }

  function init() {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/" || path === "/auth") {
      bindOnce("form", login);
      return;
    }

    if (path === "/register") {
      bindOnce("form", sendRegisterPin);
      return;
    }

    if (path === "/confirm") {
      bindOnce("form", confirmRegisterPin);
      return;
    }

    if (path === "/status") {
      showSavedUserName();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
