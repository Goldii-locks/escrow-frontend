/** The small diagonal arrow used inside pill buttons and inline links. */
export default function LandingArrow({
  size = 11,
  color = "#F0B90A",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.2 8.8 L8.8 3.2 M8.8 3.2 H4.6 M8.8 3.2 V7.4"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
