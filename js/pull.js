// Потянуть вниз — обновить: подтягивает новую версию приложения и свежие данные.
import { icon } from './ui.js';

const THRESHOLD = 72;   // сколько нужно протянуть (в пикселях), чтобы обновить
const MAX = 110;

export function initPullToRefresh() {
  const ind = document.createElement('div');
  ind.className = 'ptr';
  ind.setAttribute('aria-hidden', 'true');
  const knob = document.createElement('div');
  knob.className = 'ptr-knob';
  knob.append(icon('refresh', 20, 2.2));
  ind.append(knob);
  document.body.append(ind);

  let startY = 0, startX = 0, dist = 0, pulling = false, busy = false;

  const sheetOpen = () => !!document.querySelector('#layer .sheet-wrap');
  const atTop = () => (window.scrollY || document.documentElement.scrollTop) <= 0;

  const paint = () => {
    const p = Math.min(dist / THRESHOLD, 1);
    ind.style.transform = `translate(-50%, ${dist - 56}px)`;
    ind.style.opacity = String(Math.min(1, dist / 30));
    knob.style.transform = `rotate(${dist * 3}deg)`;
    ind.classList.toggle('ready', p >= 1);
  };
  const reset = () => {
    ind.classList.add('back');
    dist = 0; paint();
    setTimeout(() => ind.classList.remove('back'), 250);
  };

  addEventListener('touchstart', e => {
    if (busy || e.touches.length !== 1 || !atTop() || sheetOpen()) { pulling = false; return; }
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    pulling = true; dist = 0;
  }, { passive: true });

  addEventListener('touchmove', e => {
    if (!pulling || busy) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !atTop()) { if (dist) reset(); return; }
    dist = Math.min(MAX, dy * 0.5); // «тугое» сопротивление, как в обычных приложениях
    paint();
  }, { passive: true });

  addEventListener('touchend', async () => {
    if (!pulling || busy) return;
    pulling = false;
    if (dist < THRESHOLD) { reset(); return; }
    busy = true;
    ind.classList.add('spin');
    ind.style.transform = 'translate(-50%, 18px)';
    try { navigator.vibrate && navigator.vibrate(10); } catch { /* */ }
    await refresh();
  });
  addEventListener('touchcancel', () => { if (pulling && !busy) { pulling = false; reset(); } });
}

async function refresh() {
  // Проверяем новую версию приложения, затем перезагружаем страницу: подтянутся новые файлы и данные.
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) await Promise.race([reg.update(), new Promise(r => setTimeout(r, 2000))]);
  } catch { /* без сети — просто перезагрузим из кэша */ }
  setTimeout(() => location.reload(), 250);
}
