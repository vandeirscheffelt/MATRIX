import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        card: '#1e2333',
        sidebar: '#161b27',
        accent: '#38bdf8',
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
        muted: '#64748b',
      },
    },
  },
  plugins: [],
}

export default config
