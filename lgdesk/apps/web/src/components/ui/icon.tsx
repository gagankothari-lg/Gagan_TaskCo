import { resolveIcon } from '../../lib/icons';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  title?: string;
  onClick?: React.MouseEventHandler<SVGSVGElement>;
}

/**
 * Lucide icon resolved from a legacy Material-Symbol name via lib/icons.ts.
 * Usage is unchanged across the app: <Icon name="task_alt" />. This is the
 * ONLY place lucide-react is imported for name-keyed icons — everywhere
 * else keeps using <Icon name="..." /> so the whole app's icon set updates
 * whenever lib/icons.ts changes.
 */
export function Icon({ name, className = '', size = 20, style, title, onClick }: IconProps) {
  const Glyph = resolveIcon(name);
  return (
    <Glyph
      size={size}
      className={className}
      style={style}
      onClick={onClick}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...(title ? { title } : {})}
    />
  );
}

export default Icon;
