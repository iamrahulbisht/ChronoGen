/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0f',
        surface: '#111118',
        elevated: '#18181f',
        border: '#242430',
        'text-primary': '#e8e8f0',
        'text-secondary': '#8888a0',
        'text-muted': '#44445a',
        accent: '#6c63ff',
        'accent-hover': '#8b84ff',
        'accent-dim': 'rgba(108,99,255,0.13)',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        'lab-badge': '#0ea5e9',
        'free-slot': '#1a1a24',
      },
      fontFamily: {
        display: ['"Space Mono"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
        code: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
