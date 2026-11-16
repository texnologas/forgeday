import { AREAS, AREA_META, todayKey, uid } from './store.js';
import { computeTaskRoi, sortTasksByRoi, formatDuration, ensureDayPlan, getSleepSchedule, getNowMinutes } from './engine.js';
import { esc } from './ui-utils.js';

const filterState = {
  area: 'All',
  freeOnly: false,
  quickOnly: false,
  phase1Only: false,
  showDone: false
};

export function renderBacklogTab(ctx) {
  const { state, save, openSheet, closeSheet, showToast, refresh, switchTab } = ctx;
  const openTasks = state.tasks.filter((t) => t.status !== 'done');
  const wipCount = openTasks.filter((t) => t.activeWip).length;
  const wipOver = wipCount > state.settings.wipLimit;

  let visible = filterState.showDone
    ? state.tasks.filter((t) => t.status === 'done')
    : sortTasksByRoi(openTasks);

  if (filterState.area !== 'All') {
    visible = visible.filter((t) => t.area === filterState.area);
  }
  if (filterState.freeOnly) {
    visible = visible.filter((t) => t.costTier === 'free' || Number(t.estimatedCost) === 0);
  }
  if (filterState.quickOnly) {
    visible = visible.filter((t) => (t.durationMin || 60) <= 30);
  }
  if (filterState.phase1Only) {
    visible = visible.filter((t) => t.phase === 1);
  }

  const container = document.createElement('div');
  container.className = 'tab-view';
  container.innerHTML = `
    <header class="top-bar">
      <div>
        <div class="eyebrow">First-Principles ROI</div>
        <h1 class="page-title">Homestead & Backlog</h1>
      </div>
      <button class="pill-btn" data-action="new-task">+ Task</button>
    </header>

    <section class="card compact ${wipOver ? 'border-warn' : ''}">
      <div class="card-head">
        <span class="small"><strong>WIP Guard:</strong> ${wipCount} / ${state.settings.wipLimit} active fronts</span>
        <span class="badge ${wipOver ? 'badge-amber' : 'badge-green'}">${wipOver ? 'Serialize!' : 'Focused'}</span>
      </div>
      <div class="small muted">${wipOver ? 'Too many open fronts slows completion. Finish Tiny House / Phase 1 bottlenecks first.' : 'High-leverage serialization active: $0 & Phase 1 tasks float to the top.'}</div>
    </section>

    <div class="filter-bar">
      <button class="f-chip ${filterState.freeOnly ? 'on' : ''}" data-ft="freeOnly">$0 On-Hand Only</button>
      <button class="f-chip ${filterState.phase1Only ? 'on' : ''}" data-ft="phase1Only">Phase 1 Critical</button>
      <button class="f-chip ${filterState.quickOnly ? 'on' : ''}" data-ft="quickOnly">≤30m Quick Win</button>
      <button class="f-chip ${filterState.showDone ? 'on' : ''}" data-ft="showDone">Completed (${state.tasks.length - openTasks.length})</button>
    </div>

    <div class="area-scroll">
      <button class="area-chip ${filterState.area === 'All' ? 'on' : ''}" data-area="All">All (${openTasks.length})</button>
      ${AREAS.map((a) => {
        const cnt = openTasks.filter((t) => t.area === a).length;
        return `<button class="area-chip ${filterState.area === a ? 'on' : ''}" data-area="${esc(a)}">${esc(AREA_META[a]?.short || a)} (${cnt})</button>`;
      }).join('')}
    </div>

    <div class="stack-md">
      ${visible.length === 0 ? `
        <div class="card empty-card">
          <p class="muted">No tasks match your current filters.</p>
        </div>
      ` : visible.map((t) => {
        const roi = computeTaskRoi(t);
        const color = AREA_META[t.area]?.color || '#10B981';
        const costBadge = t.costTier === 'free'
          ? '<span class="badge badge-green">$0 On-Hand</span>'
          : (t.costTier === 'low' ? `<span class="badge badge-amber">Low (~€${t.estimatedCost || 10})</span>` : `<span class="badge badge-red">Cash (€${t.estimatedCost || 50})</span>`);
        return `
          <article class="card task-card" data-task-id="${esc(t.id)}">
            <div class="task-top">
              <span class="area-tag" style="--c:${color}">${esc(t.area)}</span>
              <div class="row-gap">
                ${costBadge}
                <span class="badge badge-slate">P${t.phase}</span>
                ${t.status !== 'done' ? `<span class="roi-pill">ROI ${roi}</span>` : ''}
              </div>
            </div>
            <h3 class="task-title">${esc(t.title)}</h3>
            <div class="task-meta">
              <span>⏱ ${formatDuration(t.durationMin)}</span>
              <span>Impact ${t.impact}/5</span>
              ${t.urgent ? '<span class="text-amber">• Urgent</span>' : ''}
              ${t.activeWip ? '<span class="text-green">• Active WIP</span>' : ''}
            </div>
            ${t.notes ? `<p class="task-notes">${esc(t.notes)}</p>` : ''}
            <div class="task-actions">
              ${t.status !== 'done' ? `
                <button class="btn btn-primary btn-sm" data-sched-task="${esc(t.id)}">Schedule Today</button>
                <button class="btn btn-secondary btn-sm" data-done-task="${esc(t.id)}">✓ Done</button>
              ` : `
                <button class="btn btn-secondary btn-sm" data-reopen-task="${esc(t.id)}">Reopen</button>
              `}
              <button class="btn btn-ghost btn-sm" data-edit-task="${esc(t.id)}">Edit</button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;

  function openTaskEditor(existing = null) {
    const t = existing || {
      title: '',
      area: filterState.area !== 'All' ? filterState.area : 'Tiny House',
      phase: 1,
      costTier: 'free',
      estimatedCost: 0,
      durationMin: 45,
      impact: 4,
      urgent: false,
      activeWip: false,
      notes: ''
    };
    openSheet(`
      <h3>${existing ? 'Edit Backlog Task' : 'New Backlog Task'}</h3>
      <form id="task-form" class="form-stack">
        <label>Task Description
          <input type="text" name="title" required value="${esc(t.title)}" placeholder="e.g. Fix well pump pressure switch" />
        </label>
        <div class="grid-2">
          <label>Area
            <select name="area">
              ${AREAS.map((a) => `<option value="${esc(a)}" ${t.area === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
            </select>
          </label>
          <label>Phase
            <select name="phase">
              <option value="1" ${t.phase === 1 ? 'selected' : ''}>Phase 1 (Essential)</option>
              <option value="2" ${t.phase === 2 ? 'selected' : ''}>Phase 2 (Leverage)</option>
              <option value="3" ${t.phase === 3 ? 'selected' : ''}>Phase 3 (Later)</option>
            </select>
          </label>
        </div>
        <div class="grid-2">
          <label>Cash Requirement
            <select name="costTier">
              <option value="free" ${t.costTier === 'free' ? 'selected' : ''}>$0 (On-hand materials)</option>
              <option value="low" ${t.costTier === 'low' ? 'selected' : ''}>Low Cost (€1–25)</option>
              <option value="cash" ${t.costTier === 'cash' ? 'selected' : ''}>Needs Cash (€25+)</option>
            </select>
          </label>
          <label>Est. Cost (€)
            <input type="number" name="estimatedCost" min="0" value="${Number(t.estimatedCost) || 0}" />
          </label>
        </div>
        <div class="grid-2">
          <label>Duration
            <select name="durationMin">
              ${[15, 30, 45, 60, 90, 120, 180, 240].map((m) => `<option value="${m}" ${t.durationMin === m ? 'selected' : ''}>${formatDuration(m)}</option>`).join('')}
            </select>
          </label>
          <label>Impact (1–5)
            <select name="impact">
              ${[5, 4, 3, 2, 1].map((v) => `<option value="${v}" ${t.impact === v ? 'selected' : ''}>${v}/5</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="grid-2">
          <label class="row-check"><input type="checkbox" name="urgent" ${t.urgent ? 'checked' : ''} /> Urgent blocker</label>
          <label class="row-check"><input type="checkbox" name="activeWip" ${t.activeWip ? 'checked' : ''} /> Active WIP</label>
        </div>
        <label>Notes / Materials on hand
          <textarea name="notes" rows="2" placeholder="What tools/materials you already have">${esc(t.notes || '')}</textarea>
        </label>
        <div class="sheet-actions">
          <button type="submit" class="btn btn-primary">${existing ? 'Save Changes' : 'Add to Backlog'}</button>
          ${existing ? `<button type="button" class="btn btn-danger" id="del-task-btn">Delete Task</button>` : ''}
        </div>
      </form>
    `, (sheetEl) => {
      sheetEl.querySelector('#task-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const costTier = String(fd.get('costTier'));
        const payload = {
          title: String(fd.get('title')).trim(),
          area: String(fd.get('area')),
          phase: Number(fd.get('phase')),
          costTier,
          estimatedCost: costTier === 'free' ? 0 : (Number(fd.get('estimatedCost')) || 0),
          durationMin: Number(fd.get('durationMin')),
          impact: Number(fd.get('impact')),
          urgent: fd.get('urgent') === 'on',
          activeWip: fd.get('activeWip') === 'on',
          notes: String(fd.get('notes')).trim()
        };
        if (existing) {
          Object.assign(existing, payload);
        } else {
          state.tasks.push({
            id: uid('t'),
            ...payload,
            weekendHeavy: payload.durationMin >= 90,
            status: 'backlog',
            createdAt: todayKey(),
            completedAt: null
          });
        }
        save();
        closeSheet();
        showToast(existing ? 'Task updated' : 'Added to ROI backlog');
        refresh();
      });

      sheetEl.querySelector('#del-task-btn')?.addEventListener('click', () => {
        state.tasks = state.tasks.filter((x) => x.id !== existing.id);
        save();
        closeSheet();
        showToast('Task deleted');
        refresh();
      });
    });
  }

  container.querySelector('[data-action="new-task"]')?.addEventListener('click', () => openTaskEditor(null));

  container.querySelectorAll('[data-ft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const k = btn.getAttribute('data-ft');
      filterState[k] = !filterState[k];
      refresh();
    });
  });

  container.querySelectorAll('[data-area]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.area = btn.getAttribute('data-area');
      refresh();
    });
  });

  container.querySelectorAll('[data-edit-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = state.tasks.find((t) => t.id === btn.getAttribute('data-edit-task'));
      if (task) openTaskEditor(task);
    });
  });

  container.querySelectorAll('[data-done-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = state.tasks.find((t) => t.id === btn.getAttribute('data-done-task'));
      if (!task) return;
      task.status = 'done';
      task.activeWip = false;
      task.completedAt = todayKey();
      save();
      showToast('Task completed!');
      refresh();
    });
  });

  container.querySelectorAll('[data-reopen-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = state.tasks.find((t) => t.id === btn.getAttribute('data-reopen-task'));
      if (!task) return;
      task.status = 'backlog';
      task.completedAt = null;
      save();
      refresh();
    });
  });

  container.querySelectorAll('[data-sched-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = state.tasks.find((t) => t.id === btn.getAttribute('data-sched-task'));
      if (!task) return;
      const key = todayKey();
      const day = ensureDayPlan(state, key);
      const { windDownMin } = getSleepSchedule(state.settings);
      // Find a non-fixed planned homestead/skill block without an assigned task, or insert before wind-down
      const replaceable = day.blocks.find((b) => !b.fixed && b.status === 'planned' && !b.taskId && (b.category === 'homestead' || b.category === 'transport' || b.category === 'skill'));
      const cat = task.area === 'Cars' ? 'transport' : task.area === 'Skill & Income' ? 'skill' : task.area === 'Food' ? 'food' : task.area === 'Health' ? 'health' : 'homestead';
      if (replaceable) {
        replaceable.title = task.title;
        replaceable.taskId = task.id;
        replaceable.category = cat;
        replaceable.notes = `${task.area} • ${task.costTier === 'free' ? '$0' : 'Budgeted'}`;
      } else {
        const start = Math.min(Math.max(getNowMinutes(), 17 * 60), Math.max(0, windDownMin - task.durationMin));
        day.blocks.push({
          id: uid('blk'),
          title: task.title,
          startMin: start,
          durationMin: Math.min(task.durationMin, 90),
          category: cat,
          fixed: false,
          audioOnly: false,
          priority: 2,
          status: 'planned',
          taskId: task.id,
          notes: `${task.area} • ${task.costTier === 'free' ? '$0' : 'Budgeted'}`
        });
        day.blocks.sort((a, b) => a.startMin - b.startMin);
      }
      save();
      showToast('Scheduled into Today');
      switchTab('today');
    });
  });

  return container;
}