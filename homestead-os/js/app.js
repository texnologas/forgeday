import { loadState, saveState } from './store.js';
import { renderTodayTab } from './ui-today.js';
import { renderHealthTab } from './ui-health.js';
import { renderBacklogTab } from './ui-backlog.js';
import { renderGrowthTab } from './ui-growth.js';
import { renderSetupTab } from './ui-setup.js';

let state = loadState();
let currentTab = 'today';
let deferredPrompt = null;

const appRoot = document.getElementById('app-root');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const sheetBody = document.getElementById('sheet-body');
const toastEl = document.getElementById('toast');
let toastTimer = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (currentTab === 'setup') render();
});

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

function openSheet(html, onMount) {
  sheetBody.innerHTML = html;
  sheetBackdrop.classList.add('open');
  sheetBackdrop.setAttribute('aria-hidden', 'false');
  if (onMount) onMount(sheetBody);
}

function closeSheet() {
  sheetBackdrop.classList.remove('open');
  sheetBackdrop.setAttribute('aria-hidden', 'true');
  sheetBody.innerHTML = '';
}

sheetBackdrop.addEventListener('click', (e) => {
  if (e.target === sheetBackdrop) closeSheet();
});

function save() {
  saveState(state);
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function render() {
  const ctx = {
    state,
    setState: (next) => { state = next; },
    save,
    openSheet,
    closeSheet,
    showToast,
    refresh: render,
    switchTab,
    get deferredPrompt() { return deferredPrompt; },
    clearDeferredPrompt: () => { deferredPrompt = null; }
  };

  let view;
  switch (currentTab) {
    case 'health': view = renderHealthTab(ctx); break;
    case 'backlog': view = renderBacklogTab(ctx); break;
    case 'growth': view = renderGrowthTab(ctx); break;
    case 'setup': view = renderSetupTab(ctx); break;
    case 'today':
    default:
      view = renderTodayTab(ctx);
      break;
  }

  appRoot.innerHTML = '';
  appRoot.appendChild(view);
}

document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.getAttribute('data-tab');
    if (tab) switchTab(tab);
  });
});

// Live 30s tick for active block & bedtime countdown
setInterval(() => {
  if (currentTab === 'today' && !sheetBackdrop.classList.contains('open')) {
    render();
  }
}, 30000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed (expected if opened via file://):', err);
    });
  });
}

render();