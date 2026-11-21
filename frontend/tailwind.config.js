/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070d1a',
          900: '#0b1220',
          850: '#0e1628',
          800: '#111b31',
          750: '#152139',
          700: '#1b2947',
        },
        panel: '#0f1830',
        accent: { cyan: '#22d3ee', violet: '#8b5cf6', blue: '#3b82f6' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 40px -12px rgba(0,0,0,0.55)',
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 0 34px -6px rgba(34,211,238,0.28)',
      },
      keyframes: {
        'pulse-soft': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(14px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
        'fade-up': 'fade-up .6s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.8s linear infinite',
      },
    },
  },
  plugins: [],
};
