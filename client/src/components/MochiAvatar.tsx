/** Simple Mochi SVG (happy / wink / think) for notes and chat. */
export type MochiMood = 'happy' | 'wink' | 'think';

export function MochiAvatar({ mood = 'happy' }: { mood?: MochiMood }) {
  const leftEye =
    mood === 'wink' ? (
      <path
        d="M34 48 q6 6 12 0"
        fill="none"
        stroke="#3D3570"
        strokeWidth="3"
        strokeLinecap="round"
      />
    ) : (
      <circle cx="40" cy="48" r="3.5" fill="#3D3570" />
    );

  const mouth =
    mood === 'think' ? (
      <circle cx="50" cy="64" r="2.2" fill="#3D3570" />
    ) : (
      <path
        d="M46 62 q4 5 8 0"
        fill="none"
        stroke="#3D3570"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Mochi">
      <ellipse cx="50" cy="86" rx="28" ry="6" fill="rgba(61,53,112,0.12)" />
      <path d="M48 18 c-2-10 8-14 12-6" fill="#8CD96A" />
      <path d="M56 16 c6-8 14-2 10 6" fill="#8CD96A" />
      <circle cx="50" cy="56" r="28" fill="#FFFFFF" stroke="#E8EEF8" strokeWidth="2" />
      {leftEye}
      <circle cx="60" cy="48" r="3.5" fill="#3D3570" />
      <circle cx="36" cy="56" r="5" fill="#FFB7D5" opacity="0.9" />
      <circle cx="64" cy="56" r="5" fill="#FFB7D5" opacity="0.9" />
      {mouth}
      {mood === 'think' ? (
        <g aria-hidden="true">
          <circle cx="78" cy="28" r="3" fill="#FF6FB1" opacity="0.85" />
          <circle cx="86" cy="18" r="2" fill="#FF6FB1" opacity="0.7" />
        </g>
      ) : null}
    </svg>
  );
}
