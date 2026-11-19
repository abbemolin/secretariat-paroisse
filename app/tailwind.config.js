/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nuit: { DEFAULT: '#521a22', 50: '#f8eff0', 100: '#ecd8db', 600: '#6e2a35', 700: '#521a22', 800: '#2b1a1d' },
        or: { DEFAULT: '#d08c4c', 50: '#fcf4ea', 100: '#f4e0c8', 600: '#a8652a' },
        parchemin: '#faf7f2'
      },
      fontFamily: {
        titre: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
