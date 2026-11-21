import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1f3b6e', 600: '#2a4c8a', 50: '#eef2f9' },
        grid: '#2b8a3e',
        formula: '#b02a2a',
        result: '#1f4fa8',
        alt: '#f4f7fb',
        pole: '#c92a2a',
        locus: '#2a6fdb',
        asym: '#e8590c',
        brk: '#2b8a3e',
        cross: '#7b2cbf',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
