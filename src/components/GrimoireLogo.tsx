/**
 * Grimoire constellation logo, inlined so it can be sized and colored per
 * surface. `variant="light"` is the dark-on-light artwork for light
 * backgrounds; `variant="dark"` is the light-on-dark artwork used on the
 * sidebar. Backgrounds are transparent so the logo blends with any theme.
 */

const PALETTES = {
  light: {
    ring: "#DDE1E6",
    spoke: "#A9AFB8",
    edge: "#C7CBD1",
    node: "#2B2E33",
    core: "#3D7BE0",
  },
  dark: {
    ring: "#4A4E56",
    spoke: "#787E88",
    edge: "#63686F",
    node: "#EBEDF0",
    core: "#5B93EA",
  },
} as const;

interface GrimoireLogoProps {
  variant?: keyof typeof PALETTES;
  size?: number;
  className?: string;
}

export function GrimoireLogo({
  variant = "light",
  size = 24,
  className,
}: GrimoireLogoProps) {
  const c = PALETTES[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="16 14 64 64"
      className={className}
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="27" fill="none" stroke={c.ring} strokeWidth="1.5" />
      <line x1="48" y1="48" x2="48" y2="21" stroke={c.spoke} strokeWidth="2.5" />
      <line x1="48" y1="48" x2="25" y2="61" stroke={c.spoke} strokeWidth="2.5" />
      <line x1="48" y1="48" x2="71" y2="61" stroke={c.spoke} strokeWidth="2.5" />
      <line x1="48" y1="21" x2="25" y2="61" stroke={c.edge} strokeWidth="2" />
      <line x1="25" y1="61" x2="71" y2="61" stroke={c.edge} strokeWidth="2" />
      <line x1="71" y1="61" x2="48" y2="21" stroke={c.edge} strokeWidth="2" />
      <circle cx="48" cy="21" r="4.5" fill={c.node} />
      <circle cx="25" cy="61" r="4.5" fill={c.node} />
      <circle cx="71" cy="61" r="4.5" fill={c.node} />
      <circle cx="48" cy="48" r="7" fill={c.core} />
    </svg>
  );
}
