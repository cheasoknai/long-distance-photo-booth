/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bricolage Grotesque'", 'system-ui', 'sans-serif'],
        sans: ["'DM Sans'", 'system-ui', 'sans-serif'],
        mono: ["'DM Mono'", 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
