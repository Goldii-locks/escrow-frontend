/**
 * The Milestone mark from design/landing-reference.html. Decorative wherever
 * it sits next to the wordmark, so it is aria-hidden and the accessible name
 * comes from the surrounding link or text.
 */
export default function LandingLogo({
  size = 24,
  color = "#F0B90A",
  full = true,
}: {
  size?: number;
  color?: string;
  full?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="56" height="56" rx="16" stroke={color} strokeWidth="4" />
      <path
        d="M18 44 L32 32 L46 20"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {full && <circle cx="18" cy="44" r="4" fill={color} opacity="0.45" />}
      {full && <circle cx="32" cy="32" r="4.5" fill={color} opacity="0.75" />}
      <circle cx="46" cy="20" r="6" fill={color} />
    </svg>
  );
}
