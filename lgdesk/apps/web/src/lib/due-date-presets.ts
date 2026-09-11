// PTASK-DUE-PRESETS: quick-pick presets shared by the Add-Tasks batch row
// (task-list-view.tsx) and the Tasks filter bar's "Due by" field (filter-bar.tsx).
// Pulled into its own module so neither file has to import the other just for this --
// they already reference each other in the opposite direction (task-list-view.tsx
// imports FilterBar). Deliberately its own Sunday-Saturday week convention -- a
// *different* one from task-list-view.tsx's Monday-start `mondayOf` (used for the
// date/week grouping views) -- the two must never be merged even though both compute
// "end of week".
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
const pad2 = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export type DuePreset = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'thisQuarter';

export function computeDuePreset(preset: DuePreset, today: Date = new Date()): string {
  const base = startOfDay(today);
  switch (preset) {
    case 'today':
      return toYMD(base);
    case 'tomorrow': {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      return toYMD(d);
    }
    case 'thisWeek': {
      const d = new Date(base);
      d.setDate(d.getDate() + ((6 - base.getDay() + 7) % 7));
      return toYMD(d);
    }
    case 'nextWeek': {
      const d = new Date(base);
      d.setDate(d.getDate() + ((6 - base.getDay() + 7) % 7) + 7);
      return toYMD(d);
    }
    case 'thisMonth':
      return toYMD(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    case 'thisQuarter': {
      // Fiscal year April-March: Q1 Apr-Jun -> Jun 30, Q2 Jul-Sep -> Sep 30,
      // Q3 Oct-Dec -> Dec 31, Q4 Jan-Mar -> Mar 31 of the SAME calendar year.
      const m = base.getMonth(); // 0-11
      const endMonth = m >= 3 && m <= 5 ? 5 : m >= 6 && m <= 8 ? 8 : m >= 9 && m <= 11 ? 11 : 2;
      return toYMD(new Date(base.getFullYear(), endMonth + 1, 0));
    }
  }
}

export const DUE_PRESET_OPTIONS: { key: DuePreset; label: string; title: string }[] = [
  { key: 'today', label: 'Today', title: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow', title: 'Tomorrow' },
  { key: 'thisWeek', label: 'This Week', title: 'This Week (Sat)' },
  { key: 'nextWeek', label: 'Next Week', title: 'Next Week (Sat)' },
  { key: 'thisMonth', label: 'This Month', title: 'This Month' },
  { key: 'thisQuarter', label: 'This Quarter', title: 'This (fiscal) Quarter' },
];
