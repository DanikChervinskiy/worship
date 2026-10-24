// Пример данных для демо-режима и кнопки «Заполнить примером».
// Все записи помечены demo: true — их можно удалить одной кнопкой в профиле.
import { today, addDays, nextWeekday, parse, toStr } from './dates.js';

const AMAZING_EN = `# Verse 1
[G]Amazing [G7]grace! How [C]sweet the [G]sound
That saved a wretch like [D]me!
I [G]once was [G7]lost, but [C]now am [G]found;
Was [Em]blind, but [D]now I [G]see.

# Verse 2
[G]'Twas grace that [G7]taught my [C]heart to [G]fear,
And grace my fears re[D]lieved;
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved.

# Verse 3
[G]Through many [G7]dangers, [C]toils and [G]snares,
I have already [D]come;
'Tis [G]grace hath [G7]brought me [C]safe thus [G]far,
And [Em]grace will [D]lead me [G]home.`;

const AMAZING_RU = `# Куплет 1
[G]О, благо[G7]дать! Как [C]сладок [G]звук,
Что спас меня, глуп[D]ца!
Я [G]был по[G7]терян — [C]найден [G]вдруг,
Был [Em]слеп — про[D]зрел до кон[G]ца.`;

const HOLY_EN = `# Verse 1
[D]Holy, [Bm]holy, [D]holy! [G]Lord God Al[D]mighty!
Early in the [Bm]morning our [E]song shall rise to [A]Thee;
[D]Holy, [Bm]holy, [D]holy, [G]merciful and [D]mighty!
[G]God in [D]three [Bm]Persons, [D/A]blessed [A]Trin[D]ity!

# Verse 2
[D]Holy, [Bm]holy, [D]holy! [G]all the saints a[D]dore Thee,
Casting down their [Bm]golden crowns a[E]round the glassy [A]sea;
[D]Cherubim and [Bm]seraphim [D]falling [G]down be[D]fore Thee,
[G]Which wert, and [D]art, and [Bm]ever[D/A]more shalt [A]be[D].`;

const TY_ZDES = `Вступление:
[A] [E] [F#m] [D]

Куплет 1:
[A]Ты здесь, когда [E]тихо вокруг,
[F#m]Ты здесь, когда [D]сердце болит.
[A]Ты слышишь мой [E]самый простой звук,
[F#m]И мир Твой во [D]мне говорит.

Припев:
[D]Свят, [E]свят, [F#m]свят Ты, Господь,
[D]Вся земля [E]славы полна.
[D]Свят, [E]свят, [C#m]свят Ты, [F#m]Господь,
[D]Ты — моя [E]жизнь и хва[A]ла.

Куплет 2:
[A]Ты был, когда [E]не было дня,
[F#m]Ты будешь, когда [D]ночь отойдёт.
[A]И верность Твоя [E]держит меня,
[F#m]И сердце Тебе [D]песнь поёт.`;

export function buildDemo() {
  const D = { demo: true };
  const members = [
    { id: 'demo-alina', name: 'Алина', roles: ['drums'] },
    { id: 'demo-katya', name: 'Катя', roles: ['drums', 'vocal'] },
    { id: 'demo-vitya', name: 'Витя', roles: ['drums', 'guitar'] },
    { id: 'demo-olya', name: 'Оля', roles: ['vocal'] },
    { id: 'demo-mark', name: 'Марк', roles: ['keys'] },
    { id: 'demo-lesha', name: 'Лёша', roles: ['bass', 'guitar'] },
    { id: 'demo-nastya', name: 'Настя', roles: ['vocal', 'media'] },
    { id: 'demo-dima', name: 'Дима', roles: ['sound'] },
  ].map(m => ({ ...m, ...D }));

  const songs = [
    { id: 'demo-tyzdes', title: 'Ты здесь', author: 'Пример песни', key: 'A', bpm: 70, meter: '4/4', youtube: '',
      arrangement: 'Вст · К1 · П · К2 · П · П', notes: 'Вокал: припев — второй голос терцией выше.\nКлавиши: вступление одни, барабаны со второго куплета.',
      versions: [{ label: 'Русский', text: TY_ZDES }] },
    { id: 'demo-amazing', title: 'Amazing Grace', author: 'John Newton, 1779', key: 'G', bpm: 80, meter: '3/4', youtube: '',
      arrangement: 'К1 · К2 · К3 · К1', notes: 'Первый куплет — только клавиши и вокал.',
      versions: [{ label: 'English', text: AMAZING_EN }, { label: 'Русский (перевод)', text: AMAZING_RU }] },
    { id: 'demo-holy', title: 'Holy, Holy, Holy', author: 'Reginald Heber, 1826', key: 'D', bpm: 72, meter: '4/4', youtube: '',
      arrangement: 'К1 · К2 · К1', notes: '',
      versions: [{ label: 'English', text: HOLY_EN }] },
  ].map(s => ({ ...s, ...D, createdAt: Date.now() }));

  const categories = [
    { id: 'demo-cat-worship', name: 'Поклонение', color: '#6E56CF' },
    { id: 'demo-cat-hymn', name: 'Гимны', color: '#E2A336' },
    { id: 'demo-cat-new', name: 'Новые', color: '#46A758' },
  ].map(c => ({ ...c, ...D }));
  songs[0].cats = ['demo-cat-worship', 'demo-cat-new'];
  songs[1].cats = ['demo-cat-hymn'];
  songs[2].cats = ['demo-cat-hymn', 'demo-cat-worship'];
  songs[2].playKey = 'Eb';

  const drummers = ['demo-alina', 'demo-katya', 'demo-vitya'];
  const services = [];
  let sunday = nextWeekday(0, addDays(today(), -7));
  for (let i = 0; i < 6; i++) {
    const date = addDays(sunday, i * 7);
    services.push({
      id: 'demo-svc-' + i, ...D,
      date, time: '10:00', title: 'Воскресное служение', kind: 'service', eventId: '',
      rehearsal: { date: addDays(date, -1), time: '18:00' },
      songs: [
        { songId: 'demo-tyzdes', key: 'A' },
        { songId: 'demo-holy', key: i % 2 ? 'Eb' : 'D' },
        { songId: 'demo-amazing', key: 'G' },
      ],
      team: {
        vocal: [{ memberId: 'demo-olya' }, { memberId: i % 3 === 1 ? 'demo-nastya' : 'demo-katya' }],
        keys: [{ memberId: 'demo-mark' }],
        guitar: [{ memberId: 'demo-vitya' }],
        bass: [{ memberId: 'demo-lesha' }],
        drums: [{ memberId: drummers[i % 3] }],
        sound: [{ memberId: 'demo-dima' }],
        media: i % 3 === 1 ? [{ name: 'Серёжа (гость)' }] : [{ memberId: 'demo-nastya' }],
      },
      published: i < 4,
      note: i === 1 ? 'После служения — короткая молитва команды.' : '',
    });
  }

  // Событие: двухдневная конференция в следующем месяце.
  const d0 = parse(today());
  const confStart = nextWeekday(5, toStr(new Date(d0.getFullYear(), d0.getMonth() + 1, 8)));
  const events = [{ id: 'demo-conf', ...D, title: 'Молодёжная конференция', start: confStart, end: addDays(confStart, 1), note: 'Два вечера прославления. Сбор команды за час.' }];
  [0, 1].forEach(k => services.push({
    id: 'demo-conf-' + k, ...D,
    date: addDays(confStart, k), time: '18:30', title: `Конференция · вечер ${k + 1}`, kind: 'event', eventId: 'demo-conf',
    rehearsal: { date: addDays(confStart, k), time: '16:30' },
    songs: [{ songId: 'demo-holy', key: 'D' }, { songId: 'demo-tyzdes', key: 'A' }],
    team: { vocal: [{ memberId: 'demo-olya' }, { memberId: 'demo-nastya' }], keys: [{ memberId: 'demo-mark' }], drums: [{ memberId: 'demo-vitya' }], sound: [{ memberId: 'demo-dima' }] },
    published: false, note: '',
  }));

  const now = Date.now();
  const feed = [
    { id: 'demo-f1', ...D, at: now - 3600e3 * 5, title: 'Расписание на месяц готово', body: 'Проверьте, где вы служите, и отметьте, если не сможете.', to: 'all', serviceId: null },
    { id: 'demo-f2', ...D, at: now - 3600e3 * 30, title: 'Новая песня в базе', body: '«Ты здесь» — аккорды и партии уже внутри.', to: 'all', serviceId: null },
  ];

  const suggestions = [
    { id: 'demo-sg1', ...D, title: 'It Is Well With My Soul', link: '', by: '', at: now - 864e5 * 3, status: 'new' },
    { id: 'demo-sg2', ...D, title: 'Be Thou My Vision', link: '', by: '', at: now - 864e5 * 6, status: 'learning' },
  ];

  const lessons = [
    { id: 'demo-l1', ...D, order: 1, title: 'Поклонение в духе и истине', desc: 'Прочитайте Иоанна 4:19–26. Что, по-вашему, значит поклоняться «в духе и истине»? Запишите три мысли и одно практическое решение на эту неделю.', links: [] },
    { id: 'demo-l2', ...D, order: 2, title: 'Одно тело — одна команда', desc: 'Прочитайте 1 Коринфянам 12:12–27. Какое место в команде у вас сейчас и как вы можете поддержать того, кто рядом?', links: [] },
    { id: 'demo-l3', ...D, order: 3, title: 'Сердце до сцены', desc: 'Прочитайте Псалом 50 (51). Как подготовить сердце к служению в течение недели, а не только в воскресенье утром?', links: [] },
  ];

  const tasks = [
    { id: 'demo-t1', ...D, title: 'Подготовить пульт', role: 'sound', when: 'Перед каждым служением', subtasks: [{ t: 'Протереть пульт', done: false }, { t: 'Проверить батарейки в радиомикрофонах', done: false }, { t: 'Саундчек с вокалом', done: false }] },
    { id: 'demo-t2', ...D, title: 'Тексты на проектор', role: 'media', when: 'До субботы', subtasks: [{ t: 'Сверить порядок песен', done: true }, { t: 'Загрузить тексты в программу', done: false }, { t: 'Проверить опечатки', done: false }] },
    { id: 'demo-t3', ...D, title: 'Прийти за 30 минут до репетиции', role: 'all', when: 'Каждую субботу', subtasks: [] },
  ];

  const warmups = [
    { id: 'demo-w1', ...D, kind: 'warmup', title: 'Губная трель', url: '', note: '2 минуты: скользим вверх и вниз по удобному диапазону.' },
    { id: 'demo-w2', ...D, kind: 'warmup', title: 'Сирена на «у»', url: '', note: 'От нижней ноты к верхней и обратно, без напряжения в горле.' },
    { id: 'demo-w3', ...D, kind: 'warmup', title: 'Арпеджио «ма-ме-ми-мо-му»', url: '', note: 'Поднимаемся по полутонам, 5–6 повторов.' },
    { id: 'demo-w4', ...D, kind: 'daily', title: 'Дыхание 4–4–8', url: '', note: 'Вдох на 4 счёта, задержка на 4, выдох на 8. Пять повторов.' },
    { id: 'demo-w5', ...D, kind: 'daily', title: 'Гамма на «а»', url: '', note: 'Медленно, ровным звуком, следим за опорой.' },
  ];

  return { members, songs, services, events, feed, suggestions, lessons, tasks, warmups, categories };
}
