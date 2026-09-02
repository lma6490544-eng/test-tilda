
(function () {
  "use strict";

  const API_BASE_URL = "https://itprorab.metasymbiont.com/api/v1";
  const PLATFORM_VERSION = "web-1.0.0";

  const TOKEN_KEY = "tildaAuthToken";
  const REGISTER_PHONE_KEY = "tildaRegisterPhone";

  const ENDPOINTS = {
    login: "/auth/login",
    register: "/auth/register",
    registerPin: "/auth/register-pin",
    registerPinConfirm: "/auth/register-pin/confirm",
  };

  function currentPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function getInput(name) {
    return document.querySelector('[name="' + name + '"]');
  }

  function getPhone() {
    const hidden = getInput("phone");
    let phone = hidden?.value?.trim() || "";

    if (!phone) {
      const visible = document.querySelector(
        'input[name="tildaspec-phone-part[]"]'
      );
      phone = visible?.value?.trim() || "";
    }

    return phone.replace(/[^\d+]/g, "");
  }

  function getPassword() {
    return getInput("password")?.value?.trim() || "";
  }

  function getCode() {
    return getInput("code")?.value?.trim() || "";
  }

  function showError(message) {
    console.error("[Tilda Auth]", message);

    let box = document.querySelector(".auth-error");

    if (!box) {
      box = document.createElement("div");
      box.className = "auth-error";
      box.style.marginTop = "15px";
      box.style.color = "red";
      box.style.fontSize = "14px";

      (document.querySelector(".t-form") || document.body).appendChild(box);
    }

    box.textContent = message;
    box.style.display = "block";
  }

  function clearError() {
    const box = document.querySelector(".auth-error");

    if (box) {
      box.textContent = "";
      box.style.display = "none";
    }
  }

  function setLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;

    const text = button.querySelector(".t-submit__text");

    if (text) {
      text.textContent = loading ? "Загрузка..." : "SUBMIT";
    }
  }

  async function apiPost(endpoint, body) {
    const url = API_BASE_URL + endpoint;

    console.log("[Tilda Auth] POST:", url);
    console.log("[Tilda Auth] body:", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "Content-Type": "application/json",
        "x-platform-version": PLATFORM_VERSION,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    console.log("[Tilda Auth] API response:", response.status, data);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          data?.detail ||
          ("Ошибка API: " + response.status)
      );
    }

    return data;
  }

  /**
   * Supports all common token response formats:
   * { token: "..." }
   * { access_token: "..." }
   * { data: { token: "..." } }
   * { data: { access_token: "..." } }
   * "token-string"
   */
  function getToken(data) {
    if (typeof data === "string") {
      return data;
    }

    return (
      data?.token ||
      data?.access_token ||
      data?.data?.token ||
      data?.data?.access_token ||
      data?.result?.token ||
      data?.result?.access_token ||
      ""
    );
  }

  function saveToken(token) {
    if (!token) {
      console.error("[Tilda Auth] Cannot save empty token");
      return false;
    }

    localStorage.setItem(TOKEN_KEY, token);

    // Also save under a generic key in case the success page
    // is using another part of the project.
    localStorage.setItem("authToken", token);

    console.log("[Tilda Auth] token saved:", token);

    return true;
  }

  function fillTokenField() {
    const token =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem("authToken") ||
      "";

    console.log("[Tilda Auth] token from localStorage:", token);

    if (!token) {
      console.warn("[Tilda Auth] No token found in localStorage");
      return;
    }

    // Main expected element.
    const elements = document.querySelectorAll(".auth-token");

    if (!elements.length) {
      console.warn("[Tilda Auth] .auth-token not found yet");
      return;
    }

    elements.forEach((element) => {
      if (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA"
      ) {
        element.value = token;

        // Make Tilda/browser notice the value.
        element.setAttribute("value", token);
        element.dispatchEvent(
          new Event("input", { bubbles: true })
        );
        element.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      } else {
        element.textContent = token;
      }
    });

    console.log(
      "[Tilda Auth] token written to .auth-token:",
      elements.length
    );
  }

  function initStatusPage() {
    if (currentPath() !== "/status") return;

    // Tilda can render blocks after our script has executed,
    // so try several times.
    fillTokenField();

    let attempts = 0;

    const timer = setInterval(() => {
      attempts++;
      fillTokenField();

      if (attempts >= 20) {
        clearInterval(timer);
      }
    }, 250);

    // Also catch late DOM changes.
    const observer = new MutationObserver(() => {
      fillTokenField();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 6000);
  }

  async function login(button) {
    clearError();

    const login = getPhone();
    const password = getPassword();

    if (!login) {
      showError("Введите номер телефона");
      return;
    }

    if (!password) {
      showError("Введите пароль");
      return;
    }

    setLoading(button, true);

    try {
      const data = await apiPost(ENDPOINTS.login, {
        login,
        password,
        phone: "",
      });

      const token = getToken(data);

      if (!token) {
        console.error("[Tilda Auth] Full login response:", data);
        throw new Error("Сервер не вернул token");
      }

      saveToken(token);

      window.location.href = "/status";
    } catch (error) {
      showError(error.message || "Ошибка авторизации");
      setLoading(button, false);
    }
  }

  async function register(button) {
    clearError();

    const login = getPhone();
    const password = getPassword();

    if (!login) {
      showError("Введите номер телефона");
      return;
    }

    if (!password) {
      showError("Введите пароль");
      return;
    }

    setLoading(button, true);

    try {
      await apiPost(ENDPOINTS.register, {
        login,
        password,
        politicAgreements: true,
        categories: [
          {
            id: "2d2400ea-387f-4098-84aa-9c24f018b283",
            categoryName: "подрядчик",
          },
        ],
      });

      localStorage.setItem(REGISTER_PHONE_KEY, login);

      await apiPost(ENDPOINTS.registerPin, { login });

      window.location.href = "/confirm";
    } catch (error) {
      showError(error.message || "Ошибка регистрации");
      setLoading(button, false);
    }
  }

  async function confirm(button) {
    clearError();

    const pin = getCode();
    const login = localStorage.getItem(REGISTER_PHONE_KEY) || "";

    if (!login) {
      showError("Не найден номер телефона для подтверждения");
      return;
    }

    if (!pin) {
      showError("Введите код из SMS");
      return;
    }

    setLoading(button, true);

    try {
      const data = await apiPost(
        ENDPOINTS.registerPinConfirm,
        {
          pin,
          login,
        }
      );

      const token = getToken(data);

      if (token) {
        saveToken(token);
      }

      window.location.href = "/status";
    } catch (error) {
      showError(error.message || "Ошибка подтверждения кода");
      setLoading(button, false);
    }
  }

  function handleSubmit(button) {
    const path = currentPath();

    if (path === "/auth") return login(button);
    if (path === "/register") return register(button);
    if (path === "/confirm") return confirm(button);
  }

  // Intercept Tilda's native form before its own submit handler.
  document.addEventListener(
    "click",
    function (event) {
      const button = event.target.closest(".t-submit");

      if (!button) return;

      const path = currentPath();

      if (
        path !== "/auth" &&
        path !== "/register" &&
        path !== "/confirm"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      handleSubmit(button);
    },
    true
  );

  document.addEventListener(
    "submit",
    function (event) {
      const form = event.target;

      if (!form?.classList?.contains("t-form")) return;

      const path = currentPath();

      if (
        path !== "/auth" &&
        path !== "/register" &&
        path !== "/confirm"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStatusPage);
  } else {
    initStatusPage();
  }

  console.log("[Tilda Auth] direct API mode loaded");
})();
