(function () {
  "use strict";

  const API_BASE_URL =
    "https://itprorab.metasymbiont.com/api/v1";

  const PLATFORM_VERSION = "web-1.0.0";

  const TOKEN_KEY = "tildaAuthToken";
  const REGISTER_PHONE_KEY = "tildaRegisterPhone";
  const REGISTER_PASSWORD_KEY = "tildaRegisterPassword";

  const ENDPOINTS = {
    login: "/auth/login",
    registerPin: "/auth/user/phone/pin",
    registerPinConfirm: "/auth/user/phone/pin/confirm",
    registerUser: "/auth/user",
    user: "/lk/user",
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
    // Current Tilda confirm field.
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

  async function apiRequest(method, endpoint, body, token) {
    const url = API_BASE_URL + endpoint;

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

    console.log("[Tilda Auth] " + method + ":", url);

    if (body !== undefined) {
      console.log("[Tilda Auth] request body:", body);
    }

    const response = await fetch(url, {
      method: method,
      headers: headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    console.log(
      "[Tilda Auth] response:",
      response.status,
      data
    );

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          data?.detail ||
          data?.status ||
          ("Ошибка API: " + response.status)
      );
    }

    return data;
  }

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
      throw new Error("Сервер не вернул token");
    }

    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("authToken", token);

    console.log("[Tilda Auth] auth token saved");
  }

  async function loginWithCredentials(login, password) {
    const data = await apiRequest(
      "POST",
      ENDPOINTS.login,
      {
        login,
        password,
      }
    );

    const token = getToken(data);

    if (!token) {
      console.error("[Tilda Auth] Login response:", data);
      throw new Error("Сервер не вернул token");
    }

    saveToken(token);

    return token;
  }

  async function loadUserAndGoToStatus() {
    const token =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem("authToken") ||
      "";

    if (!token) {
      throw new Error("Не найден токен авторизации");
    }

    const user = await apiRequest(
      "GET",
      ENDPOINTS.user,
      undefined,
      token
    );

    const fullName = [user?.name, user?.surname]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) {
      localStorage.setItem("tildaUserName", fullName);
    }

    window.location.href = "/status";
  }

  async function login(button) {
    clearError();

    const loginValue = getPhone();
    const password = getPassword();

    if (!loginValue) {
      showError("Введите номер телефона");
      return;
    }

    if (!password) {
      showError("Введите пароль");
      return;
    }

    setLoading(button, true);

    try {
      await loginWithCredentials(loginValue, password);
      await loadUserAndGoToStatus();
    } catch (error) {
      showError(error.message || "Ошибка авторизации");
      setLoading(button, false);
    }
  }

  async function sendRegisterPin(button) {
    clearError();

    const loginValue = getPhone();
    const password = getPassword();

    if (!loginValue) {
      showError("Введите номер телефона");
      return;
    }

    if (!password) {
      showError("Введите пароль");
      return;
    }

    setLoading(button, true);

    try {
      // Registration now starts with sending the PIN.
      await apiRequest(
        "POST",
        ENDPOINTS.registerPin,
        {
          login: loginValue,
        }
      );

      // Keep these only for the next confirmation step.
      sessionStorage.setItem(
        REGISTER_PHONE_KEY,
        loginValue
      );

      sessionStorage.setItem(
        REGISTER_PASSWORD_KEY,
        password
      );

      window.location.href = "/confirm";
    } catch (error) {
      showError(
        error.message || "Не удалось отправить код"
      );
      setLoading(button, false);
    }
  }

  async function confirmRegisterPin(button) {
    clearError();

    const pin = getCode();

    const loginValue =
      sessionStorage.getItem(REGISTER_PHONE_KEY) || "";

    const password =
      sessionStorage.getItem(REGISTER_PASSWORD_KEY) || "";

    if (!loginValue) {
      showError(
        "Не найден номер телефона для подтверждения"
      );
      return;
    }

    if (!password) {
      showError(
        "Не найден пароль для завершения регистрации"
      );
      return;
    }

    if (!pin) {
      showError("Введите код из SMS");
      return;
    }

    setLoading(button, true);

    try {
      const confirmation = await apiRequest(
        "POST",
        ENDPOINTS.registerPinConfirm,
        {
          pin,
          login: loginValue,
        }
      );

      if (confirmation?.status !== "PHONE_CONFIRMED") {
        const attempts =
          confirmation?.attemptsLeft;

        const attemptsText =
          typeof attempts === "number"
            ? " Осталось попыток: " + attempts + "."
            : "";

        throw new Error(
          "Телефон не подтверждён." + attemptsText
        );
      }

      // Phone is confirmed. Create the user immediately.
      // hash is a client-generated UUID (request id).
      const userResult = await apiRequest(
        "POST",
        ENDPOINTS.registerUser,
        {
          login: loginValue,
          password: password,
          politicAgreements: true,
          hash: crypto.randomUUID(),
        }
      );

      const token = getToken(userResult);

      if (!token) {
        console.error("[Tilda Auth] User creation response:", userResult);
        throw new Error("Сервер не вернул token после регистрации");
      }

      saveToken(token);

      // Password and phone are no longer needed.
      sessionStorage.removeItem(
        REGISTER_PASSWORD_KEY
      );
      sessionStorage.removeItem(
        REGISTER_PHONE_KEY
      );

      // Use the token returned by /auth/user to get the user's name.
      await loadUserAndGoToStatus();
    } catch (error) {
      showError(
        error.message ||
          "Ошибка подтверждения кода"
      );
      setLoading(button, false);
    }
  }

  function fillStatusName() {
    if (currentPath() !== "/status") return;

    const fullName =
      localStorage.getItem("tildaUserName") || "";

    if (!fullName) {
      console.warn(
        "[Tilda Auth] User name is not available"
      );
      return;
    }

    const element = document.querySelector(
      ".auth-token .tn-atom"
    );

    if (!element) {
      console.warn(
        "[Tilda Auth] .auth-token .tn-atom not found"
      );
      return;
    }

    // Exactly one write.
    element.textContent = fullName;

    console.log(
      "[Tilda Auth] user name displayed"
    );
  }

  function handleSubmit(button) {
    const path = currentPath();

    if (path === "/" || path === "/auth") {
      return login(button);
    }

    if (path === "/register") {
      return sendRegisterPin(button);
    }

    if (path === "/confirm") {
      return confirmRegisterPin(button);
    }
  }

  // Intercept Tilda's native form before its own submit handler.
  document.addEventListener(
    "click",
    function (event) {
      const button = event.target.closest(".t-submit");

      if (!button) return;

      const path = currentPath();

      if (
        path !== "/" &&
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
        path !== "/" &&
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
    document.addEventListener(
      "DOMContentLoaded",
      fillStatusName
    );
  } else {
    fillStatusName();
  }

  console.log("[Tilda Auth] registration flow v6 loaded");
})();
