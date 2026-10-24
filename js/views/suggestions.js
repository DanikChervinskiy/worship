// Новые песни: предложить (может каждый), общий список, голосование, лидер переносит в базу.
import { S, put, del, putMine } from '../store.js';
import { h, icon, run, sheet, field, empty, bar, toast, linkBtn, safeUrl, seg } from '../ui.js';
import { voteCounts, nameOfUid, can } from '../model.js';
import { fmt } from '../dates.js';

let tab = 'new';
const STATUS = { new: 'Предложена', learning: 'Учим', added: 'В базе' };

export function render(el, p, nav) {
  el.append(bar('Новые песни', nav, [h('button.iconbtn', { type: 'button', 'aria-label': 'Предложить песню', onclick: () => openSuggest() }, icon('plus', 20))]));

  const counts = voteCounts();
  const myVotes = (S.votes[S.uid] && S.votes[S.uid].ids) || {};
  const all = [...S.suggestions].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || (b.at || 0) - (a.at || 0));
  const list = all.filter(s => (tab === 'added' ? s.status === 'added' : tab === 'learning' ? s.status === 'learning' : (s.status || 'new') === 'new'));

  el.append(h('section.hero',
    h('div', h('p.hero-k', 'Что учим дальше?'), h('p.hero-t', 'Голосуйте за песни, которые хотите петь'), h('p.hero-s', 'Предложить может каждый: название и ссылка.')),
    h('div.row', h('button.btn.on-hero', { type: 'button', onclick: () => openSuggest() }, icon('plus', 18), 'Предложить песню'))));

  el.append(seg([
    ['new', `Предложены · ${all.filter(s => (s.status || 'new') === 'new').length}`],
    ['learning', `Учим · ${all.filter(s => s.status === 'learning').length}`],
    ['added', `В базе · ${all.filter(s => s.status === 'added').length}`],
  ], tab, v => { tab = v; nav.refresh(); }, '.full'));

  if (!list.length) {
    el.append(h('div.list', empty('heart', tab === 'new' ? 'Пока ничего не предложено' : 'Здесь пусто', tab === 'new' ? 'Знаете хорошую песню? Добавьте её в список.' : null)));
    return;
  }

  el.append(h('div.stack', list.map(s => {
    const n = counts[s.id] || 0;
    const voted = !!myVotes[s.id];
    const by = s.by ? nameOfUid(s.by) : '';
    return h('section.card.tight',
      h('div.row.nowrap', { style: { alignItems: 'flex-start' } },
        h('button.vote', {
          type: 'button', 'aria-pressed': String(voted), 'aria-label': voted ? 'Убрать голос' : 'Голосовать',
          onclick: () => run(() => putMine('votes', { ids: { ...myVotes, [s.id]: !voted } })),
        }, icon('up', 18, 2.2), h('span', n)),
        h('div.grow', { style: { display: 'grid', gap: '4px' } },
          h('b', s.title),
          h('div.small.muted', [by ? `предложил(а) ${by}` : '', s.at ? fmt.stamp(s.at) : ''].filter(Boolean).join(' · ')),
          h('div.row', { style: { marginTop: '4px' } },
            s.status && s.status !== 'new' ? h('span.chip.ink', STATUS[s.status]) : null,
            safeUrl(s.link) ? linkBtn(safeUrl(s.link), 'Послушать', '.chip.line') : null))),
      can('songs') ? h('div.row', { style: { paddingLeft: '64px' } },
        s.status !== 'learning' && s.status !== 'added' ? h('button.btn.sm.soft', { type: 'button', onclick: () => run(() => put('suggestions', { ...s, status: 'learning' }, s.id), 'Отмечено: учим') }, 'Учим') : null,
        s.status !== 'added' ? h('button.btn.sm.soft', {
          type: 'button', onclick: () => run(async () => {
            const sid = await put('songs', { title: s.title, author: '', key: '', meter: '4/4', bpm: '', youtube: safeUrl(s.link), arrangement: '', notes: '', versions: [{ label: 'Русский', text: '' }], createdAt: Date.now() });
            await put('suggestions', { ...s, status: 'added', songId: sid }, s.id);
          }, 'Песня добавлена в базу — допишите слова и аккорды'),
        }, 'В базу') : null,
        h('button.btn.sm.ghost', { type: 'button', 'aria-label': 'Удалить', onclick: () => run(() => del('suggestions', s.id), 'Удалено') }, icon('trash', 16))) : null);
  })));
}

export function openSuggest() {
  const st = { title: '', link: '' };
  sheet('Предложить песню', (b, ctx) => {
    b.append(
      field('Название', h('input#sg-title', { value: st.title, placeholder: 'Название и исполнитель', oninput: e => (st.title = e.target.value) })),
      field('Ссылка', h('input#sg-link', { type: 'url', value: st.link, placeholder: 'YouTube, Spotify…', oninput: e => (st.link = e.target.value) })),
      h('div.btn-row',
        h('button.btn.ghost', { type: 'button', onclick: ctx.close }, 'Отмена'),
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            if (await run(() => put('suggestions', { title: st.title.trim(), link: st.link.trim(), by: S.uid || '', at: Date.now(), status: 'new' }), 'Спасибо! Песня в списке')) ctx.close();
          },
        }, 'Предложить')));
  }, { focus: true });
}
