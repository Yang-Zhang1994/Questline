/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--page)',
        'sky-top': 'var(--sky-top)',
        pink: {
          DEFAULT: 'var(--pink)',
          ink: 'var(--pink-ink)',
          pale: 'var(--pink-pale)',
          gel: '#ff8fc4',
        },
        blue: {
          ink: 'var(--blue-ink)',
          pale: 'var(--blue-pale)',
        },
        purple: {
          pale: 'var(--purple-pale)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        panel: 'var(--panel)',
        meadow: 'var(--meadow)',
        road: 'var(--road)',
        walked: 'var(--walked)',
        tree: 'var(--tree)',
        danger: '#b00040',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        ui: ['var(--font-ui)'],
      },
      borderRadius: {
        window: 'var(--radius-window)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        window: 'var(--shadow-window)',
        polaroid: '0 4px 0 rgba(61, 53, 112, 0.08)',
        dock: '0 8px 24px rgba(28, 127, 200, 0.2)',
      },
      backgroundImage: {
        'sky-meadow':
          'radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.85), transparent 28%), radial-gradient(circle at 88% 12%, rgba(255, 255, 255, 0.7), transparent 22%), linear-gradient(180deg, var(--sky-top) 0%, var(--page) 42%, var(--meadow) 100%)',
        'gel-pink': 'linear-gradient(180deg, #ff8fc4 0%, var(--pink) 100%)',
        'brand-title': 'linear-gradient(90deg, #ff6fb1, #ff9a5a, #38acf0)',
        'note-lines':
          'repeating-linear-gradient(transparent, transparent 27px, rgba(255, 111, 177, 0.18) 28px)',
        sparkles:
          'radial-gradient(circle at 18% 24%, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px), radial-gradient(circle at 72% 18%, rgba(255, 255, 255, 0.75) 0 1.5px, transparent 3px), radial-gradient(circle at 84% 40%, rgba(255, 255, 255, 0.8) 0 2px, transparent 3px)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        'rise-in': 'rise-in 420ms ease both',
        'soft-bob': 'soft-bob 3.2s ease-in-out infinite',
        twinkle: 'twinkle 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
