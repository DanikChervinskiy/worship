// Рассылка push-уведомлений. Запускается GitHub Actions каждые 15 минут.
// 1) Новые записи ленты (объявления, «вас добавили / сняли») — отправляет адресатам.
// 2) Напоминания: о служении — накануне вечером, о репетиции — за 3 часа.
// В лог пишутся только количества, без имён и текстов (логи публичного репозитория видны всем).
import admin from 'firebase-admin';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.log('Нет секрета FIREBASE_SERVICE_ACCOUNT — пропускаю.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const fcm = admin.messaging();
const APP_URL = (process.env.APP_URL || '').trim();

const now = Date.now();
const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Время в часовом поясе команды (TZ задаётся в workflow, по умолчанию Europe/Kyiv).
const at = (date, time) => new Date(`${date}T${time || '10:00'}:00`).getTime();
const DAY = 864e5, HOUR = 36e5;

// Кто есть кто
const [tokSnap, accSnap, rolesSnap] = await Promise.all([db.collection('tokens').get(), db.collection('access').get(), db.doc('meta/roles').get()]);
const tokens = {};            // uid → [token]
tokSnap.forEach(d => { tokens[d.id] = (d.data().list || []).filter(Boolean); });
const memberOf = {};          // uid → memberId
accSnap.forEach(d => { const m = d.data().memberId; if (m) memberOf[d.id] = m; });
const leaders = (rolesSnap.exists && rolesSnap.data().leaders) || [];
const allUids = [...new Set([...Object.keys(memberOf), ...leaders])];

const uidsFor = to => {
  if (to === 'all') return allUids;
  if (Array.isArray(to)) return Object.keys(memberOf).filter(u => to.includes(memberOf[u]));
  return [];
};

const bad = new Map();        // uid → Set(испорченных токенов)
let sent = 0;

async function send(uids, title, body) {
  const pairs = [];
  for (const u of uids) for (const t of tokens[u] || []) pairs.push([u, t]);
  for (let i = 0; i < pairs.length; i += 500) {
    const chunk = pairs.slice(i, i + 500);
    const message = { tokens: chunk.map(p => p[1]), notification: { title, body: body || '' } };
    if (APP_URL) {
      const base = APP_URL.replace(/\/?$/, '/');
      message.webpush = { fcmOptions: { link: base }, notification: { icon: base + 'icons/icon-192.png' } };
    }
    const res = await fcm.sendEachForMulticast(message);
    res.responses.forEach((r, k) => {
      if (r.success) { sent++; return; }
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument') {
        const [u, t] = chunk[k];
        if (!bad.has(u)) bad.set(u, new Set());
        bad.get(u).add(t);
      }
    });
  }
}

// 1) Лента
const feedSnap = await db.collection('feed').where('u', '>', admin.firestore.Timestamp.fromMillis(now - 3 * DAY)).get();
let feedCount = 0;
for (const d of feedSnap.docs) {
  const f = d.data();
  if (f.deleted || f.pushed) continue;
  if (f.demo) { await d.ref.update({ pushed: true }); continue; } // записи примера не рассылаем
  await send(uidsFor(f.to), f.title || 'Команда прославления', f.body || '');
  await d.ref.update({ pushed: true }); // поле u не трогаем, чтобы телефоны не скачивали запись заново
  feedCount++;
}

// 2) Напоминания
const from = dateStr(new Date(now - DAY)), to = dateStr(new Date(now + 2 * DAY));
const svcSnap = await db.collection('services').where('date', '>=', from).where('date', '<=', to).get();
let remCount = 0;
for (const d of svcSnap.docs) {
  const s = d.data();
  if (s.deleted || !s.published) continue;
  const team = new Set();
  Object.values(s.team || {}).forEach(arr => (arr || []).forEach(p => p.memberId && team.add(p.memberId)));
  const uids = Object.keys(memberOf).filter(u => team.has(memberOf[u]));
  if (!uids.length) continue;

  const remRef = db.collection('reminders').doc(d.id);
  const rem = (await remRef.get()).data() || {};
  const upd = {};

  const start = at(s.date, s.time);
  const songIds = (s.songs || []).map(x => x.songId).filter(Boolean);
  let titles = [];
  if (songIds.length) {
    const docs = await db.getAll(...songIds.map(id => db.collection('songs').doc(id)));
    titles = docs.filter(x => x.exists && !x.data().deleted).map(x => x.data().title);
  }
  const songsLine = titles.length ? `Песни: ${titles.join(', ')}` : '';
  const isToday = dateStr(new Date(now)) === s.date;

  // О служении: за 20 часов (накануне вечером), но не позже чем за час до начала.
  if (!rem.service && now >= start - 20 * HOUR && now < start - HOUR) {
    await send(uids, `${isToday ? 'Сегодня' : 'Завтра'} служение${s.time ? ' в ' + s.time : ''}`, [s.title, songsLine].filter(Boolean).join('. '));
    upd.service = true; remCount++;
  }
  // О репетиции: за 3 часа.
  if (s.rehearsal && s.rehearsal.date && !rem.rehearsal) {
    const r = at(s.rehearsal.date, s.rehearsal.time || '18:00');
    if (now >= r - 3 * HOUR && now < r) {
      await send(uids, `Репетиция сегодня в ${s.rehearsal.time || ''}`.trim(), [s.title, songsLine].filter(Boolean).join('. '));
      upd.rehearsal = true; remCount++;
    }
  }
  if (Object.keys(upd).length) await remRef.set(upd, { merge: true });
}

// Убираем адреса, на которые push больше не доставить (приложение удалено, разрешение отозвано).
for (const [u, set] of bad) {
  await db.collection('tokens').doc(u).set({ list: (tokens[u] || []).filter(t => !set.has(t)) }, { merge: true });
}

console.log(`Лента: ${feedCount}, напоминаний: ${remCount}, отправлено push: ${sent}, удалено устаревших адресов: ${[...bad.values()].reduce((n, s) => n + s.size, 0)}`);
process.exit(0);
