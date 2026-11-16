import { createDefaultState, exportStateJson, importStateJson, todayKey } from './store.js';
import { generateDayPlan, getSleepSchedule, fromMinutes } from './engine.js';
import { esc } from './ui-utils.js';

export function renderSetupTab(ctx) {
  const { state, setState, save, showToast, refresh, deferredPrompt, clearDeferredPrompt } = ctx;
  const s = state.settings;
  const { bedMin, windDownMin } = getSleepSchedule(s);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  const container = document.createElement('div');
  container.className = 'tab-view';
  container.innerHTML = `
    <header class="top-bar">
      <div>
        <div class="eyebrow">System Config</div>
        <h1 class="page-title">Anchors & Backup</h1>
      </div>
      <span class="badge ${isStandalone ? 'badge-green' : 'badge-amber'}">${isStandalone ? 'PWA Installed' : 'Browser Mode'}</span>
    </header>

    <section class="card">
      <div class="card-head">
        <h3>Android Install (Offline PWA)</h3>
      </div>
      <p class="small muted">Runs 100% offline with zero server or subscription costs. All data stays locally on your phone.</p>
      ${deferredPrompt ? `
        <button class="btn btn-primary mt-8" id="install-pwa-btn">📲 Install ForgeDay to Home Screen</button>
      ` : `
        <div class="small muted mt-8">
          ${isStandalone
            ? '✓ Running as an installed standalone Android app.'
            : 'In Android Chrome: tap <strong>⋮ Menu → Add to Home screen / Install app</strong> while served over HTTPS or localhost.'}
        </div>
      `}
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Weekday & Sleep Anchors</h3>
        <span class="badge badge-purple">Lights out: ${fromMinutes(bedMin)}</span>
      </div>
      <form id="settings-form" class="form-stack">
        <div class="grid-2">
          <label>Wake Time
            <input type="time" name="wakeTime" value="${esc(s.wakeTime)}" required />
          </label>
          <label>Leave Home (Drive)
            <input type="time" name="commuteStart" value="${esc(s.commuteStart)}" required />
          </label>
        </div>
        <div class="grid-2">
          <label>Work Start
            <input type="time" name="workStart" value="${esc(s.workStart)}" required />
          </label>
          <label>Work End
            <input type="time" name="workEnd" value="${esc(s.workEnd)}" required />
          </label>
        </div>
        <div class="grid-2">
          <label>One-Way Commute (min)
            <input type="number" name="commuteMinutes" value="${Number(s.commuteMinutes)}" min="0" max="180" />
          </label>
          <label>Target Sleep (hrs)
            <input type="number" name="sleepTargetHours" value="${Number(s.sleepTargetHours)}" min="5" max="10" step="0.5" />
          </label>
        </div>
        <div class="grid-2">
          <label>Wind-Down (min)
            <input type="number" name="windDownMinutes" value="${Number(s.windDownMinutes)}" min="10" max="90" step="5" />
          </label>
          <label>WIP Limit (Projects)
            <input type="number" name="wipLimit" value="${Number(s.wipLimit)}" min="1" max="10" />
          </label>
        </div>
        <label class="row-check">
          <input type="checkbox" name="cafeteriaLunch" ${s.cafeteriaLunch ? 'checked' : ''} />
          Work has cafeteria (skip weekday lunch prep)
        </label>
        <div class="small muted">Calculated wind-down start: ${fromMinutes(windDownMin)}</div>
        <button type="submit" class="btn btn-primary">Save & Rebuild Today</button>
      </form>
    </section>

    <section class="card">
      <h3>Backup & Data Portability</h3>
      <p class="small muted mb-8">Export a JSON snapshot before clearing browser data or switching phones.</p>
      <div class="sheet-actions">
        <button class="btn btn-secondary" id="export-btn">⬇ Export JSON Backup</button>
        <label class="btn btn-secondary file-btn">
          ⬆ Import JSON Backup
          <input type="file" id="import-input" accept="application/json,.json" hidden />
        </label>
        <button class="btn btn-danger" id="reset-btn">Reset to Starter Seed</button>
      </div>
    </section>
  `;

  container.querySelector('#install-pwa-btn')?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    clearDeferredPrompt();
    if (outcome === 'accepted') showToast('Installing ForgeDay...');
    refresh();
  });

  container.querySelector('#settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings.wakeTime = String(fd.get('wakeTime'));
    state.settings.commuteStart = String(fd.get('commuteStart'));
    state.settings.workStart = String(fd.get('workStart'));
    state.settings.workEnd = String(fd.get('workEnd'));
    state.settings.commuteMinutes = Number(fd.get('commuteMinutes')) || 60;
    state.settings.sleepTargetHours = Number(fd.get('sleepTargetHours')) || 7.5;
    state.settings.windDownMinutes = Number(fd.get('windDownMinutes')) || 30;
    state.settings.wipLimit = Number(fd.get('wipLimit')) || 3;
    state.settings.cafeteriaLunch = fd.get('cafeteriaLunch') === 'on';

    const key = todayKey();
    const curMode = state.days[key]?.mode;
    state.days[key] = generateDayPlan(state, key, curMode);
    save();
    showToast('Settings saved & today rebuilt');
    refresh();
  });

  container.querySelector('#export-btn')?.addEventListener('click', () => {
    const json = exportStateJson(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forgeday-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  });

  container.querySelector('#import-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const next = importStateJson(text);
      setState(next);
      save();
      showToast('Backup restored!');
      refresh();
    } catch (err) {
      showToast(err.message || 'Invalid backup file');
    }
  });

  container.querySelector('#reset-btn')?.addEventListener('click', () => {
    if (!confirm('Reset all tasks, schedules, and logs back to the starter homestead template?')) return;
    setState(createDefaultState());
    save();
    showToast('Reset complete');
    refresh();
  });

  return container;
}