import { todayKey, uid } from './store.js';
import { ensureDayPlan, getCoachInsights, getWeeklyStats, formatDuration } from './engine.js';
import { esc } from './ui-utils.js';

export function renderGrowthTab(ctx) {
  const { state, save, openSheet, closeSheet, showToast, refresh } = ctx;
  const key = todayKey();
  const day = ensureDayPlan(state, key);
  const insights = getCoachInsights(state, day);
  const weekly = getWeeklyStats(state);
  const totalAudioLogged = (state.audioQueue || []).reduce((s, a) => s + (Number(a.minutesLogged) || 0), 0);

  const container = document.createElement('div');
  container.className = 'tab-view';
  container.innerHTML = `
    <header class="top-bar">
      <div>
        <div class="eyebrow">Coach & Leverage</div>
        <h1 class="page-title">Potential & Growth</h1>
      </div>
      <button class="pill-btn" data-action="add-milestone">+ Milestone</button>
    </header>

    <section class="card">
      <div class="card-head">
        <h3>First-Principles Coach</h3>
        <span class="badge badge-blue">Live Analysis</span>
      </div>
      <div class="stack-sm">
        ${insights.map((ins) => `
          <div class="insight-box level-${esc(ins.level)}">
            <div class="insight-title">${esc(ins.title)}</div>
            <div class="small muted">${esc(ins.text)}</div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Escape-Scarcity Milestones</h3>
        <span class="small muted">Skill & Cash Runway</span>
      </div>
      <div class="stack-md">
        ${(state.milestones || []).map((m) => {
          const pct = Math.min(100, Math.round(((Number(m.current) || 0) / Math.max(1, Number(m.target) || 1)) * 100));
          return `
            <div class="milestone-item">
              <div class="card-head">
                <strong>${esc(m.title)}</strong>
                <span class="badge badge-green">${pct}%</span>
              </div>
              <div class="small muted">${m.current} / ${m.target} ${esc(m.unit)}</div>
              <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
              ${m.notes ? `<div class="small muted">${esc(m.notes)}</div>` : ''}
              <div class="row-gap mt-8">
                <button class="btn btn-secondary btn-sm" data-bump-ms="${esc(m.id)}">+ Update Progress</button>
                <button class="btn btn-ghost btn-sm" data-del-ms="${esc(m.id)}">Remove</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Commute Audio Queue (2h/day)</h3>
        <div class="row-gap">
          <span class="badge badge-cyan">${formatDuration(totalAudioLogged)} logged</span>
          <button class="text-btn" data-action="add-audio">+ Topic</button>
        </div>
      </div>
      <p class="small muted mb-8">10 hours/week in the car. Queue topics here before driving; log after parking.</p>
      <div class="stack-sm">
        ${(state.audioQueue || []).map((a) => `
          <div class="check-row ${a.done ? 'is-done' : ''}">
            <button class="icon-check ${a.done ? 'checked' : ''}" data-toggle-audio="${esc(a.id)}">${a.done ? '✓' : '🎧'}</button>
            <div class="check-main">
              <div class="check-title">${esc(a.title)}</div>
              <div class="small muted">${esc(a.topic)} • ${formatDuration(a.minutesLogged || 0)} / ${formatDuration(a.durationMin)}</div>
            </div>
            <button class="btn btn-secondary btn-xs" data-log-audio="${esc(a.id)}">+30m</button>
            <button class="del-x" data-del-audio="${esc(a.id)}">×</button>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>7-Day ROI Scorecard</h3>
        <span class="badge badge-purple">Avg sleep: ${weekly.avgSleep ? weekly.avgSleep.toFixed(1) + 'h' : '—'}</span>
      </div>
      <div class="stat-grid-3">
        <div class="stat-box">
          <div class="stat-val">${weekly.completedBlocks}</div>
          <div class="stat-lbl">Blocks Done</div>
        </div>
        <div class="stat-box">
          <div class="stat-val text-green">${formatDuration(weekly.minutesByCat.homestead + weekly.minutesByCat.transport)}</div>
          <div class="stat-lbl">Homestead/Car</div>
        </div>
        <div class="stat-box">
          <div class="stat-val text-blue">${formatDuration(weekly.minutesByCat.skill)}</div>
          <div class="stat-lbl">Skill & $</div>
        </div>
      </div>
      <div class="small muted mt-8">
        Food/Health time logged: ${formatDuration(weekly.minutesByCat.food + weekly.minutesByCat.health)} • Backlog tasks finished (7d): ${weekly.tasksCompleted}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Daily 2-Min Manager Debrief</h3>
        ${day.review?.submittedAt ? '<span class="badge badge-green">Saved Today</span>' : ''}
      </div>
      <form id="review-form" class="form-stack">
        <label>Energy Level Today (1–5)
          <select name="energy">
            <option value="">Select...</option>
            ${[5, 4, 3, 2, 1].map((v) => `<option value="${v}" ${day.energy === v ? 'selected' : ''}>${v}/5</option>`).join('')}
          </select>
        </label>
        <label>Top Win / Lever Moved Today
          <input type="text" name="win" value="${esc(day.review?.win || '')}" placeholder="e.g. Sealed tiny house roof gap + prepped 4 meals" />
        </label>
        <label>Biggest Friction / Blocker (to eliminate tomorrow)
          <input type="text" name="blocker" value="${esc(day.review?.blocker || '')}" placeholder="e.g. Missed sleep cutoff by 30m" />
        </label>
        <button type="submit" class="btn btn-primary">Save Daily Review</button>
      </form>
    </section>
  `;

  container.querySelector('[data-action="add-milestone"]')?.addEventListener('click', () => {
    openSheet(`
      <h3>New Skill / Income Milestone</h3>
      <form id="ms-form" class="form-stack">
        <label>Goal Title
          <input type="text" name="title" required placeholder="e.g. Finish tiny house electrical / Earn first €500 side income" />
        </label>
        <div class="grid-2">
          <label>Current
            <input type="number" name="current" value="0" step="any" required />
          </label>
          <label>Target
            <input type="number" name="target" value="100" step="any" required />
          </label>
        </div>
        <label>Unit
          <input type="text" name="unit" value="hrs" placeholder="€, hrs, clients, %" />
        </label>
        <label>Notes
          <input type="text" name="notes" placeholder="Next concrete step" />
        </label>
        <button type="submit" class="btn btn-primary">Save Milestone</button>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#ms-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        state.milestones.push({
          id: uid('m'),
          title: String(fd.get('title')).trim(),
          category: 'skill',
          current: Number(fd.get('current')) || 0,
          target: Number(fd.get('target')) || 100,
          unit: String(fd.get('unit')).trim() || 'pts',
          notes: String(fd.get('notes')).trim()
        });
        save();
        closeSheet();
        refresh();
      });
    });
  });

  container.querySelectorAll('[data-bump-ms]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = state.milestones.find((x) => x.id === btn.getAttribute('data-bump-ms'));
      if (!m) return;
      openSheet(`
        <h3>Update: ${esc(m.title)}</h3>
        <form id="ms-upd" class="form-stack">
          <label>New Current Value (${esc(m.unit)})
            <input type="number" name="current" step="any" value="${m.current}" required />
          </label>
          <label>Target (${esc(m.unit)})
            <input type="number" name="target" step="any" value="${m.target}" required />
          </label>
          <button type="submit" class="btn btn-primary">Update</button>
        </form>
      `, (sheetEl) => {
        sheetEl.querySelector('#ms-upd')?.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          m.current = Number(fd.get('current')) || 0;
          m.target = Number(fd.get('target')) || m.target;
          save();
          closeSheet();
          showToast('Milestone updated');
          refresh();
        });
      });
    });
  });

  container.querySelectorAll('[data-del-ms]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-ms');
      state.milestones = state.milestones.filter((x) => x.id !== id);
      save();
      refresh();
    });
  });

  container.querySelector('[data-action="add-audio"]')?.addEventListener('click', () => {
    openSheet(`
      <h3>Queue Commute Audio Topic</h3>
      <form id="aud-form" class="form-stack">
        <label>Title / Book / Podcast
          <input type="text" name="title" required placeholder="e.g. Zero to One / Plumbing & Electrical Basics" />
        </label>
        <div class="grid-2">
          <label>Topic
            <input type="text" name="topic" value="Skill & Business" />
          </label>
          <label>Est. Length (min)
            <input type="number" name="duration" value="60" min="15" step="15" />
          </label>
        </div>
        <button type="submit" class="btn btn-primary">Add to Drive Queue</button>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#aud-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        state.audioQueue.push({
          id: uid('aq'),
          title: String(fd.get('title')).trim(),
          topic: String(fd.get('topic')).trim() || 'Audio',
          durationMin: Number(fd.get('duration')) || 60,
          done: false,
          minutesLogged: 0
        });
        save();
        closeSheet();
        refresh();
      });
    });
  });

  container.querySelectorAll('[data-log-audio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = state.audioQueue.find((x) => x.id === btn.getAttribute('data-log-audio'));
      if (!a) return;
      a.minutesLogged = (Number(a.minutesLogged) || 0) + 30;
      if (a.minutesLogged >= a.durationMin) a.done = true;
      save();
      showToast('+30m commute audio logged');
      refresh();
    });
  });

  container.querySelectorAll('[data-toggle-audio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = state.audioQueue.find((x) => x.id === btn.getAttribute('data-toggle-audio'));
      if (!a) return;
      a.done = !a.done;
      save();
      refresh();
    });
  });

  container.querySelectorAll('[data-del-audio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-del-audio');
      state.audioQueue = state.audioQueue.filter((x) => x.id !== id);
      save();
      refresh();
    });
  });

  container.querySelector('#review-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const eng = fd.get('energy');
    day.energy = eng ? Number(eng) : null;
    day.review = {
      win: String(fd.get('win')).trim(),
      blocker: String(fd.get('blocker')).trim(),
      sleepProtected: day.review?.sleepProtected ?? null,
      submittedAt: new Date().toISOString()
    };
    save();
    showToast('Daily debrief saved');
    refresh();
  });

  return container;
}