(function () {
  'use strict';

  const TOKEN_KEY = 'tildaAuthToken';
  const REGISTER_PHONE_KEY = 'tildaRegisterPhone';

  function getPath() {
    return window.location.pathname.replace(/\/+$/, '') || '/';
  }

  function getForm() {
    return document.querySelector('.t-form');
  }

  function getInput(name) {
    return document.querySelector('[name="' + name + '"]');
  }

  function getPhone() {
    // Основное значение, которое Tilda сама заполняет из маски
    const hiddenPhone = getInput('phone');

    if (hiddenPhone && hiddenPhone.value) {
      return hiddenPhone.value.trim();
    }

    // Запасной вариант — видимое поле телефонной маски
    const visiblePhone = document.querySelector(
      'input[name="tildaspec-phone-part[]"]'
    );

    if (visiblePhone && visiblePhone.value) {
      return visiblePhone.value.trim();
    }

    return '';
  }

  function getPassword() {
    const input = getInput('password');
    return input ? input.value.trim() : '';
  }

  function getCode() {
    const input = getInput('code');
    return input ? input.value.trim() : '';
  }

  function showError(message) {
    console.error('[Tilda Auth]', message);

    let box = document.querySelector('.auth-error');

    if (!box) {
      box = document.createElement('div');
      box.className = 'auth-error';

      box.style.marginTop = '15px';
      box.style.color = 'red';
      box.style.fontSize = '14px';

      const form = getForm();

      if (form) {
        form.appendChild(box);
      } else {
        document.body.appendChild(box);
      }
    }

    box.textContent = message;
    box.style.display = 'block';
  }

  function clearError() {
    const box = document.querySelector('.auth-error');

    if (box) {
      box.textContent = '';
      box.style.display = 'none';
    }
  }

  function setLoading(button, loading) {
    if (!button) return;

    button.disabled = loading;

    const text = button.querySelector('.t-submit__text');

    if (text) {
      text.textContent = loading ? 'Загрузка...' : 'SUBMIT';
    }
  }

  function saveToken(token) {
    if (!token) {
      throw new Error('Сервер не вернул token');
    }

    localStorage.setItem(TOKEN_KEY, token);
  }

  function getTokenFromResponse(response) {
    if (!response) return '';

    // Наш authService.login уже нормализует ответ
    if (response.token) {
      return response.token;
    }

    if (response.access_token) {
      return response.access_token;
    }

    if (response.data) {
      if (response.data.token) {
        return response.data.token;
      }

      if (response.data.access_token) {
        return response.data.access_token;
      }
    }

    return '';
  }

  async function handleLogin(button) {
    clearError();

    const phone = getPhone();
    const password = getPassword();

    if (!phone) {
      showError('Введите номер телефона');
      return;
    }

    if (!password) {
      showError('Введите пароль');
      return;
    }

    setLoading(button, true);

    try {
      console.log('[Tilda Auth] LOGIN', {
        login: phone
      });

      const result = await TildaAuth.login({
        login: phone,
        password: password
      });

      console.log('[Tilda Auth] LOGIN RESPONSE', result);

      const token = getTokenFromResponse(result);

      saveToken(token);

      window.location.href = '/status';

    } catch (error) {
      console.error('[Tilda Auth] LOGIN ERROR', error);

      showError(
        error && error.message
          ? error.message
          : 'Не удалось выполнить вход'
      );

      setLoading(button, false);
    }
  }

  async function handleRegister(button) {
    clearError();

    const phone = getPhone();
    const password = getPassword();

    if (!phone) {
      showError('Введите номер телефона');
      return;
    }

    if (!password) {
      showError('Введите пароль');
      return;
    }

    setLoading(button, true);

    try {
      console.log('[Tilda Auth] REGISTER', {
        login: phone
      });

      const registerResult = await TildaAuth.register({
        login: phone,
        password: password,
        politicAgreements: true
      });

      console.log(
        '[Tilda Auth] REGISTER RESPONSE',
        registerResult
      );

      /*
       * Сохраняем телефон, потому что на следующей странице
       * нужно будет понять, для какого пользователя подтверждаем PIN.
       */
      localStorage.setItem(
        REGISTER_PHONE_KEY,
        phone
      );

      console.log('[Tilda Auth] SEND REGISTER PIN');

      const pinResult = await TildaAuth.sendRegisterPin({
        login: phone
      });

      console.log(
        '[Tilda Auth] SEND PIN RESPONSE',
        pinResult
      );

      window.location.href = '/confirm';

    } catch (error) {
      console.error('[Tilda Auth] REGISTER ERROR', error);

      showError(
        error && error.message
          ? error.message
          : 'Не удалось зарегистрировать пользователя'
      );

      setLoading(button, false);
    }
  }

  async function handleConfirm(button) {
    clearError();

    const code = getCode();
    const phone = localStorage.getItem(REGISTER_PHONE_KEY);

    if (!phone) {
      showError('Не найден номер телефона для подтверждения');
      return;
    }

    if (!code) {
      showError('Введите код из SMS');
      return;
    }

    setLoading(button, true);

    try {
      console.log('[Tilda Auth] CONFIRM PIN', {
        login: phone,
        pin: code
      });

      const result = await TildaAuth.confirmRegisterPin({
        login: phone,
        pin: code
      });

      console.log(
        '[Tilda Auth] CONFIRM RESPONSE',
        result
      );

      const token = getTokenFromResponse(result);

      /*
       * Если подтверждение сразу возвращает token —
       * сохраняем его.
       */
      if (token) {
        saveToken(token);
      }

      window.location.href = '/status';

    } catch (error) {
      console.error('[Tilda Auth] CONFIRM ERROR', error);

      showError(
        error && error.message
          ? error.message
          : 'Неверный код или ошибка подтверждения'
      );

      setLoading(button, false);
    }
  }

  function handleSubmit(button) {
    const path = getPath();

    console.log('[Tilda Auth] INTERCEPT SUBMIT', path);

    if (path === '/auth') {
      handleLogin(button);
      return;
    }

    if (path === '/register') {
      handleRegister(button);
      return;
    }

    if (path === '/confirm') {
      handleConfirm(button);
      return;
    }
  }

  /*
   * Самое важное:
   *
   * Перехватываем CLICK в capture-фазе.
   *
   * Это происходит ДО того, как Tilda успевает
   * обработать .t-submit своим обработчиком.
   */
  function installClickInterceptor() {
    document.addEventListener(
      'click',
      function (event) {
        const button = event.target.closest('.t-submit');

        if (!button) {
          return;
        }

        const path = getPath();

        if (
          path !== '/auth' &&
          path !== '/register' &&
          path !== '/confirm'
        ) {
          return;
        }

        console.log(
          '[Tilda Auth] SUBMIT BUTTON INTERCEPTED'
        );

        /*
         * Полностью останавливаем штатную обработку Tilda.
         */
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        handleSubmit(button);
      },
      true
    );
  }

  /*
   * Дополнительная защита от обычного submit.
   */
  function installSubmitInterceptor() {
    document.addEventListener(
      'submit',
      function (event) {
        const form = event.target;

        if (!form || !form.classList.contains('t-form')) {
          return;
        }

        const path = getPath();

        if (
          path !== '/auth' &&
          path !== '/register' &&
          path !== '/confirm'
        ) {
          return;
        }

        console.log(
          '[Tilda Auth] FORM SUBMIT INTERCEPTED'
        );

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      },
      true
    );
  }

  function init() {
    console.log('[Tilda Auth] initialized');
    console.log('[Tilda Auth] path:', getPath());
    console.log('[Tilda Auth] TildaAuth:', window.TildaAuth);

    if (!window.TildaAuth) {
      console.error(
        '[Tilda Auth] TildaAuth is not loaded'
      );
      return;
    }

    installClickInterceptor();
    installSubmitInterceptor();

    /*
     * Проверяем status отдельно.
     */
    if (getPath() === '/status') {
      const token = localStorage.getItem(TOKEN_KEY);
      const element = document.querySelector('.auth-token');

      console.log('[Tilda Auth] STATUS TOKEN:', token);

      if (element) {
        if (
          element.tagName === 'INPUT' ||
          element.tagName === 'TEXTAREA'
        ) {
          element.value = token || '';
        } else {
          element.textContent = token || '';
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
