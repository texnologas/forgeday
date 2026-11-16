import { todayKey, uid } from './store.js';
import { getSleepSchedule, fromMinutes, toMinutes } from './engine.js';
import { esc } from './ui-utils.js';

export function renderHealthTab(ctx) {
  const { state, save, openSheet, closeSheet, showToast, refresh } = ctx;
  const s = state.settings;
  const { wakeMin, bedMin, windDownMin } = getSleepSchedule(s);
  const logs = (state.sleepLogs || []).slice(-7);
  const avgSleep = logs.length
    ? (logs.reduce((acc, l) => acc + Number(l.hours || 0), 0) / logs.length).toFixed(1)
    : '—';

  const buyItems = (state.meals.pantryItems || []).filter((p) => p.source === 'buy');
  const cellarItems = (state.meals.pantryItems || []).filter((p) => p.source === 'cellar_garden');
  const estNeededCash = buyItems.filter((p) => p.needed).reduce((sum, p) => sum + (Number(p.estCost) || 0), 0);

  const container = document.createElement('div');
  container.className = 'tab-view';
  container.innerHTML = `
    <header class="top-bar">
      <div>
        <div class="eyebrow">Priority #1</div>
        <h1 class="page-title">Health & Food</h1>
      </div>
      <button class="pill-btn" data-action="log-sleep">+ Log Sleep</button>
    </header>

    <section class="card">
      <div class="card-head">
        <h3>Sleep Protection Guard</h3>
        <span class="badge badge-purple">7d avg: ${avgSleep}h</span>
      </div>
      <div class="stat-grid-3">
        <div class="stat-box">
          <div class="stat-val">${fromMinutes(windDownMin)}</div>
          <div class="stat-lbl">Wind-Down</div>
        </div>
        <div class="stat-box">
          <div class="stat-val text-purple">${fromMinutes(bedMin)}</div>
          <div class="stat-lbl">Lights Out</div>
        </div>
        <div class="stat-box">
          <div class="stat-val">${fromMinutes(wakeMin)}</div>
          <div class="stat-lbl">Wake (Drive 06:00)</div>
        </div>
      </div>
      ${renderSleepSvg(logs, s.sleepTargetHours)}
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Weekday Food Rule</h3>
        <span class="badge badge-green">${s.cafeteriaLunch ? 'Cafeteria Lunch ✓' : 'Manual Lunch'}</span>
      </div>
      <p class="muted small">Skip weekday lunch prep — rely on work cafeteria for midday calories. Save evening energy for sleep, tiny house, and skill building.</p>
      <div class="meal-cols">
        <div>
          <div class="sub-label">Fast Breakfasts</div>
          <ul class="clean-list">
            ${(state.meals.weekdayBreakfasts || []).map((m) => `<li>${esc(m)}</li>`).join('')}
          </ul>
        </div>
        <div>
          <div class="sub-label">15-Min Dinners</div>
          <ul class="clean-list">
            ${(state.meals.weekdayDinners || []).map((m) => `<li>${esc(m)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Weekend Batch-Prep Queue</h3>
        <div class="row-gap">
          <button class="text-btn" data-action="reset-batch">Reset Week</button>
          <button class="text-btn" data-action="add-batch">+ Prep</button>
        </div>
      </div>
      <div class="stack-sm">
        ${(state.meals.weekendBatchPrep || []).map((bp) => `
          <div class="check-row ${bp.doneThisWeek ? 'is-done' : ''}" data-batch-id="${esc(bp.id)}">
            <button class="icon-check ${bp.doneThisWeek ? 'checked' : ''}">${bp.doneThisWeek ? '✓' : ''}</button>
            <div class="check-main">
              <div class="check-title">${esc(bp.title)}</div>
              <div class="small muted">${bp.servings} servings ${bp.usesCellarGarden ? '• 🌱 Uses Root Cellar/Garden ($0)' : ''}</div>
            </div>
            <button class="del-x" data-del-batch="${esc(bp.id)}" aria-label="Delete">×</button>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Food Sourcing: Cellar ($0) vs Cash</h3>
        <button class="text-btn" data-action="add-pantry">+ Item</button>
      </div>
      <div class="sub-label">🌱 Root Cellar & Garden ($0)</div>
      <div class="stack-sm mb-12">
        ${cellarItems.map((p) => `
          <div class="check-row" data-pantry-id="${esc(p.id)}">
            <button class="icon-check ${p.needed ? 'checked' : ''}">${p.needed ? '!' : '✓'}</button>
            <div class="check-main">
              <div class="check-title">${esc(p.name)}</div>
              <div class="small muted">${p.needed ? 'Need to bring/harvest from cellar' : 'Stocked in kitchen'}</div>
            </div>
            <button class="del-x" data-del-pantry="${esc(p.id)}">×</button>
          </div>
        `).join('')}
      </div>

      <div class="card-head">
        <div class="sub-label">🛒 Cash Groceries Needed</div>
        <span class="badge badge-amber">Est. €${estNeededCash.toFixed(0)}</span>
      </div>
      <div class="stack-sm">
        ${buyItems.map((p) => `
          <div class="check-row" data-pantry-id="${esc(p.id)}">
            <button class="icon-check ${p.needed ? 'checked' : ''}">${p.needed ? '🛒' : '✓'}</button>
            <div class="check-main">
              <div class="check-title">${esc(p.name)}</div>
              <div class="small muted">${p.needed ? `To buy (~€${Number(p.estCost) || 0})` : 'Have at home'}</div>
            </div>
            <button class="del-x" data-del-pantry="${esc(p.id)}">×</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;

  container.querySelector('[data-action="log-sleep"]')?.addEventListener('click', () => {
    openSheet(`
      <h3>Log Sleep</h3>
      <form id="sleep-form" class="form-stack">
        <div class="grid-2">
          <label>Bedtime
            <input type="time" name="bedTime" value="${fromMinutes(bedMin)}" required />
          </label>
          <label>Wake Time
            <input type="time" name="wakeTime" value="${s.wakeTime}" required />
          </label>
        </div>
        <label>Quality (1–5)
          <select name="quality">
            <option value="5">5 — Deep & Restored</option>
            <option value="4" selected>4 — Solid</option>
            <option value="3">3 — Okay</option>
            <option value="2">2 — Broken / Cold</option>
            <option value="1">1 — Exhausted</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary">Save Sleep Log</button>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#sleep-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const bed = String(fd.get('bedTime'));
        const wake = String(fd.get('wakeTime'));
        let diffMin = toMinutes(wake) - toMinutes(bed);
        if (diffMin <= 0) diffMin += 1440;
        const hours = Math.round((diffMin / 60) * 10) / 10;
        const key = todayKey();
        state.sleepLogs = (state.sleepLogs || []).filter((l) => l.date !== key);
        state.sleepLogs.push({
          date: key,
          bedTime: bed,
          wakeTime: wake,
          hours,
          quality: Number(fd.get('quality'))
        });
        save();
        closeSheet();
        showToast(`Logged ${hours}h sleep`);
        refresh();
      });
    });
  });

  container.querySelector('[data-action="reset-batch"]')?.addEventListener('click', () => {
    (state.meals.weekendBatchPrep || []).forEach((b) => { b.doneThisWeek = false; });
    save();
    showToast('Reset weekly batch-prep checklist');
    refresh();
  });

  container.querySelector('[data-action="add-batch"]')?.addEventListener('click', () => {
    openSheet(`
      <h3>Add Batch-Prep Meal</h3>
      <form id="batch-form" class="form-stack">
        <label>Meal Name
          <input type="text" name="title" required placeholder="e.g. Buckwheat + braised cabbage pot" />
        </label>
        <label>Servings
          <input type="number" name="servings" value="4" min="1" max="14" />
        </label>
        <label class="row-check">
          <input type="checkbox" name="cellar" checked /> Uses Root Cellar / Garden ($0 base)
        </label>
        <button type="submit" class="btn btn-primary">Add to Batch Queue</button>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#batch-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        state.meals.weekendBatchPrep.push({
          id: uid('bp'),
          title: String(fd.get('title')).trim(),
          servings: Number(fd.get('servings')) || 4,
          usesCellarGarden: fd.get('cellar') === 'on',
          doneThisWeek: false
        });
        save();
        closeSheet();
        refresh();
      });
    });
  });

  container.querySelector('[data-action="add-pantry"]')?.addEventListener('click', () => {
    openSheet(`
      <h3>Add Food / Pantry Item</h3>
      <form id="pantry-form" class="form-stack">
        <label>Item
          <input type="text" name="name" required placeholder="e.g. Onions / Sardines / Oats" />
        </label>
        <div class="grid-2">
          <label>Source
            <select name="source">
              <option value="cellar_garden">Root Cellar / Garden ($0)</option>
              <option value="buy" selected>Buy ($)</option>
            </select>
          </label>
          <label>Est. Cost (€)
            <input type="number" name="cost" value="3" min="0" step="0.5" />
          </label>
        </div>
        <button type="submit" class="btn btn-primary">Save Item</button>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#pantry-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const src = String(fd.get('source'));
        state.meals.pantryItems.push({
          id: uid('pi'),
          name: String(fd.get('name')).trim(),
          source: src,
          estCost: src === 'cellar_garden' ? 0 : (Number(fd.get('cost')) || 0),
          needed: true
        });
        save();
        closeSheet();
        refresh();
      });
    });
  });

  container.querySelectorAll('[data-batch-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-batch]')) return;
      const id = row.getAttribute('data-batch-id');
      const item = state.meals.weekendBatchPrep.find((x) => x.id === id);
      if (!item) return;
      item.doneThisWeek = !item.doneThisWeek;
      save();
      refresh();
    });
  });

  container.querySelectorAll('[data-del-batch]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-del-batch');
      state.meals.weekendBatchPrep = state.meals.weekendBatchPrep.filter((x) => x.id !== id);
      save();
      refresh();
    });
  });

  container.querySelectorAll('[data-pantry-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-pantry]')) return;
      const id = row.getAttribute('data-pantry-id');
      const item = state.meals.pantryItems.find((x) => x.id === id);
      if (!item) return;
      item.needed = !item.needed;
      save();
      refresh();
    });
  });

  container.querySelectorAll('[data-del-pantry]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-del-pantry');
      state.meals.pantryItems = state.meals.pantryItems.filter((x) => x.id !== id);
      save();
      refresh();
    });
  });

  return container;
}

function renderSleepSvg(logs, target) {
  if (!logs.length) return '<p class="muted small">No sleep logs yet.</p>';
  const w = 320;
  const h = 84;
  const pad = 16;
  const step = (w - pad * 2) / Math.max(logs.length, 1);
  const maxH = 10;
  const targetY = h - 18 - (Math.min(target, maxH) / maxH) * (h - 28);

  const bars = logs.map((l, idx) => {
    const val = Math.min(Number(l.hours) || 0, maxH);
    const barH = (val / maxH) * (h - 28);
    const x = pad + idx * step + step * 0.2;
    const bw = Math.max(12, step * 0.6);
    const y = h - 18 - barH;
    const ok = val >= target - 0.3;
    const fill = ok ? '#10B981' : '#F59E0B';
    const dayLbl = l.date.slice(5);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${barH.toFixed(1)}" rx="4" fill="${fill}" opacity="0.88" />
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" fill="#CBD5E1" font-size="8" text-anchor="middle">${val}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 4}" fill="#64748B" font-size="8" text-anchor="middle">${dayLbl}</text>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" class="sleep-chart" aria-label="7-day sleep chart">
      <line x1="${pad}" y1="${targetY.toFixed(1)}" x2="${w - pad}" y2="${targetY.toFixed(1)}" stroke="#8B5CF6" stroke-dasharray="3 3" stroke-width="1" />
      ${bars}
    </svg>
  `;
}