export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const CATEGORY_COLORS = {
  food: '#84CC16',
  health: '#EC4899',
  homestead: '#10B981',
  transport: '#F59E0B',
  skill: '#3B82F6',
  commute: '#06B6D4',
  work: '#64748B',
  sleep: '#8B5CF6'
};

export const CATEGORY_LABELS = {
  food: 'Food',
  health: 'Health',
  homestead: 'Homestead',
  transport: 'Transport',
  skill: 'Skill & $',
  commute: 'Drive Audio',
  work: 'Day Job',
  sleep: 'Sleep Lock'
};