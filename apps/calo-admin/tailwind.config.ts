import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f1117',
          secondary: '#1a1d25',
          hover: '#1e2330',
        },
        accent: {
          DEFAULT: '#38bdf8',
          hover: '#0ea5e9',
        },
        border: {
          subtle: 'rgba(255,255,255,0.08)',
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
          muted: '#64748b',
        },
        status: {
          available: '#22c55e',
          reserved: '#f59e0b',
          sold: '#64748b',
          paid: '#22c55e',
          pending: '#f59e0b',
          shipped: '#38bdf8',
          cancelled: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}

export default config
