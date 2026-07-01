'use client';

import * as React from 'react';
import { Progress as ProgressPrimitive } from 'radix-ui';

import { cn } from '../../lib/utils';

// shadcn/ui Progress, rewritten against our Tailwind v3 token set (same rationale as
// button.tsx/card.tsx/badge.tsx/dialog.tsx). Track defaults to --border, fill to --p2
// (matches the hand-rolled completion bars this replaces in project-card.tsx).
function Progress({
  className,
  value,
  indicatorClassName,
  indicatorStyle,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
  indicatorStyle?: React.CSSProperties;
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-border', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn('h-full w-full flex-1 rounded-full bg-p2 transition-all', indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
