// Обратная связь: ошибка, отзыв или идея. Видит только лидер.
import { S, putMine } from '../store.js';
import { h, icon, run, seg, empty, bar, toast } from '../ui.js';
import { myMemberId, nameOfUid } from '../model.js';
import { fmt } from '../dates.js';

const TYPES = [['bug', 'Ошибка'], ['review', 'Отзыв'], ['idea', 'Идея']];
const TYPE = Object.fromEntries(TYPES);
let type = 'bug';
let text = '';

export function render(el, p, nav) {
  el.append(bar('Обратная связь', nav));
  const mine = (S.feedback[S.uid] && S.feedback[S.uid].items) || [];

  el.append(h('section.card',
    h('div', h('h2.h2', 'Что нам стоит знать?'), h('p.small.muted', 'Сообщение увидит только лидер команды.')),
    seg(TYPES, type, v => { type = v; nav.refresh(); }, '.full'),
    h('textarea#fb-text', {
      rows: 6, value: text,
      placeholder: type === 'bug' ? 'Что случилось и на каком экране?' : type === 'idea' ? 'Что добавить или улучшить?' : 'Что понравилось, что неудобно?',
      oninput: e => (text = e.target.value),
    }),
    h('button.btn', {
      type: 'button', disabled: !S.uid, onclick: async () => {
        if (!text.trim()) return toast('Напишите сообщение');
        const items = [...mine, { type, text: text.trim(), at: Date.now() }].slice(-50);
        if (await run(() => putMine('feedback', { memberId: myMemberId(), items }), 'Спасибо! Сообщение отправлено')) { text = ''; nav.refresh(); }
      },
    }, icon('send', 18), 'Отправить')));

  if (S.isLeader) {
    const all = [];
    Object.entries(S.feedback).forEach(([uid, f]) => ((f && f.items) || []).forEach(it => all.push({ ...it, uid })));
    all.sort((a, b) => b.at - a.at);
    el.append(h('div.sec-h', h('h2.h2', 'Входящие'), h('span.small.muted', all.length)));
    el.append(all.length ? h('div.stack', all.map(it => h('section.card.tight',
      h('div.row.between', h('div.row', h('span.chip' + (it.type === 'bug' ? '.no' : it.type === 'idea' ? '.ink' : ''), TYPE[it.type] || 'Отзыв'), h('b', it.uid === S.uid ? 'Вы' : (nameOfUid(it.uid) || 'Участник'))), h('span.small.muted.mono', fmt.stamp(it.at))),
      h('p.pre', it.text))))
      : h('div.list', empty('msg', 'Сообщений нет', 'Когда кто-то из команды напишет, сообщение появится здесь.')));
  } else if (mine.length) {
    el.append(h('div.sec-h', h('h2.h2', 'Вы отправили')));
    el.append(h('div.list', [...mine].reverse().map(it => h('div.feed-i', h('span.feed-dot'),
      h('div', h('div.feed-t', TYPE[it.type] || 'Отзыв'), h('div.feed-b', it.text), h('div.feed-m', fmt.stamp(it.at)))))));
  }
}
