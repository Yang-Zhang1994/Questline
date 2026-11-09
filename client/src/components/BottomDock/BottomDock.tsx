import { NavLink } from 'react-router';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-pill px-[1.1rem] py-[0.65rem] font-bold no-underline transition-colors',
    isActive
      ? 'bg-gel-pink text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45)]'
      : 'bg-transparent text-blue-ink hover:bg-blue-pale',
  ].join(' ');

export function BottomDock() {
  return (
    <nav
      className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2 rounded-pill bg-white/92 p-[0.45rem] shadow-dock"
      aria-label="Main"
    >
      <NavLink to="/" end className={linkClass}>
        ☀️ Today
      </NavLink>
      <span
        className="cursor-default rounded-pill bg-transparent px-[1.1rem] py-[0.65rem] font-bold text-blue-ink/50"
        aria-disabled="true"
        title="Map arrives in a later issue"
      >
        🗺️ Map
      </span>
      <NavLink to="/talk" className={linkClass}>
        💌 Talk
      </NavLink>
    </nav>
  );
}
