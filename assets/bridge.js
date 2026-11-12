/**
 * Клиент моста для страниц портала.
 * Работает только внутри оболочки MiniAppHub: window.parent !== window.
 * @module bridge
 */
const IN = 'mapp';
const OUT = 'mapp-shell';

let seq = 0;
/** @type {Map<number, Function>} */
const pending = new Map();

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || msg.source !== OUT || msg.id == null) return;
  const done = pending.get(msg.id);
  if (done) { pending.delete(msg.id); done(msg.response); }
});

/** Запущена ли страница внутри оболочки. */
export const inShell = window.parent !== window;

/**
 * @param {string} namespace
 * @param {string} action
 * @param {Object} [params]
 * @returns {Promise<{ ok:boolean, result?:any, error?:string }>}
 */
export function call(namespace, action, params = {}) {
  if (!inShell) return Promise.resolve({ ok: false, error: 'not-in-shell' });
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: 'timeout' }); }, 8000);
    pending.set(id, (response) => { clearTimeout(timer); resolve(response); });
    window.parent.postMessage({ source: IN, id, namespace, action, params }, '*');
  });
}

/** Список установленных приложений или пустой массив вне оболочки. */
export async function installed() {
  const res = await call('apps', 'getInstalled');
  return res.ok && Array.isArray(res.result) ? res.result : [];
}

/**
 * Установить приложение по id из каталога.
 * @param {string} id
 */
export async function install(id) {
  const res = await call('apps', 'installApp', { id });
  if (!res.ok) throw new Error(res.error || 'install failed');
  return res.result;
}
