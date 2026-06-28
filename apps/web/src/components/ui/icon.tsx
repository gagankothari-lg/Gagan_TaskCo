interface IconProps {
  name: string;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  title?: string;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

/**
 * Material Symbols Outlined glyph. Usage: <Icon name="task_alt" />.
 * The font is loaded via the CDN <link> in the root layout. No Lucide.
 */
export function Icon({ name, className = '', size, style, title, onClick }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      title={title}
      onClick={onClick}
      aria-hidden={title ? undefined : true}
      style={{
        fontSize: size ? `${size}px` : 'inherit',
        lineHeight: 1,
        verticalAlign: 'middle',
        userSelect: 'none',
        ...style,
      }}
    >
      {name}
    </span>
  );
}

export default Icon;
