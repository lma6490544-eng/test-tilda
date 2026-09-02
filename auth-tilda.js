(function(w,d){
'use strict';
const PHONE_KEY='tildaRegisterPhone', TOKEN_KEY='tildaAuthToken';
const P={auth:'/auth',register:'/register',confirm:'/confirm',status:'/status'};

function input(n){return d.querySelector('[name="'+n+'"]')}
function val(n){return input(n)?.value?.trim()||''}
function button(){
  const el=input('phone')||input('code'), form=el?.closest('form');
  return form?.querySelector('button[type="submit"],input[type="submit"],.t-submit,button') ||
         d.querySelector('button[type="submit"],input[type="submit"],.t-submit');
}
function error(msg){
  let e=d.querySelector('.auth-error');
  if(!e){e=d.createElement('div');e.className='auth-error';e.style.cssText='margin-top:12px;color:#d00';
    const a=input('password')||input('code')||button(); if(a?.parentNode)a.parentNode.appendChild(e); else d.body.appendChild(e)}
  e.textContent=msg;e.style.display='';
}
function clearError(){const e=d.querySelector('.auth-error');if(e){e.textContent='';e.style.display='none'}}
function loading(b,on){if(b)b.disabled=on}
function token(x){return x?.token||x?.access_token||x?.accessToken||x?.data?.token||x?.data?.access_token||x?.data?.accessToken||null}
function go(p){w.location.href=p}

async function login(){
 clearError();const phone=val('phone'),password=val('password');
 if(!phone)return error('Введите номер телефона');if(!password)return error('Введите пароль');
 const b=button();loading(b,true);
 try{const r=await w.TildaAuth.login({login:phone,password});if(!r.ok)return error(r.error||'Ошибка авторизации');
 const t=token(r.data);if(t)localStorage.setItem(TOKEN_KEY,t);go(P.status)}
 catch(e){error(e?.message||'Ошибка авторизации')}finally{loading(b,false)}
}
async function register(){
 clearError();const phone=val('phone'),password=val('password');
 if(!phone)return error('Введите номер телефона');if(!password)return error('Введите пароль');
 const b=button();loading(b,true);
 try{const r=await w.TildaAuth.register({login:phone,password,politicAgreements:true});
 if(!r.ok)return error(r.error||'Ошибка регистрации');
 localStorage.setItem(PHONE_KEY,phone);
 const pin=await w.TildaAuth.sendRegisterPin({login:phone});
 if(!pin.ok)return error(pin.error||'Не удалось отправить код');
 go(P.confirm)}
 catch(e){error(e?.message||'Ошибка регистрации')}finally{loading(b,false)}
}
async function confirm(){
 clearError();const phone=localStorage.getItem(PHONE_KEY),code=val('code');
 if(!phone)return error('Номер телефона не найден. Начните регистрацию заново.');if(!code)return error('Введите код из SMS');
 const b=button();loading(b,true);
 try{const r=await w.TildaAuth.confirmRegisterPin({login:phone,pin:code});
 if(!r.ok)return error(r.error||'Неверный СМС код');
 const t=token(r.data);if(t)localStorage.setItem(TOKEN_KEY,t);go(P.status)}
 catch(e){error(e?.message||'Ошибка подтверждения')}finally{loading(b,false)}
}
function status(){
 const t=localStorage.getItem(TOKEN_KEY);if(!t)return;
 d.querySelectorAll('.auth-token').forEach(e=>{if(e.matches('input,textarea'))e.value=t;else e.textContent=t});
}
function bind(fn){
 const el=input('phone')||input('code'),form=el?.closest('form'),b=button();
 if(form)form.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();fn()},true);
 else if(b)b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn()},true);
}
function init(){
 if(!w.TildaAuth){console.error('[TildaAuth] authService.js не загружен');return}
 const path=w.location.pathname.replace(/\/+$/,'')||'/';
 if(path===P.auth)bind(login);else if(path===P.register)bind(register);else if(path===P.confirm)bind(confirm);else if(path===P.status)status();
}
d.readyState==='loading'?d.addEventListener('DOMContentLoaded',init):init();
})(window,document);
