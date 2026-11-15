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
        mist: {
          slate: '#F8FAFC',
          rose: '#FDF2F8',
          sky: '#EFF6FF',
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
        },
      },
      boxShadow: {
        glass: '0 8px 30px rgba(15, 23, 42, 0.05)',
        'glass-lg': '0 18px 50px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
