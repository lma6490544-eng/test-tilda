(function (window) {
  'use strict';

  const api = window.TildaAuthApi;
  const payloads = window.TildaAuthPayloads;

  if (!api || !payloads) {
    console.error('[TildaAuth] Load authApi.js and authPayloads.js first.');
    return;
  }

  const LOGIN_INVALID_CREDENTIALS_MESSAGE = 'Неверный номер или пароль';

  function normalizeAuthResponse(data) {
    if (!data || typeof data !== 'object') {
      return {
        token: null,
        refreshToken: null,
        category: null
      };
    }

    return {
      token: data.token ?? data.access_token ?? null,
      refreshToken: data.refreshToken ?? data.refresh_token ?? null,
      category: data.category ?? null
    };
  }

  function buildLoginErrorMessage(status, error) {
    if (status === 400) {
      return LOGIN_INVALID_CREDENTIALS_MESSAGE;
    }

    return error || 'Ошибка авторизации';
  }

  const service = {
    async login({ login, password }) {
      const requestPayload = payloads.buildLoginPayload({ login, password });
      const result = await api.login(requestPayload);

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: buildLoginErrorMessage(result.status, result.error),
          data: null
        };
      }

      return {
        ok: true,
        status: result.status,
        error: null,
        data: normalizeAuthResponse(result.data)
      };
    },

    async register({ login, password, hash, politicAgreements }) {
      const requestPayload = payloads.buildRegisterPayload({
        login,
        password,
        hash,
        politicAgreements
      });

      const result = await api.register(requestPayload);

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: result.error || 'Номер уже зарегистрирован',
          data: null
        };
      }

      return {
        ok: true,
        status: result.status,
        error: null,
        data: normalizeAuthResponse(result.data)
      };
    },

    async sendRegisterPin({ login }) {
      const requestPayload = payloads.buildRegisterPinPayload({ login });
      const result = await api.sendRegisterPin(requestPayload);

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: result.error || 'Не удалось отправить код',
          data: null
        };
      }

      if (result.data?.status !== 'PIN_SENT') {
        return {
          ok: false,
          status: result.status,
          error: 'Не удалось отправить код',
          data: null
        };
      }

      return {
        ok: true,
        status: result.status,
        error: null,
        data: result.data ?? {}
      };
    },

    async confirmRegisterPin({ pin, login }) {
      const requestPayload = payloads.buildRegisterPinConfirmPayload({
        pin,
        login
      });

      const result = await api.confirmRegisterPin(requestPayload);

      if (!result.ok) {
        return {
          ok: false,
          status: result.status,
          error: result.error || 'Неверный СМС код',
          data: null
        };
      }

      if (result.data?.status !== 'PHONE_CONFIRMED') {
        return {
          ok: false,
          status: result.status,
          error: 'Не удалось подтвердить номер',
          data: null
        };
      }

      return {
        ok: true,
        status: result.status,
        error: null,
        data: result.data ?? {}
      };
    }
  };

  window.TildaAuth = service;
})(window);
