// Профиль: кто я в команде, уведомления, офлайн, резервная копия, выход.
import { S, putMine, loadDemo, removeDemo, resetLocal, isCloud, signOutUser, pushSupport, enablePush, exportData, importData, ls } from '../store.js';
import { h, icon, run, bar, avatar, confirmSheet, toast } from '../ui.js';
import { me, membersSorted, roleLabel, upcoming, svcSongs, PERM } from '../model.js';
import { openReset } from './auth.js';
import { fmt, today } from '../dates.js';

export function render(el, p, nav) {
  const M = me();
  el.append(bar('Профиль', nav));

  el.append(h('section.card',
    h('div.row.nowrap',
      M.member ? avatar(M.member.name, '.lg.ink') : h('span.li-ic', icon('user', 20)),
      h('div.grow',
        h('b', M.member ? M.member.name : (S.user && S.user.name) || 'Вы'),
        h('div.small.muted', M.member ? (M.roles.map(roleLabel).join(', ') || 'Роль не указана') : 'Не привязаны к служителю'),
        S.user && S.user.email ? h('div.small.muted.ellip', S.user.email) : null,
        S.isLeader ? h('div.small.muted', 'Лидер команды') : null)),
    S.isLeader && S.members.length ? h('div.fld', h('span', 'Я в списке служителей —'),
      h('select#pf-me', {
        value: M.memberId || '',
        onchange: e => run(() => putMine('links', { memberId: e.target.value || null, email: (S.user && S.user.email) || '' }), 'Сохранено'),
      }, h('option', { value: '' }, 'Не выбрано'), membersSorted().map(m => h('option', { value: m.id }, m.name)))) : null,
    !S.isLeader && S.perms.length ? h('div.chips', h('span.small.muted', 'Ваши права:'), S.perms.map(k => h('span.chip', (PERM[k] || { label: k }).label))) : null,
    !S.isLeader && isCloud() ? h('p.hint', 'Имя и роли меняет лидер в разделе «Команда».') : null,
    isCloud() && S.user && S.user.email ? h('button.btn.ghost.sm', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => openReset(S.user.email) }, 'Сменить пароль') : null));

  // Уведомления
  if (isCloud()) el.append(pushCard(nav));

  // Офлайн
  const ups = upcoming().slice(0, 3);
  const nearSongs = new Set(ups.flatMap(s => svcSongs(s).map(x => x.songId)));
  el.append(h('section.card',
    h('div.card-h', h('h2.h2', 'Без интернета'), icon('cloud', 22)),
    h('p.small.muted', 'Все песни и расписание сохраняются на этом устройстве. Если в день служения пропадёт связь, слова и аккорды всё равно откроются.'),
    h('div.row',
      h('span.chip', `${S.songs.length} песен на устройстве`),
      nearSongs.size ? h('span.chip', `${nearSongs.size} в ближайших служениях`) : null),
    h('p.small.muted.mono', S.mode === 'local' ? 'Демо-режим: данные только на этом устройстве'
      : S.syncedAt ? `Синхронизировано: ${fmt.stamp(S.syncedAt)}` : 'Ещё не синхронизировано')));

  // Резервная копия
  if (S.isLeader) {
    const fileIn = h('input', {
      type: 'file', accept: 'application/json,.json', hidden: true,
      onchange: async e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        let obj;
        try { obj = JSON.parse(await f.text()); } catch { return toast('Это не файл резервной копии'); }
        confirmSheet('Восстановить из копии?', 'Записи из файла будут добавлены в базу. Совпадающие записи заменятся версией из файла, новые ваши записи останутся.', 'Восстановить', async () => {
          let n = 0;
          if (await run(async () => { n = await importData(obj); })) toast(`Восстановлено записей: ${n}`);
        });
        e.target.value = '';
      },
    });
    el.append(h('section.card',
      h('h2.h2', 'Резервная копия'),
      h('p.small.muted', 'Вся база одним файлом: песни, расписание, команда, уроки, задачи. Храните его у себя — из него можно всё восстановить.'),
      h('div.row',
        h('button.btn.soft', {
          type: 'button', onclick: () => {
            const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `worship-backup-${today()}.json` });
            document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
          },
        }, icon('down', 18), 'Скачать копию'),
        h('button.btn.ghost', { type: 'button', onclick: () => fileIn.click() }, icon('up', 18), 'Восстановить'),
        fileIn),
      isCloud() ? h('p.hint', 'Кроме этого, GitHub каждую ночь сам сохраняет копию в приватный репозиторий (если настроен бэкап из инструкции).') : null));

    const demoCount = ['songs', 'services', 'members', 'events', 'lessons', 'tasks', 'warmups', 'suggestions', 'feed', 'categories'].reduce((n, c) => n + S[c].filter(r => r.demo).length, 0);
    el.append(h('section.card',
      h('h2.h2', 'Пример данных'),
      h('p.small.muted', 'Пример помогает быстро посмотреть, как всё работает. Примерные записи удаляются одной кнопкой, ваши данные не затрагиваются.'),
      h('div.row',
        demoCount ? h('button.btn.ghost', {
          type: 'button', onclick: () => confirmSheet('Удалить пример?', `Будет удалено записей: ${demoCount}. Ваши песни, служения и люди останутся.`, 'Удалить пример', () => run(removeDemo, 'Пример удалён')),
        }, icon('trash', 18), `Удалить пример · ${demoCount}`)
          : h('button.btn.ghost', { type: 'button', onclick: () => run(loadDemo, 'Пример загружен') }, 'Заполнить примером'),
        S.mode === 'local' ? h('button.btn.ghost', { type: 'button', onclick: () => confirmSheet('Начать демо заново?', 'Все изменения на этом устройстве будут сброшены к исходному примеру.', 'Сбросить', () => { resetLocal(); }) }, icon('refresh', 18), 'Сбросить демо') : null)));
  }

  el.append(h('section.card',
    h('h2.h2', 'Иконка на главном экране'),
    h('div.stack.small',
      h('div', h('b', 'iPhone: '), 'откройте приложение в Safari → «Поделиться» → «На экран „Домой“».'),
      h('div', h('b', 'Android: '), 'в Chrome меню ⋮ → «Добавить на главный экран» или «Установить приложение».'))));

  if (isCloud()) el.append(h('button.btn.ghost', { type: 'button', onclick: () => confirmSheet('Выйти из аккаунта?', 'Сохранённые на телефоне данные будут удалены. Войти можно снова в любой момент.', 'Выйти', () => signOutUser()) }, 'Выйти из аккаунта'));
}

function pushCard(nav) {
  const sup = pushSupport();
  const on = sup.ok && sup.permission === 'granted' && ls.get('wt.push');
  let body;
  if (!sup.ok && sup.reason === 'ios-home') body = h('p.small.muted', 'На iPhone уведомления работают, когда приложение добавлено на главный экран. Добавьте иконку (ниже), откройте приложение с неё и включите уведомления здесь.');
  else if (!sup.ok && sup.reason === 'nokey') body = h('p.small.muted', 'Push ещё не настроены: лидеру нужно добавить ключ из инструкции (шаг «Push-уведомления»).');
  else if (!sup.ok) body = h('p.small.muted', 'Этот браузер не поддерживает push-уведомления. Уведомления будут в ленте на главном экране.');
  else if (sup.permission === 'denied') body = h('p.small.muted', 'Уведомления запрещены в настройках браузера. Разрешите их для этого сайта и вернитесь сюда.');
  else body = h('div.stack',
    h('p.small.muted', on ? 'Уведомления включены на этом устройстве: напоминания о служениях и репетициях, изменения в составе, объявления.' : 'Включите, чтобы получать напоминания о служениях и репетициях, изменения в составе и объявления.'),
    h('button.btn' + (on ? '.soft' : ''), {
      type: 'button', onclick: async () => {
        try { await enablePush(); toast('Уведомления включены'); nav.refresh(); }
        catch (e) { console.warn(e); toast(e && e.message === 'denied' ? 'Вы не разрешили уведомления' : 'Не получилось включить уведомления'); nav.refresh(); }
      },
    }, icon('bell', 18), on ? 'Обновить подписку' : 'Включить уведомления'));
  return h('section.card', h('div.card-h', h('h2.h2', 'Уведомления'), icon('bell', 22)), body);
}
