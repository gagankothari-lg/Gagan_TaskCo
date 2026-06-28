// One 28px attendance dot for the week-member card.
// Colours are the GAS WL week-strip palette (distinct from the work-row editor swatches).

interface DotStyle {
  abbr: string;
  bg: string;
  fg: string;
}

// Keyed by the full attendance string returned in WorkLogEntry.attendance.
const DOT_STYLES: Record<string, DotStyle> = {
  Present: { abbr: 'P', bg: '#c8e6c9', fg: '#2e7d32' },
  'Leave Half Day': { abbr: 'LH', bg: '#ffccbc', fg: '#bf360c' },
  'Leave Full Day': { abbr: 'LF', bg: '#ffcdd2', fg: '#b71c1c' },
  'Extra Full Day': { abbr: 'EF', bg: '#b2dfdb', fg: '#004d40' },
  'Extra Half Day': { abbr: 'EH', bg: '#b2ebf2', fg: '#006064' },
  'Week Off': { abbr: 'W', bg: '#f8bbd0', fg: '#880e4f' },
  'Alternate Week Off': { abbr: 'AW', bg: '#fce4ec', fg: '#880e4f' },
  Holiday: { abbr: 'H', bg: '#bbdefb', fg: '#0d47a1' },
};

const EMPTY: DotStyle = { abbr: '·', bg: '#f5f5f5', fg: '#bdbdbd' };

/** Render a single week-strip dot from an attendance string (empty/unknown → grey). */
export function AttendanceDot({ attendance }: { attendance?: string | null }) {
  const s = (attendance && DOT_STYLES[attendance]) || EMPTY;
  return (
    <span
      title={attendance || 'No log'}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        flexShrink: 0,
      }}
    >
      {s.abbr}
    </span>
  );
}

export default AttendanceDot;
