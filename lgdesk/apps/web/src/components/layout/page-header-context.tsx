'use client';

// PNAV-HEADER-RELOCATE: every page used to render its own title+subtitle (the `.ph`/
// `.ph-title`/`.ph-sub` pattern) at the top of its own body. Per explicit request, that
// now lives in the shared top navbar instead, so it's visible without scrolling and the
// navbar's mobile hamburger button (which only ever opened the sidebar) is removed in
// favor of always showing the current page's identity there. This context is the plumbing:
// a page calls `usePageHeader({ title, subtitle, tabs })` once, and `DashboardShell`
// (layout-client.tsx) renders whatever's currently registered inside <header>.
import { createContext, useContext, useEffect, useState, type DependencyList, type ReactNode } from 'react';

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
// as any other hook), passing a dependency array exactly like any other effect -- list
// every value the title/subtitle/tabs actually depend on (e.g. [title, openCount] for
// Tasks). PNAV-HEADER-LOOP-FIX: the original version re-registered on every render with
// no deps, which created a self-sustaining update cycle -- each render pushed a new
// object into this provider's state, which re-rendered every context consumer (including
// the calling page itself, since it reads this same context internally), which re-ran
// this effect again, forever. That never tripped React's "Maximum update depth exceeded"
// guard and never threw or froze the tab, but it did continuously starve Next's App
// Router client-side transitions (Link/router.push navigations run inside a
// startTransition-wrapped, interruptible update, and a same/higher-priority update
// recurring every render cycle kept preempting it before it could ever commit) -- so
// navigation silently never completed. A real dependency array fixes this at the root:
// the effect now only re-runs when something the caller actually cares about changes,
// so the cycle settles after one bounce instead of continuing indefinitely. Clears only
// on unmount so navigating away never leaves a stale header behind.
export function usePageHeader(content: PageHeaderContent, deps: DependencyList) {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeader must be used within PageHeaderProvider');
  const { setContent } = ctx;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setContent(content); }, deps);
  useEffect(() => () => setContent(null), [setContent]);
}

// Consumed only by DashboardShell itself, to render whatever's currently registered.
export function usePageHeaderSlot(): PageHeaderContent | null {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) throw new Error('usePageHeaderSlot must be used within PageHeaderProvider');
  return ctx.content;
}
