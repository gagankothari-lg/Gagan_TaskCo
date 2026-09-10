'use client';

// PNAV-HEADER-RELOCATE: every page used to render its own title+subtitle (the `.ph`/
// `.ph-title`/`.ph-sub` pattern) at the top of its own body. Per explicit request, that
// now lives in the shared top navbar instead, so it's visible without scrolling and the
// navbar's mobile hamburger button (which only ever opened the sidebar) is removed in
// favor of always showing the current page's identity there. This context is the plumbing:
// a page calls `usePageHeader({ title, subtitle, tabs })` once, and `DashboardShell`
// (layout-client.tsx) renders whatever's currently registered inside <header>.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface PageHeaderContent {
  title: ReactNode;
  subtitle?: ReactNode;
  // Tasks'/Projects' My/Team/All ScopeTabs bar, threaded through via each view's
  // `scopeTabsSlot` prop. Undefined for every other page.
  tabs?: ReactNode;
}

interface PageHeaderContextValue {
  content: PageHeaderContent | null;
  setContent: (c: PageHeaderContent | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PageHeaderContent | null>(null);
  return <PageHeaderContext.Provider value={{ content, setContent }}>{children}</PageHeaderContext.Provider>;
}

// Call once per page (top of the component body, unconditionally -- same rules-of-hooks
// as any other hook). Re-registers on every render so a page whose title/subtitle depend
// on data (e.g. Dashboard's greeting, Work Log's date label) stays live; clears only on
// unmount so navigating away never leaves a stale header behind.
export function usePageHeader(content: PageHeaderContent) {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeader must be used within PageHeaderProvider');
  const { setContent } = ctx;
  useEffect(() => {
    setContent(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
  useEffect(() => () => setContent(null), [setContent]);
}

// Consumed only by DashboardShell itself, to render whatever's currently registered.
export function usePageHeaderSlot(): PageHeaderContent | null {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeaderSlot must be used within PageHeaderProvider');
  return ctx.content;
}
