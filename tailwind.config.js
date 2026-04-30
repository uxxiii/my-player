/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0f0f0f',
        'dark-card': '#1e1e1e',
        'dark-border': '#2a2a2a',
        'blue-primary': '#3b82f6',
        'blue-secondary': '#2563eb',
        'blue-accent': '#60a5fa',
      },
      height: {
        'screen': '100vh',
      }
    },
  },
  plugins: [],
}
