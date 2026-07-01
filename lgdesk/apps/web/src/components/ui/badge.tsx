import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

// shadcn/ui Badge, rewritten against our Tailwind v3 token set (same rationale as
// button.tsx). Variants line up with the .pill-*/.badge-* colour pairs already in
// globals.css so status/priority pills rendered via <Badge> match the legacy CSS look.
const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-normal transition-colors [&_svg]:pointer-events-none [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-[#fce8e8] text-danger',
        success: 'border-transparent bg-[#e8f5e9] text-ok',
        warning: 'border-transparent bg-[#fff3e0] text-warn',
        outline: 'border-border bg-transparent text-text',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
