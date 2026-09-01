/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'system-ui', 'sans-serif'],
        rajdhani: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        void: {
          950: '#05060e',
          900: '#080c18',
          800: '#0d1425',
          700: '#141d33',
        },
        neon: {
          cyan: '#22d3ee',
          blue: '#3b82f6',
          pink: '#f472b6',
          violet: '#a855f7',
          mint: '#34d399',
          amber: '#fbbf24',
          red: '#ef4444',
        },
      },
      boxShadow: {
        neon: '0 0 24px rgba(34,211,238,0.35), inset 0 0 20px rgba(34,211,238,0.10)',
        'neon-pink': '0 0 24px rgba(244,114,182,0.35), inset 0 0 20px rgba(244,114,182,0.10)',
        panel: '0 24px 70px -18px rgba(0,0,0,0.85)',
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.8' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
      },
    },
  },
  plugins: [],
};
