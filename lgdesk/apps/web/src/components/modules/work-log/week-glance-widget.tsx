'use client';

import { Icon } from '../../ui/icon';

// Header "week-glance" pill — LGDesk_Master_Reference.md Part 45
// (`#wl-widget-container`): day-letter row + week nav + attendance summary,
// persists across all views. This phase ships the shell/visual placeholder
// only (fixed 46px pill, static content) — wiring it to real attendance
// data is a later phase; do not add data fetching here yet.
const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekGlanceWidget() {
  return (
    <div
      title="This week's attendance"
      className="hidden items-center gap-2 rounded-[14px] bg-white/[0.08] px-3 text-white sm:flex"
      style={{ height: 46 }}
    >
      <Icon name="calendar_view_week" size={15} className="opacity-70" />
      <div className="flex flex-col justify-center leading-tight">
        <div className="flex gap-[3px] text-[9px] font-semibold tracking-wide text-white/60">
          {DAY_LETTERS.map((d, i) => (
            <span key={i} className="w-2.5 text-center">{d}</span>
          ))}
        </div>
        <div className="text-[10px] text-white/80">This week</div>
      </div>
    </div>
  );
}

export default WeekGlanceWidget;
