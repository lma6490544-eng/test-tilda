/**
 * Tilda custom authentication through Cloudflare Worker.
 *
 * Replace PROXY_BASE_URL with your deployed Worker URL.
 */

(function () {
  "use strict";

  const PROXY_BASE_URL = "https://tilda-test.lizakhan2001.workers.dev";

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
    const hiddenPhone = getInput("phone");
    let phone = hiddenPhone?.value?.trim() || "";

    if (!phone) {
      const visiblePhone = document.querySelector(
        'input[name="tildaspec-phone-part[]"]'
      );
      phone = visiblePhone?.value?.trim() || "";
    }

    // +7 (904) 101-01-01 -> +79041010101
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

      (document.querySelector(".t-form") || document.body)
        .appendChild(box);
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

  async function proxyPost(endpoint, body) {
    const url =
      PROXY_BASE_URL.replace(/\/+$/, "") + endpoint;

    console.log("[Tilda Auth] POST via proxy:", url);
    console.log("[Tilda Auth] body:", body);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    console.log(
      "[Tilda Auth] API response:",
      response.status,
      data
    );

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

  function getToken(data) {
    return (
      data?.token ||
      data?.access_token ||
      data?.data?.token ||
      data?.data?.access_token ||
      ""
    );
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
      const data = await proxyPost(ENDPOINTS.login, {
        login,
        password,
        phone: "",
      });

      const token = getToken(data);

      if (!token) {
        throw new Error("Сервер не вернул token");
      }

      localStorage.setItem(TOKEN_KEY, token);
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
      await proxyPost(ENDPOINTS.register, {
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

      await proxyPost(ENDPOINTS.registerPin, {
        login,
      });

      window.location.href = "/confirm";
    } catch (error) {
      showError(error.message || "Ошибка регистрации");
      setLoading(button, false);
    }
  }

  async function confirm(button) {
    clearError();

    const pin = getCode();
    const login =
      localStorage.getItem(REGISTER_PHONE_KEY) || "";

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
      const data = await proxyPost(
        ENDPOINTS.registerPinConfirm,
        {
          pin,
          login,
        }
      );

      const token = getToken(data);

      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      }

      window.location.href = "/status";
    } catch (error) {
      showError(
        error.message || "Ошибка подтверждения кода"
      );
      setLoading(button, false);
    }
  }

  function handleSubmit(button) {
    const path = currentPath();

    if (path === "/auth") return login(button);
    if (path === "/register") return register(button);
    if (path === "/confirm") return confirm(button);
  }

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

  if (currentPath() === "/status") {
    const token =
      localStorage.getItem(TOKEN_KEY) || "";

    const element =
      document.querySelector(".auth-token");

    if (element) {
      if (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA"
      ) {
        element.value = token;
      } else {
        element.textContent = token;
      }
    }
  }

  console.log("[Tilda Auth Proxy] loaded");
})();
