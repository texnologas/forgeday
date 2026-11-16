import { uid, todayKey, parseDateKey } from './store.js';

export function toMinutes(hhmm) {
  const [h, m] = (hhmm || '00:00').split(':').map(Number);
  return (h * 60) + (m || 0);
}

export function fromMinutes(totalMin) {
  const norm = ((Math.round(totalMin) % 1440) + 1440) % 1440;
  const h = String(Math.floor(norm / 60)).padStart(2, '0');
  const m = String(norm % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

export function getNowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function getSleepSchedule(settings) {
  const wakeMin = toMinutes(settings.wakeTime);
  const sleepMin = Math.round((settings.sleepTargetHours || 7.5) * 60);
  const bedMin = ((wakeMin - sleepMin) % 1440 + 1440) % 1440;
  const windDownMin = ((bedMin - (settings.windDownMinutes || 30)) % 1440 + 1440) % 1440;
  return { wakeMin, bedMin, windDownMin, sleepMin };
}

export function isWeekendKey(dateKey) {
  const d = parseDateKey(dateKey);
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function computeTaskRoi(task) {
  if (task.status === 'done') return -999;
  let score = 0;
  // Phase priority: Phase 1 (stabilize) > Phase 2 (leverage) > Phase 3 (later)
  if (task.phase === 1) score += 35;
  else if (task.phase === 2) score += 16;
  else score += 2;

  // Scarcity bonus: $0 on-hand materials get top priority
  if (task.costTier === 'free' || Number(task.estimatedCost) === 0) score += 22;
  else if (task.costTier === 'low') score += 8;

  // Impact 1..5
  score += (Number(task.impact) || 3) * 12;

  // Urgent & Active WIP
  if (task.urgent) score += 25;
  if (task.activeWip) score += 10;

  // Slight preference for compact tasks that fit weekday evenings
  if ((task.durationMin || 60) <= 45) score += 5;

  return score;
}

export function sortTasksByRoi(tasks) {
  return [...tasks].sort((a, b) => computeTaskRoi(b) - computeTaskRoi(a));
}

function pickBestTask(tasks, { maxDuration = 180, excludeIds = new Set(), areas = null, freeOnly = false } = {}) {
  const sorted = sortTasksByRoi(tasks);
  return sorted.find((t) => {
    if (t.status === 'done') return false;
    if (excludeIds.has(t.id)) return false;
    if (t.durationMin > maxDuration) return false;
    if (areas && !areas.includes(t.area)) return false;
    if (freeOnly && t.costTier !== 'free' && Number(t.estimatedCost) > 0) return false;
    return true;
  }) || null;
}

export function ensureDayPlan(state, dateKey = todayKey()) {
  if (state.days[dateKey] && Array.isArray(state.days[dateKey].blocks) && state.days[dateKey].blocks.length > 0) {
    return state.days[dateKey];
  }
  const dayPlan = generateDayPlan(state, dateKey);
  state.days[dateKey] = dayPlan;
  return dayPlan;
}

export function generateDayPlan(state, dateKey = todayKey(), forceMode = null) {
  const s = state.settings;
  const mode = forceMode || (isWeekendKey(dateKey) ? 'weekend' : 'weekday');
  const { wakeMin, bedMin, windDownMin } = getSleepSchedule(s);
  const blocks = [];
  const usedTaskIds = new Set();

  if (mode === 'weekday') {
    const commuteStart = toMinutes(s.commuteStart);
    const workStart = toMinutes(s.workStart);
    const workEnd = toMinutes(s.workEnd);
    const commuteDur = Number(s.commuteMinutes) || 60;
    const homeArrival = workEnd + commuteDur;

    // Morning routine (Health & Food first)
    if (commuteStart > wakeMin) {
      blocks.push({
        id: uid('blk'),
        title: 'Wake, Hydrate & High-Protein Breakfast',
        startMin: wakeMin,
        durationMin: commuteStart - wakeMin,
        category: 'food',
        fixed: true,
        audioOnly: false,
        priority: 1,
        status: 'planned',
        taskId: null,
        notes: 'No weekday lunch prep needed — work cafeteria covers lunch.'
      });
    }

    // Morning Commute (Hands-free audio)
    const nextAudio = (state.audioQueue || []).find((a) => !a.done);
    blocks.push({
      id: uid('blk'),
      title: nextAudio ? `Drive Audio: ${nextAudio.title}` : 'Morning Drive — Audio Learning',
      startMin: commuteStart,
      durationMin: workStart - commuteStart,
      category: 'commute',
      fixed: true,
      audioOnly: true,
      priority: 2,
      status: 'planned',
      taskId: null,
      notes: 'Hands-free audio only. Never use screen while driving.'
    });

    // Day Job
    blocks.push({
      id: uid('blk'),
      title: s.cafeteriaLunch ? 'Day Job (Cafeteria Lunch Included)' : 'Day Job',
      startMin: workStart,
      durationMin: workEnd - workStart,
      category: 'work',
      fixed: true,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: s.cafeteriaLunch ? 'Use work cafeteria for main midday nutrition.' : ''
    });

    // Return Commute
    blocks.push({
      id: uid('blk'),
      title: 'Return Drive — Audio / Mental Reset',
      startMin: workEnd,
      durationMin: commuteDur,
      category: 'commute',
      fixed: true,
      audioOnly: true,
      priority: 2,
      status: 'planned',
      taskId: null,
      notes: 'Hands-free audio or voice-note review of evening plan.'
    });

    // Prime Evening Window: homeArrival -> windDownMin
    let cursor = homeArrival;
    const ceiling = windDownMin > homeArrival ? windDownMin : 21 * 60 + 15;
    const available = Math.max(0, ceiling - cursor);

    if (available >= 35) {
      const dinnerDur = Math.min(40, available);
      blocks.push({
        id: uid('blk'),
        title: 'Dinner, Hydration & Kitchen Reset',
        startMin: cursor,
        durationMin: dinnerDur,
        category: 'food',
        fixed: false,
        audioOnly: false,
        priority: 1,
        status: 'planned',
        taskId: null,
        notes: 'Use weekend batch prep or 15-min root-cellar meal.'
      });
      cursor += dinnerDur;
    }

    // Pick top Phase-1 Homestead/Transport task that fits
    const rem1 = ceiling - cursor;
    if (rem1 >= 30) {
      const homesteadPick = pickBestTask(state.tasks, {
        maxDuration: Math.min(90, rem1),
        excludeIds: usedTaskIds,
        areas: ['Tiny House', 'Cars', 'Well', 'Root Cellar', 'Garden', 'Workshop']
      });
      const dur = homesteadPick ? Math.min(homesteadPick.durationMin, rem1) : Math.min(60, rem1);
      if (homesteadPick) usedTaskIds.add(homesteadPick.id);
      blocks.push({
        id: uid('blk'),
        title: homesteadPick ? homesteadPick.title : 'Tiny House / Homestead Priority Work',
        startMin: cursor,
        durationMin: dur,
        category: homesteadPick?.area === 'Cars' ? 'transport' : 'homestead',
        fixed: false,
        audioOnly: false,
        priority: 2,
        status: 'planned',
        taskId: homesteadPick?.id || null,
        notes: homesteadPick ? `${homesteadPick.area} • ${homesteadPick.costTier === 'free' ? '$0 on-hand' : 'Budgeted'}` : 'Focus on 1 Phase-1 bottleneck.'
      });
      cursor += dur;
    }

    // Parallel Skill & Income sprint
    const rem2 = ceiling - cursor;
    if (rem2 >= 25) {
      const skillPick = pickBestTask(state.tasks, {
        maxDuration: Math.min(60, rem2),
        excludeIds: usedTaskIds,
        areas: ['Skill & Income']
      });
      const dur = skillPick ? Math.min(skillPick.durationMin, rem2) : Math.min(45, rem2);
      if (skillPick) usedTaskIds.add(skillPick.id);
      blocks.push({
        id: uid('blk'),
        title: skillPick ? skillPick.title : 'High-Income Skill / Escape-Scarcity Sprint',
        startMin: cursor,
        durationMin: dur,
        category: 'skill',
        fixed: false,
        audioOnly: false,
        priority: 3,
        status: 'planned',
        taskId: skillPick?.id || null,
        notes: 'Compound skills/income so money stops being the bottleneck.'
      });
      cursor += dur;
    }

    // Quick mobility / next-day staging if time left
    const rem3 = ceiling - cursor;
    if (rem3 >= 15) {
      blocks.push({
        id: uid('blk'),
        title: 'Mobility Stretch, Clothes & Breakfast Stage',
        startMin: cursor,
        durationMin: rem3,
        category: 'health',
        fixed: false,
        audioOnly: false,
        priority: 4,
        status: 'planned',
        taskId: null,
        notes: 'Eliminate 5:15 AM friction before sleeping.'
      });
      cursor += rem3;
    }

    // Sleep protection wind-down
    blocks.push({
      id: uid('blk'),
      title: `Sleep Protection Wind-Down (Lights out ${fromMinutes(bedMin)})`,
      startMin: ceiling,
      durationMin: s.windDownMinutes || 30,
      category: 'sleep',
      fixed: true,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: `Protects ${s.sleepTargetHours}h sleep before ${s.wakeTime} wake-up.`
    });
  } else {
    // WEEKEND MODE: Fully dedicated to Homestead, Food, Transport + Parallel Skill
    const startMin = toMinutes(s.weekendStart || '07:00');
    const ceiling = windDownMin > startMin ? windDownMin : 21 * 60 + 15;
    let cursor = startMin;

    // 1. Morning Health & Breakfast
    blocks.push({
      id: uid('blk'),
      title: 'Wake, Hydrate, Mobility & High-Protein Breakfast',
      startMin: cursor,
      durationMin: 45,
      category: 'health',
      fixed: false,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: 'Health first before heavy homestead labor.'
    });
    cursor += 45;

    // 2. Food Batch Prep & Root Cellar/Garden
    blocks.push({
      id: uid('blk'),
      title: 'Food Batch Prep + Garden / Root Cellar Harvest',
      startMin: cursor,
      durationMin: 150,
      category: 'food',
      fixed: false,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: 'Cook 4-5 weekday dinners + boil eggs to save weekday evenings & cash.'
    });
    cursor += 150;

    // 3. Homestead Heavy Block #1 (Tiny House / Well / Workshop)
    const homePick1 = pickBestTask(state.tasks, {
      maxDuration: 180,
      excludeIds: usedTaskIds,
      areas: ['Tiny House', 'Well', 'Workshop', 'Garden', 'Root Cellar', 'Abandoned House']
    });
    if (homePick1) usedTaskIds.add(homePick1.id);
    const hDur1 = 180;
    blocks.push({
      id: uid('blk'),
      title: homePick1 ? homePick1.title : 'Homestead Core Build (Tiny House / Well)',
      startMin: cursor,
      durationMin: hDur1,
      category: 'homestead',
      fixed: false,
      audioOnly: false,
      priority: 2,
      status: 'planned',
      taskId: homePick1?.id || null,
      notes: 'Peak daylight hours for physical construction & repairs.'
    });
    cursor += hDur1;

    // 4. Midday Meal & Recovery
    blocks.push({
      id: uid('blk'),
      title: 'Hot Meal & 20-min Physical Rest',
      startMin: cursor,
      durationMin: 45,
      category: 'food',
      fixed: false,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: 'Fuel up so afternoon work stays sharp and injury-free.'
    });
    cursor += 45;

    // 5. Transport / Cars Reliability
    const carPick = pickBestTask(state.tasks, {
      maxDuration: 120,
      excludeIds: usedTaskIds,
      areas: ['Cars']
    });
    if (carPick) usedTaskIds.add(carPick.id);
    blocks.push({
      id: uid('blk'),
      title: carPick ? carPick.title : 'Cars, Fluids, Tools & Commute Reliability Check',
      startMin: cursor,
      durationMin: 90,
      category: 'transport',
      fixed: false,
      audioOnly: false,
      priority: 2,
      status: 'planned',
      taskId: carPick?.id || null,
      notes: 'Zero unexpected breakdowns on Monday 6:00 AM.'
    });
    cursor += 90;

    // 6. Homestead Block #2
    const homePick2 = pickBestTask(state.tasks, {
      maxDuration: 120,
      excludeIds: usedTaskIds,
      areas: ['Tiny House', 'Workshop', 'Root Cellar', 'Garden', 'Abandoned House']
    });
    if (homePick2) usedTaskIds.add(homePick2.id);
    const remBeforeSkill = Math.max(60, ceiling - cursor - 150);
    const hDur2 = Math.min(120, remBeforeSkill);
    if (hDur2 >= 45) {
      blocks.push({
        id: uid('blk'),
        title: homePick2 ? homePick2.title : 'Homestead Wrap-Up & Material Staging',
        startMin: cursor,
        durationMin: hDur2,
        category: 'homestead',
        fixed: false,
        audioOnly: false,
        priority: 3,
        status: 'planned',
        taskId: homePick2?.id || null,
        notes: 'Clean tools before dark.'
      });
      cursor += hDur2;
    }

    // 7. Skill & Income Deep Work
    const remSkill = ceiling - cursor;
    if (remSkill >= 90) {
      const skillPick = pickBestTask(state.tasks, {
        maxDuration: 120,
        excludeIds: usedTaskIds,
        areas: ['Skill & Income']
      });
      if (skillPick) usedTaskIds.add(skillPick.id);
      blocks.push({
        id: uid('blk'),
        title: skillPick ? skillPick.title : 'Skill & Income Deep Work Block',
        startMin: cursor,
        durationMin: 90,
        category: 'skill',
        fixed: false,
        audioOnly: false,
        priority: 3,
        status: 'planned',
        taskId: skillPick?.id || null,
        notes: 'Build long-term financial leverage.'
      });
      cursor += 90;
    }

    // 8. Dinner & Prep
    const remDinner = ceiling - cursor;
    if (remDinner >= 30) {
      blocks.push({
        id: uid('blk'),
        title: 'Dinner, Stretch & Next-Day Staging',
        startMin: cursor,
        durationMin: remDinner,
        category: 'food',
        fixed: false,
        audioOnly: false,
        priority: 1,
        status: 'planned',
        taskId: null,
        notes: 'Review weekly scorecard before wind-down.'
      });
    }

    // 9. Sleep Protection
    blocks.push({
      id: uid('blk'),
      title: `Sleep Protection Wind-Down (Lights out ${fromMinutes(bedMin)})`,
      startMin: ceiling,
      durationMin: s.windDownMinutes || 30,
      category: 'sleep',
      fixed: true,
      audioOnly: false,
      priority: 1,
      status: 'planned',
      taskId: null,
      notes: 'Protect recovery for next week.'
    });
  }

  return {
    date: dateKey,
    mode,
    blocks,
    energy: null,
    hydrationOk: false,
    breakfastDone: false,
    dinnerDone: false,
    cafeteriaLunchUsed: mode === 'weekday' && s.cafeteriaLunch,
    review: {
      win: '',
      blocker: '',
      sleepProtected: null,
      submittedAt: null
    }
  };
}

/**
 * Smart Slip-Recovery / Auto-Adjust Algorithm:
 * Re-packs unfinished flexible blocks starting from `fromMin` up to Sleep Wind-Down.
 * Protects sleep, food, and highest-ROI Phase-1 work; defers lower-priority blocks when time shrinks.
 */
export function rebalanceDayPlan(day, state, { fromMin = getNowMinutes(), energyMode = 'normal' } = {}) {
  const { windDownMin } = getSleepSchedule(state.settings);
  const sleepBlock = day.blocks.find((b) => b.category === 'sleep');
  const ceiling = sleepBlock ? sleepBlock.startMin : windDownMin;

  const locked = day.blocks.filter((b) => b.status === 'done' || b.status === 'skipped' || (b.fixed && b.category !== 'sleep'));
  const pendingFlex = day.blocks.filter((b) => b.status === 'planned' || b.status === 'active')
    .filter((b) => !b.fixed);

  // Determine earliest safe cursor (never overlap ongoing fixed anchors like work)
  let cursor = fromMin;
  for (const b of locked) {
    const end = b.startMin + b.durationMin;
    if (b.startMin <= cursor && end > cursor) {
      cursor = end;
    }
  }

  // Sort pending flexible blocks by priority (1 = Health/Food, 2 = Homestead/Cars, 3 = Skill, 4 = Other)
  const prioritized = [...pendingFlex].sort((a, b) => (a.priority || 3) - (b.priority || 3));
  const kept = [];
  const deferred = [];

  for (const blk of prioritized) {
    const available = ceiling - cursor;
    if (available < 15) {
      deferred.push(blk);
      continue;
    }

    let targetDur = blk.durationMin;
    if (energyMode === 'low' && blk.priority >= 2) {
      // In low-energy recovery mode, cap physical/heavy blocks to 30m quick wins and drop priority 4
      if (blk.priority >= 4) {
        deferred.push(blk);
        continue;
      }
      targetDur = Math.min(targetDur, 30);
    }

    if (targetDur > available) {
      if (available >= 25 && blk.priority <= 3) {
        targetDur = available; // Compress to fit before sleep lock
      } else {
        deferred.push(blk);
        continue;
      }
    }

    kept.push({
      ...blk,
      startMin: cursor,
      durationMin: targetDur
    });
    cursor += targetDur;
  }

  const rebuilt = [...locked, ...kept];
  if (sleepBlock) {
    rebuilt.push(sleepBlock);
  }
  rebuilt.sort((a, b) => a.startMin - b.startMin);

  return {
    updatedBlocks: rebuilt,
    deferredBlocks: deferred,
    ceilingMin: ceiling
  };
}

export function getCoachInsights(state, day) {
  const insights = [];
  const s = state.settings;
  const openTasks = state.tasks.filter((t) => t.status !== 'done');
  const wipCount = openTasks.filter((t) => t.activeWip).length;

  // 1. Sleep debt check
  const recentSleep = (state.sleepLogs || []).slice(-5);
  const lowSleepDays = recentSleep.filter((l) => l.hours < (s.sleepTargetHours - 0.5)).length;
  if (lowSleepDays >= 2) {
    insights.push({
      level: 'warn',
      title: 'Sleep Debt Detected',
      text: `You logged under ${(s.sleepTargetHours - 0.5).toFixed(1)}h sleep ${lowSleepDays} times recently. Protect tonight's ${fromMinutes(getSleepSchedule(s).bedMin)} lights-out — skip non-essential tasks if needed.`
    });
  }

  // 2. WIP guard
  if (wipCount > s.wipLimit) {
    insights.push({
      level: 'warn',
      title: `Too Many Active Projects (${wipCount}/${s.wipLimit})`,
      text: 'Elon/Manager rule: Finish 1 Tiny House or Phase-1 bottleneck completely before opening new fronts like the Abandoned House.'
    });
  }

  // 3. $0 scarcity leverage
  const freeHighRoi = sortTasksByRoi(openTasks).filter((t) => t.costTier === 'free' && t.phase === 1);
  if (freeHighRoi.length > 0) {
    insights.push({
      level: 'good',
      title: `Top $0 Leverage Today: ${freeHighRoi[0].area}`,
      text: `"${freeHighRoi[0].title}" costs $0 using on-hand resources (${formatDuration(freeHighRoi[0].durationMin)}).`
    });
  }

  // 4. Commute audio potential
  const unloggedAudio = (state.audioQueue || []).filter((a) => !a.done).length;
  if (unloggedAudio === 0) {
    insights.push({
      level: 'info',
      title: 'Queue Commute Audio',
      text: 'Your 2h/day drive equals 10h/week (500+ hrs/year). Add a skill/business audio topic in Growth for hands-free compounding.'
    });
  }

  // 5. Cafeteria reminder
  if (day?.mode === 'weekday' && s.cafeteriaLunch) {
    insights.push({
      level: 'info',
      title: 'Zero-Prep Weekday Lunch',
      text: 'Work cafeteria handles lunch — keep evening food effort focused strictly on quick dinners & weekend batch prep.'
    });
  }

  return insights;
}

export function getWeeklyStats(state) {
  const now = new Date();
  const stats = {
    completedBlocks: 0,
    plannedBlocks: 0,
    minutesByCat: { food: 0, health: 0, homestead: 0, transport: 0, skill: 0, commute: 0 },
    avgSleep: 0,
    tasksCompleted: 0
  };

  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(todayKey(d));
  }

  for (const k of keys) {
    const day = state.days[k];
    if (!day) continue;
    for (const b of day.blocks || []) {
      if (b.fixed && b.category === 'work') continue;
      stats.plannedBlocks += 1;
      if (b.status === 'done') {
        stats.completedBlocks += 1;
        if (stats.minutesByCat[b.category] !== undefined) {
          stats.minutesByCat[b.category] += (b.actualDurationMin || b.durationMin || 0);
        }
      }
    }
  }

  const recentSleep = (state.sleepLogs || []).filter((l) => keys.includes(l.date));
  if (recentSleep.length > 0) {
    stats.avgSleep = recentSleep.reduce((sum, l) => sum + Number(l.hours || 0), 0) / recentSleep.length;
  }

  stats.tasksCompleted = (state.tasks || []).filter((t) => t.status === 'done' && keys.includes(t.completedAt)).length;
  return stats;
}