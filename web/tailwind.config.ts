import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        success: { DEFAULT: '#10b981', dark: '#059669' },
        danger: { DEFAULT: '#ef4444', dark: '#dc2626' },
        warning: { DEFAULT: '#f59e0b', dark: '#d97706' },
        neutral: { DEFAULT: '#6b7280', dark: '#4b5563' },
      },
    },
  },
  plugins: [],
} satisfies Config;
