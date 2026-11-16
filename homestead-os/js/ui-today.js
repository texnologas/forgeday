import { todayKey, uid } from './store.js';
import {
  ensureDayPlan,
  generateDayPlan,
  rebalanceDayPlan,
  getSleepSchedule,
  fromMinutes,
  formatDuration,
  getNowMinutes,
  sortTasksByRoi,
  computeTaskRoi
} from './engine.js';
import { esc, CATEGORY_COLORS, CATEGORY_LABELS } from './ui-utils.js';

export function renderTodayTab(ctx) {
  const { state, save, openSheet, closeSheet, showToast, refresh } = ctx;
  const key = todayKey();
  const day = ensureDayPlan(state, key);
  const nowMin = getNowMinutes();
  const { bedMin, windDownMin } = getSleepSchedule(state.settings);

  const blocks = [...(day.blocks || [])].sort((a, b) => a.startMin - b.startMin);
  const currentBlock = blocks.find((b) => b.status !== 'done' && b.status !== 'skipped' && nowMin >= b.startMin && nowMin < b.startMin + b.durationMin)
    || blocks.find((b) => b.status !== 'done' && b.status !== 'skipped' && b.startMin >= nowMin)
    || blocks.find((b) => b.status === 'planned' || b.status === 'active');

  const completedCount = blocks.filter((b) => b.status === 'done').length;
  const totalCount = blocks.length;

  // Bedtime countdown
  let minsToBed = bedMin - nowMin;
  if (minsToBed < -360) minsToBed += 1440;
  const bedStatusText = minsToBed > 0
    ? `Lights out ${fromMinutes(bedMin)} (in ${formatDuration(minsToBed)})`
    : `Past ${fromMinutes(bedMin)} bedtime — protect sleep now`;
  const bedUrgent = minsToBed <= 45;

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const container = document.createElement('div');
  container.className = 'tab-view';
  container.innerHTML = `
    <header class="top-bar">
      <div>
        <div class="eyebrow">${esc(dateLabel)}</div>
        <h1 class="page-title">Today's Execution</h1>
      </div>
      <button class="pill-btn" data-action="toggle-mode" title="Switch Weekday / Weekend Plan">
        ${day.mode === 'weekday' ? 'Weekday • 7–4' : 'Weekend • Homestead'}
      </button>
    </header>

    <section class="card priority-strip ${bedUrgent ? 'border-warn' : ''}">
      <div class="strip-row">
        <div class="sleep-badge ${bedUrgent ? 'text-warn' : 'text-purple'}">
          <span class="dot" style="background:#8B5CF6"></span>
          <span>${esc(bedStatusText)}</span>
        </div>
        <span class="muted small">${completedCount}/${totalCount} blocks</span>
      </div>
      <div class="chip-toggles">
        <button class="toggle-chip ${day.hydrationOk ? 'on' : ''}" data-food="hydrationOk">💧 Water</button>
        <button class="toggle-chip ${day.breakfastDone ? 'on' : ''}" data-food="breakfastDone">🍳 Breakfast</button>
        ${day.mode === 'weekday' && state.settings.cafeteriaLunch
          ? `<button class="toggle-chip ${day.cafeteriaLunchUsed ? 'on' : ''}" data-food="cafeteriaLunchUsed">🍽️ Cafeteria Lunch</button>`
          : ''}
        <button class="toggle-chip ${day.dinnerDone ? 'on' : ''}" data-food="dinnerDone">🍲 Dinner</button>
      </div>
    </section>

    ${currentBlock ? `
      <section class="card focus-card">
        <div class="focus-head">
          <span class="cat-pill" style="--c:${CATEGORY_COLORS[currentBlock.category] || '#10B981'}">
            ${esc(CATEGORY_LABELS[currentBlock.category] || currentBlock.category)}
          </span>
          <span class="time-range">${fromMinutes(currentBlock.startMin)} – ${fromMinutes(currentBlock.startMin + currentBlock.durationMin)} (${formatDuration(currentBlock.durationMin)})</span>
        </div>
        <h2 class="focus-title">${esc(currentBlock.title)}</h2>
        ${currentBlock.audioOnly ? `<div class="safety-banner">🎧 Hands-Free Audio Only — Keep eyes on the road</div>` : ''}
        ${currentBlock.notes ? `<p class="focus-notes">${esc(currentBlock.notes)}</p>` : ''}
        <div class="focus-actions">
          <button class="btn btn-primary" data-focus-action="done" data-id="${esc(currentBlock.id)}">✓ Complete</button>
          <button class="btn btn-secondary" data-focus-action="extend" data-id="${esc(currentBlock.id)}">+15m</button>
          <button class="btn btn-ghost" data-focus-action="skip" data-id="${esc(currentBlock.id)}">Skip</button>
          <button class="btn btn-amber" data-action="open-adjust">Adjust Day</button>
        </div>
      </section>
    ` : `
      <section class="card focus-card">
        <h2 class="focus-title">All planned blocks wrapped</h2>
        <p class="focus-notes">Protect your ${state.settings.sleepTargetHours}h sleep window or add a light review in Growth.</p>
        <div class="focus-actions">
          <button class="btn btn-amber" data-action="open-adjust">Rebuild / Adjust</button>
          <button class="btn btn-secondary" data-action="open-add-block">+ Add Block</button>
        </div>
      </section>
    `}

    <div class="section-header">
      <h3>Hybrid Timeline</h3>
      <div class="row-gap">
        <button class="text-btn" data-action="open-adjust">⚡ Slip Adjust</button>
        <button class="text-btn" data-action="open-add-block">+ Block</button>
      </div>
    </div>

    <div class="timeline-list">
      ${blocks.map((b) => {
        const isCurrent = currentBlock && currentBlock.id === b.id;
        const endStr = fromMinutes(b.startMin + b.durationMin);
        const color = CATEGORY_COLORS[b.category] || '#64748B';
        return `
          <div class="timeline-item ${b.status} ${isCurrent ? 'is-current' : ''}" data-block-id="${esc(b.id)}">
            <div class="tl-time">
              <span>${fromMinutes(b.startMin)}</span>
              <span class="tl-end">${endStr}</span>
            </div>
            <div class="tl-rail">
              <span class="tl-dot" style="background:${color}"></span>
              <span class="tl-line"></span>
            </div>
            <div class="tl-body">
              <div class="tl-top">
                <span class="tl-cat" style="color:${color}">${esc(CATEGORY_LABELS[b.category] || b.category)}</span>
                <span class="tl-dur">${formatDuration(b.durationMin)}${b.fixed ? ' • Anchor' : ''}${b.audioOnly ? ' • 🎧' : ''}</span>
              </div>
              <div class="tl-title">${esc(b.title)}</div>
              ${b.notes ? `<div class="tl-notes">${esc(b.notes)}</div>` : ''}
            </div>
            <div class="tl-status-col">
              <button class="icon-check ${b.status === 'done' ? 'checked' : ''}" data-quick-done="${esc(b.id)}" aria-label="Toggle block done">
                ${b.status === 'done' ? '✓' : (b.status === 'skipped' ? '—' : '')}
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  function completeBlock(blockId, markDone = true) {
    const blk = day.blocks.find((x) => x.id === blockId);
    if (!blk) return;
    blk.status = markDone ? 'done' : 'planned';
    if (markDone && blk.taskId) {
      const task = state.tasks.find((t) => t.id === blk.taskId);
      if (task) {
        task.status = 'done';
        task.activeWip = false;
        task.completedAt = key;
      }
    }
    save();
    refresh();
  }

  container.querySelectorAll('[data-food]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.getAttribute('data-food');
      day[field] = !day[field];
      save();
      refresh();
    });
  });

  container.querySelector('[data-action="toggle-mode"]')?.addEventListener('click', () => {
    const nextMode = day.mode === 'weekday' ? 'weekend' : 'weekday';
    state.days[key] = generateDayPlan(state, key, nextMode);
    save();
    showToast(`Switched to ${nextMode.toUpperCase()} schedule`);
    refresh();
  });

  container.querySelectorAll('[data-quick-done]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-quick-done');
      const blk = day.blocks.find((x) => x.id === id);
      if (!blk) return;
      completeBlock(id, blk.status !== 'done');
    });
  });

  container.querySelectorAll('[data-focus-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-focus-action');
      const id = btn.getAttribute('data-id');
      const blk = day.blocks.find((x) => x.id === id);
      if (!blk) return;
      if (act === 'done') {
        completeBlock(id, true);
        showToast('Block completed');
      } else if (act === 'extend') {
        blk.durationMin += 15;
        const res = rebalanceDayPlan(day, state, { fromMin: blk.startMin });
        day.blocks = res.updatedBlocks;
        save();
        showToast(res.deferredBlocks.length ? `+15m added; deferred ${res.deferredBlocks.length} low-priority block(s) to protect sleep` : '+15m added & timeline shifted');
        refresh();
      } else if (act === 'skip') {
        blk.status = 'skipped';
        save();
        showToast('Skipped block — tap Slip Adjust to pull next ROI task up');
        refresh();
      }
    });
  });

  container.querySelectorAll('.timeline-item').forEach((row) => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-block-id');
      const blk = day.blocks.find((x) => x.id === id);
      if (!blk) return;
      const topTasks = sortTasksByRoi(state.tasks.filter((t) => t.status !== 'done')).slice(0, 5);
      openSheet(`
        <h3>${esc(blk.title)}</h3>
        <p class="muted small">${fromMinutes(blk.startMin)} – ${fromMinutes(blk.startMin + blk.durationMin)} (${formatDuration(blk.durationMin)})</p>
        <div class="sheet-actions">
          <button class="btn btn-primary" id="sh-done">${blk.status === 'done' ? 'Mark Planned' : '✓ Mark Complete'}</button>
          <button class="btn btn-secondary" id="sh-ext">+15m & Rebalance</button>
          <button class="btn btn-ghost" id="sh-skip">${blk.status === 'skipped' ? 'Restore Block' : 'Skip Block'}</button>
          ${!blk.fixed ? `<button class="btn btn-danger" id="sh-del">Delete Block</button>` : ''}
        </div>
        ${!blk.fixed && topTasks.length ? `
          <div class="sheet-divider"></div>
          <div class="small muted">Swap with Top ROI Backlog Task:</div>
          <div class="swap-list">
            ${topTasks.map((t) => `
              <button class="swap-item" data-swap-task="${esc(t.id)}">
                <span>${esc(t.title)}</span>
                <span class="tag">${esc(t.area)} • ${t.costTier === 'free' ? '$0' : '$'} • ${formatDuration(t.durationMin)}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}
      `, (sheetEl) => {
        sheetEl.querySelector('#sh-done')?.addEventListener('click', () => {
          closeSheet();
          completeBlock(blk.id, blk.status !== 'done');
        });
        sheetEl.querySelector('#sh-ext')?.addEventListener('click', () => {
          blk.durationMin += 15;
          const res = rebalanceDayPlan(day, state, { fromMin: blk.startMin });
          day.blocks = res.updatedBlocks;
          save();
          closeSheet();
          showToast('Extended +15m & protected bedtime');
          refresh();
        });
        sheetEl.querySelector('#sh-skip')?.addEventListener('click', () => {
          blk.status = blk.status === 'skipped' ? 'planned' : 'skipped';
          save();
          closeSheet();
          refresh();
        });
        sheetEl.querySelector('#sh-del')?.addEventListener('click', () => {
          day.blocks = day.blocks.filter((x) => x.id !== blk.id);
          save();
          closeSheet();
          refresh();
        });
        sheetEl.querySelectorAll('[data-swap-task]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const tid = btn.getAttribute('data-swap-task');
            const task = state.tasks.find((t) => t.id === tid);
            if (!task) return;
            blk.title = task.title;
            blk.taskId = task.id;
            blk.category = task.area === 'Cars' ? 'transport' : task.area === 'Skill & Income' ? 'skill' : task.area === 'Food' ? 'food' : 'homestead';
            blk.notes = `${task.area} • ROI ${computeTaskRoi(task)} • ${task.costTier === 'free' ? '$0' : 'Cash'}`;
            save();
            closeSheet();
            showToast('Swapped block from Backlog');
            refresh();
          });
        });
      });
    });
  });

  container.querySelectorAll('[data-action="open-adjust"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openSheet(`
        <h3>Slip Recovery & Auto-Adjust</h3>
        <p class="muted small">Recalculates remaining flexible blocks without breaking your ${fromMinutes(windDownMin)} sleep wind-down.</p>
        <div class="sheet-actions">
          <button class="btn btn-primary" id="adj-now">Re-pack from Now (${fromMinutes(nowMin)})</button>
          <button class="btn btn-secondary" id="adj-30">Delayed +30m (Car / Traffic / Overtime)</button>
          <button class="btn btn-secondary" id="adj-low">Low-Energy Mode (Dinner + 1 Quick Win)</button>
          <button class="btn btn-ghost" id="adj-regen">Reset & Rebuild Today from Template</button>
        </div>
      `, (sheetEl) => {
        const runAdjust = (fromMin, energyMode = 'normal') => {
          const res = rebalanceDayPlan(day, state, { fromMin, energyMode });
          day.blocks = res.updatedBlocks;
          save();
          closeSheet();
          const msg = res.deferredBlocks.length
            ? `Adjusted! Deferred ${res.deferredBlocks.length} block(s) to protect sleep.`
            : 'Timeline adjusted cleanly before bedtime.';
          showToast(msg);
          refresh();
        };
        sheetEl.querySelector('#adj-now')?.addEventListener('click', () => runAdjust(getNowMinutes(), 'normal'));
        sheetEl.querySelector('#adj-30')?.addEventListener('click', () => runAdjust(getNowMinutes() + 30, 'normal'));
        sheetEl.querySelector('#adj-low')?.addEventListener('click', () => runAdjust(getNowMinutes(), 'low'));
        sheetEl.querySelector('#adj-regen')?.addEventListener('click', () => {
          state.days[key] = generateDayPlan(state, key, day.mode);
          save();
          closeSheet();
          showToast('Rebuilt fresh plan for today');
          refresh();
        });
      });
    });
  });

  container.querySelectorAll('[data-action="open-add-block"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const defStart = fromMinutes(Math.max(nowMin, 17 * 60));
      openSheet(`
        <h3>Add Time Block</h3>
        <form id="add-blk-form" class="form-stack">
          <label>Title
            <input type="text" name="title" required placeholder="e.g. Seal tiny house window trim" />
          </label>
          <div class="grid-2">
            <label>Start Time
              <input type="time" name="start" value="${defStart}" required />
            </label>
            <label>Duration (min)
              <select name="duration">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45" selected>45 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">2 hours</option>
              </select>
            </label>
          </div>
          <label>Category
            <select name="category">
              <option value="homestead">Homestead / Tiny House</option>
              <option value="food">Food / Cooking</option>
              <option value="health">Health / Mobility</option>
              <option value="transport">Cars / Transport</option>
              <option value="skill">Skill & Income</option>
            </select>
          </label>
          <button type="submit" class="btn btn-primary">Add to Timeline</button>
        </form>
      `, (sheetEl) => {
        sheetEl.querySelector('#add-blk-form')?.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const [hh, mm] = String(fd.get('start')).split(':').map(Number);
          day.blocks.push({
            id: uid('blk'),
            title: String(fd.get('title')).trim(),
            startMin: hh * 60 + mm,
            durationMin: Number(fd.get('duration')),
            category: String(fd.get('category')),
            fixed: false,
            audioOnly: false,
            priority: 2,
            status: 'planned',
            taskId: null,
            notes: ''
          });
          day.blocks.sort((a, b) => a.startMin - b.startMin);
          save();
          closeSheet();
          showToast('Block added');
          refresh();
        });
      });
    });
  });

  return container;
}