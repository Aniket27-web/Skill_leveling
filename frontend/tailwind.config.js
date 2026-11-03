/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hunter: {
          dark: '#0a0512',
          black: '#05020a',
          purple: {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
            800: '#6b21a8',
            900: '#581c87',
            950: '#3b0764',
          },
        },
      },
      boxShadow: {
        'solo-glow': '0 0 20px rgba(168, 85, 247, 0.45)',
        'solo-glow-lg': '0 0 35px rgba(147, 51, 234, 0.65)',
        'solo-card': '0 4px 20px -2px rgba(147, 51, 234, 0.1)',
      },
    },
  },
  plugins: [],
};
