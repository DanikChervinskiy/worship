// Хранилище данных.
// • Firebase (настройки в firebase-config.js): общая база команды, вход по почте.
// • Без настроек: демо-режим, данные только на этом устройстве.
// Всё, что пришло из облака, сохраняется на телефон: песни и расписание открываются без интернета,
// а при следующем входе скачиваются только изменения (так бесплатных лимитов Firebase хватает с запасом).
import { buildDemo } from './demo.js';
import { toast, errText } from './ui.js';

export const COLLS = ['songs', 'services', 'events', 'members', 'feed', 'suggestions', 'lessons', 'tasks', 'warmups', 'categories'];
// «Личные» коллекции: один документ на человека, id документа = id пользователя.
export const MINE = ['avail', 'votes', 'links', 'notes', 'feedback'];
const FS_NAME = { links: 'access' }; // привязка аккаунта к служителю хранится в коллекции access

export const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

export const S = {
  mode: 'loading',   // loading | cache | cloud | local
  auth: 'loading',   // loading | signedOut | setup | pending | ready | offline
  loaded: false,
  uid: null,
  user: null,        // { email, name }
  isLeader: false,
  perms: [],         // отдельные права, выданные лидером: songs, schedule, team, notify, study, tasks
  permsAll: {},      // (для лидера) права всех участников: uid → [..]
  leaders: [],
  requests: [],
  syncedAt: null,
  online: navigator.onLine,
};
COLLS.forEach(c => (S[c] = []));
MINE.forEach(c => (S[c] = {}));

export const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хранилище недоступно */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};

const subs = new Set();
let queued = false;
export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }
export function emit() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; subs.forEach(f => f()); }, 20);
}

const CACHE = 'wt.cache.v2';
const LOCAL = 'wt.local.v1';
let last = {}; // коллекция → время последнего полученного изменения (мс, время сервера)

function dataSnapshot() { const o = {}; [...COLLS, ...MINE].forEach(c => (o[c] = S[c])); return o; }
function apply(o) {
  if (!o) return;
  COLLS.forEach(c => { if (Array.isArray(o[c])) S[c] = o[c]; });
  MINE.forEach(c => { if (o[c] && typeof o[c] === 'object') S[c] = o[c]; });
}
let cacheTimer;
function saveCache() {
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => ls.set(CACHE, { at: Date.now(), uid: S.uid, isLeader: S.isLeader, perms: S.perms, user: S.user, last, data: dataSnapshot() }), 600);
}
function clearData() {
  COLLS.forEach(c => (S[c] = []));
  MINE.forEach(c => (S[c] = {}));
  last = {};
}

let fb = null;       // { app, auth, fs, A, F }
let unsubs = [];
let dataStarted = false;
const got = { roles: false, access: false };
let rolesExist = false;
let myAccess = null;

export const isCloud = () => !!fb;

export async function init() {
  addEventListener('online', () => { S.online = true; emit(); });
  addEventListener('offline', () => { S.online = false; emit(); });

  const cfg = self.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey) return startLocal();

  // Сначала показываем то, что сохранено на телефоне.
  const cached = ls.get(CACHE);
  if (cached && cached.uid && cached.data) {
    apply(cached.data);
    last = cached.last || {};
    S.uid = cached.uid; S.isLeader = !!cached.isLeader; S.perms = cached.perms || []; S.user = cached.user || null; S.syncedAt = cached.at;
    S.mode = 'cache'; S.auth = 'ready'; S.loaded = true;
    emit();
  }

  let appM, authM, fsM;
  try {
    [appM, authM, fsM] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  } catch (e) {
    console.warn('Firebase SDK не загрузился', e);
    if (!cached) { S.auth = 'offline'; S.loaded = true; }
    emit();
    return;
  }
  const app = appM.initializeApp(cfg);
  const auth = authM.getAuth(app);
  const fs = fsM.initializeFirestore(app, {});
  fb = { app, auth, fs, A: authM, F: fsM };
  authM.onAuthStateChanged(auth, onUser);
}

function stopAll() { unsubs.forEach(u => { try { u(); } catch { /* */ } }); unsubs = []; dataStarted = false; got.roles = got.access = false; }

function onUser(user) {
  const { F, fs } = fb;
  stopAll();
  if (!user) {
    if (S.uid) { clearData(); ls.del(CACHE); }
    S.uid = null; S.user = null; S.isLeader = false; S.perms = []; S.mode = 'cloud'; S.auth = 'signedOut'; S.loaded = true;
    emit();
    return;
  }
  if (S.uid && S.uid !== user.uid) { clearData(); ls.del(CACHE); }
  S.uid = user.uid;
  S.user = { email: user.email || '', name: user.displayName || '' };
  if (S.auth !== 'ready') { S.auth = 'loading'; }
  S.loaded = true;
  emit();

  unsubs.push(F.onSnapshot(F.doc(fs, 'meta', 'roles'), snap => {
    rolesExist = snap.exists();
    S.leaders = (snap.exists() && snap.data().leaders) || [];
    S.permsAll = (snap.exists() && snap.data().perms) || {};
    S.perms = S.permsAll[user.uid] || [];
    got.roles = true; recompute();
  }, err => { console.warn('roles', err); got.roles = true; rolesExist = true; recompute(); }));

  unsubs.push(F.onSnapshot(F.doc(fs, 'access', user.uid), snap => {
    myAccess = snap.exists() ? snap.data() : null;
    got.access = true; recompute();
  }, err => { console.warn('access', err); got.access = true; myAccess = null; recompute(); }));
}

function recompute() {
  if (!got.roles || !got.access) return;
  S.isLeader = S.leaders.includes(S.uid);
  if (!rolesExist) S.auth = 'setup';
  else if (S.isLeader || myAccess) { S.auth = 'ready'; startData(); watchRequests(); }
  else { S.auth = 'pending'; ensureRequest(); }
  emit();
}

async function ensureRequest() {
  const { F, fs } = fb;
  try {
    await F.setDoc(F.doc(fs, 'requests', S.uid), { name: S.user.name || '', email: S.user.email || '', at: F.serverTimestamp() }, { merge: true });
  } catch (e) { console.warn('request', e); }
}

function startData() {
  if (dataStarted) return;
  dataStarted = true;
  S.mode = 'cloud';
  const { F, fs } = fb;
  const pending = new Set([...COLLS, ...MINE]);
  const done = name => { if (pending.delete(name) && !pending.size) { S.loaded = true; } };

  for (const name of [...COLLS, ...MINE]) {
    const fsName = FS_NAME[name] || name;
    // Конспекты и отзывы обычный участник видит только свои.
    if ((name === 'notes' || name === 'feedback') && !S.isLeader) {
      unsubs.push(F.onSnapshot(F.doc(fs, fsName, S.uid), snap => {
        const d = snap.exists() ? snap.data() : null;
        S[name] = d && !d.deleted ? { [S.uid]: strip(d) } : {};
        done(name); saveCache(); emit();
      }, err => { console.warn(name, err); done(name); }));
      continue;
    }
    const since = last[name] || 0;
    const ref = F.collection(fs, fsName);
    const q = since ? F.query(ref, F.where('u', '>', F.Timestamp.fromMillis(since))) : ref;
    unsubs.push(F.onSnapshot(q, { includeMetadataChanges: true }, snap => {
      const isMine = MINE.includes(name);
      let arr = isMine ? null : S[name].slice();
      let map = isMine ? { ...S[name] } : null;
      let changed = false;
      for (const ch of snap.docChanges()) {
        const d = ch.doc;
        const data = d.data({ serverTimestamps: 'estimate' });
        const u = data.u && data.u.toMillis ? data.u.toMillis() : 0;
        if (!d.metadata.hasPendingWrites && u > (last[name] || 0)) last[name] = u;
        const gone = ch.type === 'removed' || data.deleted;
        if (isMine) {
          if (gone) delete map[d.id]; else map[d.id] = strip(data);
        } else {
          const i = arr.findIndex(x => x.id === d.id);
          if (gone) { if (i >= 0) arr.splice(i, 1); }
          else { const row = { ...strip(data), id: d.id }; if (i >= 0) arr[i] = row; else arr.push(row); }
        }
        changed = true;
      }
      if (changed) { S[name] = isMine ? map : arr; }
      if (!snap.metadata.fromCache) S.syncedAt = Date.now();
      done(name); saveCache(); emit();
    }, err => { console.warn(name, err); done(name); emit(); }));
  }

  emit();
}

// Заявки на вход видят лидер и те, кому выдано право «Команда».
let reqUnsub = null;
function watchRequests() {
  const allowed = S.isLeader || S.perms.includes('team');
  if (allowed && !reqUnsub) {
    const { F, fs } = fb;
    reqUnsub = F.onSnapshot(F.collection(fs, 'requests'), snap => {
      S.requests = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      emit();
    }, err => console.warn('requests', err));
    unsubs.push(() => { if (reqUnsub) { reqUnsub(); reqUnsub = null; } });
  } else if (!allowed && reqUnsub) { reqUnsub(); reqUnsub = null; S.requests = []; }
}

function strip(data) {
  const o = { ...data };
  delete o.u; delete o.deleted;
  for (const [k, v] of Object.entries(o)) if (v && typeof v.toMillis === 'function') o[k] = v.toMillis();
  return o;
}

/* ——— демо-режим ——— */

function startLocal() {
  const saved = ls.get(LOCAL);
  apply(saved || buildDemo());
  S.mode = 'local'; S.auth = 'ready'; S.uid = 'local'; S.isLeader = true; S.loaded = true;
  S.user = { email: '', name: 'Демо' };
  if (!saved) persistLocal();
  emit();
}
function persistLocal() { ls.set(LOCAL, dataSnapshot()); }

export function resetLocal() {
  ls.del(LOCAL);
  clearData();
  startLocal();
}

/* ——— запись ——— */

export const newId = () => {
  const r = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  return r.replace(/[^a-z0-9]/gi, '').slice(0, 20);
};
const clean = o => { const c = JSON.parse(JSON.stringify(o)); delete c.id; return c; };

// Firestore подтверждает запись, когда до неё дойдёт сервер. Без сети ждать не будем:
// изменение уже видно на экране и уйдёт само, как только появится связь.
async function commit(promise) {
  let timer, timedOut = false;
  const slow = new Promise(res => { timer = setTimeout(() => { timedOut = true; res('queued'); }, 2500); });
  // Если запись отклонят уже после ожидания, сообщим об этом отдельно.
  promise.catch(e => { if (timedOut) { console.error(e); toast(errText(e)); } });
  try { return await Promise.race([promise, slow]); } finally { clearTimeout(timer); }
}

export async function put(coll, data, id) {
  id = id || data.id || newId();
  const body = clean(data);
  if (S.mode === 'local') {
    if (coll === 'access' || coll === 'links') { S.links = { ...S.links, [id]: body }; persistLocal(); emit(); return id; }
    const arr = S[coll].slice();
    const i = arr.findIndex(x => x.id === id);
    const row = { ...body, id };
    if (i >= 0) arr[i] = row; else arr.push(row);
    S[coll] = arr;
    persistLocal(); emit();
    return id;
  }
  if (!fb || !S.uid) throw new Error('offline');
  const { F, fs } = fb;
  await commit(F.setDoc(F.doc(fs, FS_NAME[coll] || coll, id), { ...body, u: F.serverTimestamp() }));
  return id;
}

// Изменить отдельные поля, не трогая остальное (нужно, когда участнику разрешено менять только их).
export async function patch(coll, id, fields) {
  const body = JSON.parse(JSON.stringify(fields));
  if (S.mode === 'local') {
    S[coll] = S[coll].map(x => (x.id === id ? { ...x, ...body } : x));
    persistLocal(); emit();
    return;
  }
  if (!fb || !S.uid) throw new Error('offline');
  const { F, fs } = fb;
  await commit(F.updateDoc(F.doc(fs, FS_NAME[coll] || coll, id), { ...body, u: F.serverTimestamp() }));
}

export async function del(coll, id) {
  if (S.mode === 'local') {
    S[coll] = S[coll].filter(x => x.id !== id);
    persistLocal(); emit();
    return;
  }
  if (!fb || !S.uid) throw new Error('offline');
  const { F, fs } = fb;
  // «Мягкое» удаление: остальные телефоны узнают о нём при следующей синхронизации.
  await commit(F.setDoc(F.doc(fs, FS_NAME[coll] || coll, id), { deleted: true, u: F.serverTimestamp() }));
}

export async function putMine(coll, data) {
  if (!S.uid) throw new Error('noid');
  const body = clean(data);
  if (S.mode === 'local') {
    S[coll] = { ...S[coll], [S.uid]: body };
    persistLocal(); emit();
    return;
  }
  return put(coll, body, S.uid);
}

export const mine = coll => S[coll][S.uid] || null;

export async function loadDemo() {
  const d = buildDemo();
  for (const c of COLLS) for (const row of d[c] || []) await put(c, row, row.id);
}

export async function removeDemo() {
  for (const c of COLLS) for (const row of S[c].filter(r => r.demo)) await del(c, row.id);
}

/* ——— вход и доступ ——— */

export async function signIn(email, password) {
  await fb.A.signInWithEmailAndPassword(fb.auth, email, password);
}
export async function signUp(name, email, password) {
  const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, email, password);
  if (name) await fb.A.updateProfile(cred.user, { displayName: name });
  S.user = { email, name };
}
export async function resetPassword(email) {
  fb.auth.languageCode = 'ru';
  await fb.A.sendPasswordResetEmail(fb.auth, email);
}
export async function signOutUser() {
  ls.del(CACHE);
  await fb.A.signOut(fb.auth);
}
export async function claimLeader() {
  const { F, fs } = fb;
  await F.setDoc(F.doc(fs, 'meta', 'roles'), { leaders: [S.uid] });
}
export async function setLeaders(list) {
  const { F, fs } = fb;
  await commit(F.setDoc(F.doc(fs, 'meta', 'roles'), { leaders: list }, { merge: true }));
}
// Выдать или забрать отдельные права участнику.
export async function setPerms(uid, list) {
  if (S.mode === 'local') return;
  const { F, fs } = fb;
  const perms = { ...S.permsAll, [uid]: list };
  if (!list.length) delete perms[uid];
  await commit(F.setDoc(F.doc(fs, 'meta', 'roles'), { leaders: S.leaders, perms }));
}
export async function approveRequest(uid, memberId, email = '') {
  const { F, fs } = fb;
  await commit(F.setDoc(F.doc(fs, 'access', uid), { memberId, email, u: F.serverTimestamp() }));
  await commit(F.deleteDoc(F.doc(fs, 'requests', uid)));
}
export async function rejectRequest(uid) {
  const { F, fs } = fb;
  await commit(F.deleteDoc(F.doc(fs, 'requests', uid)));
}
// Закрыть доступ: документ удаляется полностью, иначе правила продолжат пускать.
export async function revokeAccess(uid) {
  const { F, fs } = fb;
  await commit(F.deleteDoc(F.doc(fs, 'access', uid)));
  if (S.permsAll[uid]) await setPerms(uid, []);
  const m = { ...S.links }; delete m[uid]; S.links = m; emit();
}

/* ——— push-уведомления ——— */

export function pushSupport() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return { ok: false, reason: ios && !standalone ? 'ios-home' : 'unsupported' };
  }
  if (!self.FIREBASE_VAPID_KEY) return { ok: false, reason: 'nokey' };
  return { ok: true, permission: Notification.permission };
}

export async function enablePush() {
  if (!fb || !S.uid) throw new Error('offline');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const m = await import(SDK + 'firebase-messaging.js');
  if (!(await m.isSupported())) throw new Error('unsupported');
  const reg = await navigator.serviceWorker.ready;
  const token = await m.getToken(m.getMessaging(fb.app), { vapidKey: self.FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
  const { F, fs } = fb;
  const ref = F.doc(fs, 'tokens', S.uid);
  const cur = await F.getDoc(ref);
  const list = new Set((cur.exists() && cur.data().list) || []);
  list.add(token);
  await F.setDoc(ref, { list: [...list].slice(-5), at: F.serverTimestamp() });
  ls.set('wt.push', token);
}

/* ——— резервная копия ——— */

export function exportData() {
  const out = { exportedAt: new Date().toISOString(), version: 1 };
  COLLS.forEach(c => (out[c] = S[c]));
  out.access = Object.entries(S.links).map(([id, v]) => ({ id, ...v }));
  return out;
}

export async function importData(obj) {
  let n = 0;
  for (const c of COLLS) {
    for (const row of Array.isArray(obj[c]) ? obj[c] : []) {
      if (!row || !row.id) continue;
      await put(c, row, row.id); n++;
    }
  }
  if (fb) for (const row of Array.isArray(obj.access) ? obj.access : []) {
    if (row && row.id && row.memberId) { await put('access', { memberId: row.memberId }, row.id); n++; }
  }
  return n;
}
