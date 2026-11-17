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
        sunlit: {
          ivory: '#FFFDF5',
          pale: '#FFFBEB',
          butter: '#FEF9C3',
          honey: '#FEF3C7',
          ink: '#1C1917',
        },
        crimson: {
          core: '#dc2626',
          vivid: '#ef4444',
          rose: '#e11d48',
          blush: '#fda4af',
        },
      },
      boxShadow: {
        glass: '0 12px 34px rgba(120, 53, 15, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'glass-lg': '0 22px 54px rgba(220, 38, 38, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
        'crimson-glow': '0 0 36px rgba(220, 38, 38, 0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
