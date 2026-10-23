// Резервная копия базы: каждая коллекция — отдельный JSON-файл, плюс all.json для восстановления через профиль.
// Запускается GitHub Actions раз в сутки и сохраняет файлы в приватный репозиторий.
// В лог пишутся только количества.
import admin from 'firebase-admin';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
if (!sa.project_id) { console.log('Нет секрета FIREBASE_SERVICE_ACCOUNT — пропускаю.'); process.exit(0); }
const OUT = process.env.BACKUP_DIR || 'backup';
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const COLLECTIONS = ['songs', 'services', 'events', 'members', 'feed', 'suggestions', 'lessons', 'tasks', 'warmups',
  'access', 'avail', 'votes', 'notes', 'feedback', 'meta'];

const plain = v => {
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]));
  return v;
};

mkdirSync(OUT, { recursive: true });
const all = { exportedAt: new Date().toISOString(), version: 1 };
const counts = [];
for (const c of COLLECTIONS) {
  const snap = await db.collection(c).get();
  const rows = snap.docs
    .map(d => ({ id: d.id, ...plain(d.data()) }))
    .filter(r => !r.deleted)
    .sort((a, b) => a.id.localeCompare(b.id));
  rows.forEach(r => delete r.u);
  writeFileSync(join(OUT, `${c}.json`), JSON.stringify(rows, null, 2) + '\n');
  all[c] = rows;
  counts.push(`${c}: ${rows.length}`);
}
writeFileSync(join(OUT, 'all.json'), JSON.stringify(all, null, 2) + '\n');
console.log('Сохранено — ' + counts.join(', '));
process.exit(0);
