/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontWeight: {
        '600': '600',
        '700': '700',
        '800': '800',
      },
      colors: {
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0b9c9',
          400: '#8593aa',
          500: '#65748d',
          600: '#505d73',
          700: '#414b5d',
          800: '#38404f',
          900: '#1a1f2b',
          950: '#0d1117',
        },
        brand: {
          50: '#eefffd',
          100: '#c6fff8',
          200: '#8efff1',
          300: '#4dffe6',
          400: '#1aecd0',
          500: '#06d0b4',
          600: '#00a690',
          700: '#048475',
          800: '#0a6961',
          900: '#0d564f',
          950: '#00332f',
        },
        accent: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(6,208,180,0.25), 0 10px 40px -10px rgba(6,208,180,0.35)',
        card: '0 1px 2px rgba(13,17,23,0.4), 0 10px 30px -15px rgba(13,17,23,0.6)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
