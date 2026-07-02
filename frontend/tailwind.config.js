/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          50:  '#faf6f0',
          100: '#f0e6d2',
          200: '#e0cda3',
          300: '#cbb079',
          400: '#b3924f',
          500: '#96773a',
          600: '#7a5f2e',
          700: '#5f4a24',
          800: '#453519',
          900: '#2c210f',
        },
      },
    },
  },
  plugins: [],
}
 
