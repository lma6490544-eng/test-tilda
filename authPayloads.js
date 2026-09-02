
(function (window) {
  'use strict';
  
  const DEFAULT_REGISTER_CATEGORY =
    window.TILDA_AUTH_CONFIG?.defaultRegisterCategory || '';

  function buildLoginPayload({ login, password }) {
    return {
      login,
      password,
      phone: ''
    };
  }

  function buildRegisterPayload({
    login,
    password,
    hash,
    politicAgreements
  }) {
    const payload = {
      login,
      password,
      politicAgreements,
      categories: [DEFAULT_REGISTER_CATEGORY]
    };

    if (hash != null && hash !== '') {
      payload.hash = hash;
    }

    return payload;
  }

  function buildRegisterPinPayload({ login }) {
    return { login };
  }

  function buildRegisterPinConfirmPayload({ pin, login }) {
    return { pin, login };
  }

  window.TildaAuthPayloads = {
    buildLoginPayload,
    buildRegisterPayload,
    buildRegisterPinPayload,
    buildRegisterPinConfirmPayload
  };
})(window);
