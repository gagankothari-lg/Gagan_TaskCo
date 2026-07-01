// Verified against LGDesk_Master_Reference.md Part 8 (Brand & Design System)
// + Part 37 (VERIFICATION CHECKLISTS → Application Shell Checklist). The
// canonical CSS custom properties live in src/app/globals.css :root — this
// object mirrors them for non-CSS (JS/TS) consumers.

export const tokens = {
  colors: {
    // Primary indigo — header bg, nav active, primary buttons, stat-card borders
    p:       '#1a237e',
    // Lighter indigo — focus rings, project-card border, progress bars
    p2:      '#3949ab',
    // Pale indigo tint — active nav bg, hover bg, chips
    p3:      '#e8eaf6',
    // Teal accent — avatar, accent buttons, Team Member role pill
    accent:  '#00897b',
    // Danger
    danger:  '#c62828',
    // Warning / orange
    warn:    '#e65100',
    // Success / green
    ok:      '#2e7d32',
    // App background
    bg:      '#f0f2f5',
    // Card / panel / modal surface
    surface: '#ffffff',
    // Default borders
    border:  '#e0e0e0',
    // Primary body text
    text:    '#212121',
    // Secondary / label / subtitle text
    muted:   '#757575',
    // Tertiary text — IDs, faint labels
    muted2:  '#9e9e9e',
    // LG navy (inline style in task/work-log views — not a CSS var)
    lgNavy:  '#2D3E51',
    // LG crimson (inline style in task/work-log views)
    lgCrimson: '#E64D3D',
    // Login gradient
    loginGradient: 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)',
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
    family:   "'Montserrat', sans-serif",
    baseSize: 'clamp(13px, 0.89vw + 9.6px, 15px)',
  },
} as const;

export type Tokens = typeof tokens;
