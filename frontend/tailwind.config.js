/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          50:  '#fbf7f0',
          100: '#f3e8d2',
          200: '#e6d2a8',
          300: '#d6b877',
          400: '#c9a46b',
          500: '#c9a46b',
          600: '#b8935a',
          700: '#96773a',
          800: '#7a5f2e',
          900: '#5f4a24',
        },
      },
    },
  },
  plugins: [],
}
 
