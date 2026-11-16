export const STORAGE_KEY = 'forgeday_os_v1';

export const AREAS = [
  'Tiny House',
  'Cars',
  'Well',
  'Food',
  'Health',
  'Garden',
  'Root Cellar',
  'Workshop',
  'Skill & Income',
  'Abandoned House'
];

export const AREA_META = {
  'Tiny House': { color: '#10B981', short: 'Tiny 8m²' },
  'Cars': { color: '#F59E0B', short: 'Cars' },
  'Well': { color: '#06B6D4', short: 'Well' },
  'Food': { color: '#84CC16', short: 'Food' },
  'Health': { color: '#EC4899', short: 'Health' },
  'Garden': { color: '#22C55E', short: 'Garden' },
  'Root Cellar': { color: '#A855F7', short: 'Cellar' },
  'Workshop': { color: '#F97316', short: 'Workshop' },
  'Skill & Income': { color: '#3B82F6', short: 'Skill/$' },
  'Abandoned House': { color: '#64748B', short: 'Old House' }
};

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function createDefaultState() {
  const today = todayKey();
  return {
    version: 1,
    settings: {
      wakeTime: '05:15',
      commuteStart: '06:00',
      workStart: '07:00',
      workEnd: '16:00',
      commuteMinutes: 60,
      sleepTargetHours: 7.5,
      windDownMinutes: 30,
      wipLimit: 3,
      cafeteriaLunch: true,
      weekendStart: '07:00',
      weekendEnd: '21:00',
      weekendSplit: {
        food: 25,
        homestead: 40,
        transport: 15,
        skill: 20
      }
    },
    tasks: [
      {
        id: 't_tiny_1',
        title: 'Air-seal & insulate remaining 8m² tiny house thermal gaps',
        area: 'Tiny House',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 60,
        impact: 5,
        urgent: true,
        weekendHeavy: false,
        activeWip: true,
        status: 'backlog',
        notes: 'Use leftover foam/wood offcuts in workshop first. Direct sleep & heating payoff.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_tiny_2',
        title: 'Install vertical wall shelving in 8m² tiny house to clear floor space',
        area: 'Tiny House',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 90,
        impact: 5,
        urgent: false,
        weekendHeavy: true,
        activeWip: true,
        status: 'backlog',
        notes: 'Scrap lumber + screws from workshop. Zero cash.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_car_1',
        title: 'Weekly 15-min commuter car check (tires, oil, coolant, battery)',
        area: 'Cars',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 15,
        impact: 5,
        urgent: true,
        weekendHeavy: false,
        activeWip: false,
        status: 'backlog',
        notes: '2h daily commute means car breakdown = total schedule collapse.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_well_1',
        title: 'Inspect well cover seal & frost protection before deep cold',
        area: 'Well',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 45,
        impact: 5,
        urgent: true,
        weekendHeavy: true,
        activeWip: false,
        status: 'backlog',
        notes: 'Water security is non-negotiable.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_cellar_1',
        title: 'Sort root cellar crates & remove any spoiling produce',
        area: 'Root Cellar',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 30,
        impact: 4,
        urgent: false,
        weekendHeavy: false,
        activeWip: false,
        status: 'backlog',
        notes: 'Protects free winter calories.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_skill_1',
        title: '45-min high-income skill sprint / portfolio & client outreach',
        area: 'Skill & Income',
        phase: 1,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 45,
        impact: 5,
        urgent: false,
        weekendHeavy: false,
        activeWip: true,
        status: 'backlog',
        notes: 'First-principles escape from cash scarcity: ship 1 tangible asset or outreach/day.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_work_1',
        title: 'Organize workshop hand-tools & clear 1m² bench zone',
        area: 'Workshop',
        phase: 2,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 60,
        impact: 3,
        urgent: false,
        weekendHeavy: true,
        activeWip: false,
        status: 'backlog',
        notes: 'Cuts search time on every future repair.',
        createdAt: today,
        completedAt: null
      },
      {
        id: 't_old_1',
        title: 'Salvage usable dry lumber & hardware from abandoned house',
        area: 'Abandoned House',
        phase: 3,
        costTier: 'free',
        estimatedCost: 0,
        durationMin: 120,
        impact: 3,
        urgent: false,
        weekendHeavy: true,
        activeWip: false,
        status: 'backlog',
        notes: 'Free building material source — only after tiny house critical gaps are sealed.',
        createdAt: today,
        completedAt: null
      }
    ],
    days: {},
    sleepLogs: [
      { date: today, bedTime: '21:45', wakeTime: '05:15', hours: 7.5, quality: 4 }
    ],
    meals: {
      weekdayBreakfasts: [
        '3 eggs + oats or root-veg hash (10 min)',
        'Cottage cheese / yogurt + seeds + apple (5 min)',
        'Leftover batch stew + 2 boiled eggs (5 min)'
      ],
      weekdayDinners: [
        'Reheat weekend batch stew + pickled/cellar veg (10 min)',
        'Pan-fried protein + roasted root cellar potatoes/carrots (20 min)',
        'Lentil & bean skillet with garlic & greens (15 min)'
      ],
      weekendBatchPrep: [
        { id: 'bp_1', title: 'Big pot root-veg & meat/bean stew (4 dinners)', servings: 4, usesCellarGarden: true, doneThisWeek: false },
        { id: 'bp_2', title: 'Boil 10 eggs for rapid weekday breakfasts', servings: 5, usesCellarGarden: false, doneThisWeek: false },
        { id: 'bp_3', title: 'Roast tray of root cellar veggies / prep overnight oats', servings: 4, usesCellarGarden: true, doneThisWeek: false }
      ],
      pantryItems: [
        { id: 'pi_1', name: 'Potatoes, carrots, onions (Root Cellar)', source: 'cellar_garden', estCost: 0, needed: false },
        { id: 'pi_2', name: 'Eggs (20 pack)', source: 'buy', estCost: 4, needed: true },
        { id: 'pi_3', name: 'Rolled oats / buckwheat (bulk)', source: 'buy', estCost: 3, needed: true },
        { id: 'pi_4', name: 'Dry beans / lentils (high protein/$)', source: 'buy', estCost: 3, needed: false }
      ]
    },
    milestones: [
      {
        id: 'm_1',
        title: 'Emergency Transport & Food Cash Buffer',
        category: 'buffer',
        current: 150,
        target: 1000,
        unit: '€',
        notes: 'Protects against sudden car repair or winter bill.'
      },
      {
        id: 'm_2',
        title: 'High-Income Skill Execution Hours',
        category: 'skill',
        current: 8,
        target: 100,
        unit: 'hrs',
        notes: 'Focused evening/weekend blocks + commute audio theory.'
      },
      {
        id: 'm_3',
        title: 'Side / Extra Monthly Income Target',
        category: 'income',
        current: 0,
        target: 500,
        unit: '€/mo',
        notes: 'Escape scarcity by increasing income leverage.'
      }
    ],
    audioQueue: [
      { id: 'aq_1', title: 'First-Principles Systems & Business Leverage', topic: 'Business / Mindset', durationMin: 60, done: false, minutesLogged: 0 },
      { id: 'aq_2', title: 'High-Income Skill Deep Dive (Audio Course)', topic: 'Skill', durationMin: 60, done: false, minutesLogged: 0 },
      { id: 'aq_3', title: 'Nutrition, Sleep & Recovery Science', topic: 'Health', durationMin: 60, done: false, minutesLogged: 0 }
    ]
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const def = createDefaultState();
      saveState(def);
      return def;
    }
    const parsed = JSON.parse(raw);
    const def = createDefaultState();
    return {
      ...def,
      ...parsed,
      settings: { ...def.settings, ...(parsed.settings || {}), weekendSplit: { ...def.settings.weekendSplit, ...(parsed.settings?.weekendSplit || {}) } },
      meals: { ...def.meals, ...(parsed.meals || {}) }
    };
  } catch (err) {
    console.error('Failed to load state, using defaults', err);
    return createDefaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state', err);
  }
}

export function exportStateJson(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateJson(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object' || !parsed.settings || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid ForgeDay backup file format.');
  }
  const def = createDefaultState();
  return {
    ...def,
    ...parsed,
    settings: { ...def.settings, ...parsed.settings },
    meals: { ...def.meals, ...(parsed.meals || {}) }
  };
}