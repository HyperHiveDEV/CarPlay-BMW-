/** Palette : variables CSS (src/index.css) pour permettre accent bleu/violet et mode jour/nuit. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        fg: 'rgb(var(--c-fg) / <alpha-value>)',
        mute: 'rgb(var(--c-mute) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        blue: '#168BFF',
        violet: '#A855F7',
        ok: '#34D399',
        warn: '#FBBF24',
        bad: '#F87171',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
