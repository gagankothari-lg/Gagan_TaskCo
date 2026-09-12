// Verified against LGDesk_Master_Reference.md Part 8 (Brand & Design System)
// + Part 37 (VERIFICATION CHECKLISTS → Application Shell Checklist). The
// canonical CSS custom properties live in src/app/globals.css :root — this
// object mirrors them for non-CSS (JS/TS) consumers.

export const tokens = {
  colors: {
    // Navy — header bg, nav active, primary buttons, stat-card borders (design.md)
    p:       '#2D3E51',
    // Turquoise deep — focus rings, project-card border, progress bars (design.md)
    p2:      '#2F6E68',
    // Zircon — active nav bg, hover bg, chips (design.md)
    p3:      '#ECF1F1',
    // Turquoise deep accent — avatar, accent buttons, Team Member role pill (design.md)
    accent:  '#2F6E68',
    // Danger — Faded orange deep (design.md)
    danger:  '#A35B24',
    // Warning — Solar deep (design.md)
    warn:    '#9C6C10',
    // Success — Pistachio deep (design.md)
    ok:      '#3E7A34',
    // App background — Zircon (design.md)
    bg:      '#ECF1F1',
    // Card / panel / modal surface
    surface: '#ffffff',
    // Default borders — Line (design.md)
    border:  '#DFE6E8',
    // Primary body text — Ink (design.md, = Navy)
    text:    '#2D3E51',
    // Secondary / label / subtitle text — Ink soft (design.md)
    muted:   '#5C6773',
    // Tertiary text — IDs, faint labels — Ink faint (design.md)
    muted2:  '#96A0A8',
    // LG navy (inline style in task/work-log views — not a CSS var)
    lgNavy:  '#2D3E51',
    // LG crimson (inline style in task/work-log views) — Faded orange deep (design.md)
    lgCrimson: '#A35B24',
    // Login gradient — Navy to Turquoise deep (design.md)
    loginGradient: 'linear-gradient(135deg,#2D3E51 0%,#2F6E68 100%)',
  },
  layout: {
    sidebar:          '230px', // --sidebar-width: 230px
    sidebarCollapsed: '54px',  // --sidebar-collapsed: 54px
    headerH:          '68px',  // --hh: 68px (CONFIRMED 68px, NOT 56px — Change #47)
    radius:           '8px',   // --r: 8px
    shadow:           '0 2px 8px rgba(0,0,0,.1)', // --sh
    hover:            'rgba(0,0,0,0.04)', // --hover
  },
  font: {
    family:   "'Inter', sans-serif",
    baseSize: 'clamp(13px, 0.89vw + 9.6px, 15px)',
  },
} as const;

export type Tokens = typeof tokens;
