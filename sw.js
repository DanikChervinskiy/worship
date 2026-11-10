// Сервис-воркер: приложение открывается без интернета, а push-уведомления приходят, даже когда оно закрыто.
// После изменения файлов приложения увеличьте VERSION — телефоны подтянут новую версию.
const VERSION = 'v28';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';

const FILES = [
  './', './index.html', './manifest.webmanifest', './firebase-config.js',
  './css/app.css',
  './js/main.js', './js/store.js', './js/model.js', './js/ui.js', './js/dates.js', './js/chords.js', './js/demo.js', './js/projector.js', './js/offers.js', './js/pull.js', './js/version.js', './js/langs.js', './js/capo.js', './js/categories.js',
  './js/views/home.js', './js/views/schedule.js', './js/views/songs.js', './js/views/perform.js', './js/views/more.js',
  './js/views/team.js', './js/views/suggestions.js', './js/views/study.js', './js/views/tasks.js', './js/views/warmups.js',
  './js/views/feedback.js', './js/views/profile.js', './js/views/auth.js', './js/views/settings.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

/* ——— push ——— */
// Уведомление показываем сами и ВСЕГДА — даже когда приложение открыто.
// Раньше этим занималась библиотека Firebase: при открытом приложении она молча передавала сообщение странице,
// и в шторке ничего не появлялось. А iPhone, получив несколько «невидимых» push, отключает подписку.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { notification: { body: event.data && event.data.text() } }; }
  const n = d.notification || {};
  const data = d.data || {};
  const title = n.title || data.title || 'Living Spring';
  const link = (d.fcmOptions && d.fcmOptions.link) || (d.fcm_options && d.fcm_options.link) || data.link || './';
  event.waitUntil(self.registration.showNotification(title, {
    body: n.body || data.body || '',
    icon: n.icon || './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: n.tag || undefined,
    data: { link },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || './';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow(link);
  }));
});

/* ——— офлайн ——— */
self.addEventListener('install', event => {
  // cache: 'reload' — берём свежие файлы с сервера, а не из кэша браузера (GitHub Pages держит его до 10 минут).
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Запросы к базе и входу не трогаем — их обрабатывает Firebase.
  if (/firestore\.googleapis\.com|identitytoolkit|securetoken|fcmregistrations|firebaseinstallations/.test(url.host)) return;

  // Библиотеки Firebase и шрифты: версия в адресе не меняется — берём из кэша.
  if (url.host === 'www.gstatic.com' || url.host === 'fonts.gstatic.com') {
    event.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.host === 'fonts.googleapis.com') {
    event.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Страница: сначала сеть (свежая версия), без сети — из кэша.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Файлы приложения: сразу из кэша, параллельно обновляем.
  event.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    if (hit) { event.waitUntil(net); return hit; }
    return net;
  }));
});
