/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        nuit: { DEFAULT: '#1f2a44', 50: '#eef1f7', 100: '#d9dfec', 600: '#2c3a5c', 700: '#1f2a44', 800: '#161e33' },
        or: { DEFAULT: '#b08a3e', 50: '#faf5ea', 100: '#f1e5c8', 600: '#96732f' },
        parchemin: '#f7f4ee'
      },
      fontFamily: {
        titre: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
}
