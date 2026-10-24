// Сервис-воркер: приложение открывается без интернета, а push-уведомления приходят, даже когда оно закрыто.
// После изменения файлов приложения увеличьте VERSION — телефоны подтянут новую версию.
const VERSION = 'v13';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-v1';

const FILES = [
  './', './index.html', './manifest.webmanifest', './firebase-config.js',
  './css/app.css',
  './js/main.js', './js/store.js', './js/model.js', './js/ui.js', './js/dates.js', './js/chords.js', './js/demo.js', './js/projector.js', './js/pull.js', './js/capo.js', './js/categories.js',
  './js/views/home.js', './js/views/schedule.js', './js/views/songs.js', './js/views/perform.js', './js/views/more.js',
  './js/views/team.js', './js/views/suggestions.js', './js/views/study.js', './js/views/tasks.js', './js/views/warmups.js',
  './js/views/feedback.js', './js/views/profile.js', './js/views/auth.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

/* ——— push (Firebase Cloud Messaging) ——— */
try {
  importScripts('./firebase-config.js');
  if (self.FIREBASE_CONFIG && self.FIREBASE_CONFIG.apiKey) {
    importScripts(
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
    firebase.initializeApp(self.FIREBASE_CONFIG);
    // Уведомления с заголовком и текстом показываются автоматически.
    firebase.messaging();
  }
} catch (e) { /* без сети или без настроек — офлайн-режим всё равно работает */ }

// Нажатие на уведомление открывает приложение (ссылку задаёт скрипт рассылки через fcmOptions.link).

/* ——— офлайн ——— */
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
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
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put('./index.html', copy)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // Файлы приложения: сразу из кэша, параллельно обновляем.
  event.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    if (hit) { event.waitUntil(net); return hit; }
    return net;
  }));
});
