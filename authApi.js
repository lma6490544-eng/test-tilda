(function (window) {
  'use strict';

  const config = Object.assign({
    baseUrl: '',
    paths: {
      login: '/auth/login',
      register: '/auth/register',
      registerPin: '/auth/register-pin',
      registerPinConfirm: '/auth/register-pin/confirm'
    }
  }, window.TILDA_AUTH_CONFIG || {});

  function url(path) {
    return `${config.baseUrl.replace(/\/$/, '')}${path}`;
  }

  async function request({ method = 'POST', path, body }) {
    try {
      const response = await fetch(url(path), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body == null ? undefined : JSON.stringify(body),
        credentials: 'include'
      });

      let data = null;
      try {
        data = await response.json();
      } catch (_) {}

      return {
        ok: response.ok,
        status: response.status,
        data,
        error: data?.error || data?.message || null
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: error?.message || 'Ошибка соединения с сервером'
      };
    }
  }

  window.TildaAuthApi = {
    login(credentials) {
      return request({
        method: 'POST',
        path: config.paths.login,
        body: credentials
      });
    },

    register(payload) {
      return request({
        method: 'POST',
        path: config.paths.register,
        body: payload
      });
    },

    sendRegisterPin(payload) {
      return request({
        method: 'POST',
        path: config.paths.registerPin,
        body: payload
      });
    },

    confirmRegisterPin(payload) {
      return request({
        method: 'POST',
        path: config.paths.registerPinConfirm,
        body: payload
      });
    }
  };
})(window);
