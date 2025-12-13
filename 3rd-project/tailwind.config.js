/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: '#0133f8',
        accent: '#fe6700',
        surface: '#0b1021',
      },
      backgroundImage: {
        'brand-gradient':
          'radial-gradient(circle at 20% 20%, rgba(1,51,248,0.18), transparent 35%), radial-gradient(circle at 80% 10%, rgba(254,103,0,0.2), transparent 32%), radial-gradient(circle at 80% 80%, rgba(1,51,248,0.12), transparent 36%)',
      },
      boxShadow: {
        glow: '0 0 40px rgba(1,51,248,0.25)',
      },
    },
  },
  plugins: [],
}

