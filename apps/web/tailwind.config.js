/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        handwriting: ['Caveat', 'cursive', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ecff',
          200: '#c7dcfe',
          300: '#a1c4fd',
          400: '#72a2fa',
          500: '#437cf5',
          600: '#2b5ff0',
          700: '#1e48de',
          800: '#1e3cb4',
          900: '#1c358e',
          950: '#142157',
        },
        'brand-primary': {
          50: '#f0f5ff',
          100: '#e0ecff',
          200: '#c7dcfe',
          300: '#a1c4fd',
          400: '#72a2fa',
          500: '#437cf5',
          600: '#2b5ff0',
          700: '#1e48de',
          800: '#1e3cb4',
          900: '#1c358e',
          950: '#142157',
        },
        'brand-navy': {
          800: '#131b2e',
          900: '#0b1329',
          950: '#060b17',
        },
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translateY(-6px)' },
          '50%': { transform: 'translateY(0px)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'float-reverse': 'float-reverse 5s ease-in-out infinite',
        'pulse-subtle': 'pulse-subtle 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
