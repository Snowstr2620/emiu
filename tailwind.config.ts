import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        velvet: {
          obsidian: '#080306',
          deep: '#12070c',
          surface: '#190911',
          elevated: '#260e1a',
        },
        crimson: {
          core: '#e11d48',
          vivid: '#ef4444',
          rose: '#fb7185',
          blush: '#fda4af',
        },
      },
      boxShadow: {
        glass: '0 12px 38px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 228, 230, 0.08)',
        'glass-lg': '0 24px 64px rgba(225, 29, 72, 0.22), inset 0 1px 0 rgba(255, 228, 230, 0.14)',
        'crimson-glow': '0 0 42px rgba(225, 29, 72, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
