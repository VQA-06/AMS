/** @type {import('tailwindcss').Config} */

// "Paper Ledger" palette. A warm-paper ground, ink type, hairline rules, and
// exactly one signal hue (pen). Every text token clears WCAG AA on paper:
//
//   ink 15.71:1   ink-2 6.91:1   ink-3 5.00:1
//   pen  5.33:1   seal 5.29:1    pending 5.24:1   info 6.16:1
//
// `rule` (1.32:1) and `rule-strong` (1.87:1) are hairlines only — never text.
//
// `pen` is reserved for breach and live action. `danger` shares its base on
// purpose: a destructive row and a live row must not be told apart by hue
// alone, and both are meant to read as "the pen wrote on this".
const PAPER_WHITE = '#FDFBF7';

const state = (hex) => ({
  50: tint(hex, 0.94),
  100: tint(hex, 0.88),
  200: tint(hex, 0.76),
  300: tint(hex, 0.56),
  400: tint(hex, 0.32),
  500: hex,
  600: shade(hex, 0.14),
  700: shade(hex, 0.3),
  800: shade(hex, 0.48),
  900: shade(hex, 0.7),
  950: shade(hex, 0.85),
});

function mix(hex, target, amount) {
  const from = parse(hex);
  const to = parse(target);
  const channels = from.map((c, i) => Math.round(c + (to[i] - c) * amount));
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
function parse(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function tint(hex, amount) {
  return mix(hex, PAPER_WHITE, amount);
}
function shade(hex, amount) {
  return mix(hex, '#000000', amount);
}

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        // Fraunces carries display type only (>=20px) and KPI figures; body
        // copy stays Plus Jakarta Sans so density is unaffected.
        heading: ['Fraunces', '"Plus Jakarta Sans"', 'serif'],
        display: ['Fraunces', '"Plus Jakarta Sans"', 'serif'],
        oxanium: ['Oxanium', 'Fraunces', 'sans-serif'],
        mono: ['Oxanium', 'Fraunces', 'sans-serif'],
      },
      colors: {
        paper: '#F4F1EA',
        'paper-raised': '#FAF8F3',
        'paper-sunk': '#EAE6DC',
        ink: '#1A1815',
        'ink-2': '#55524B',
        'ink-3': '#6B675D',
        rule: '#D8D3C7',
        'rule-strong': '#B9B2A2',
        pen: state('#B03A2E'),
        'pen-deep': '#9C3226',
        seal: state('#2F6F52'),
        pending: state('#8A5A12'),
        info: state('#3F5C7A'),
        danger: state('#B03A2E'),
      },
      borderRadius: {
        bezel: '0.75rem',
        core: 'calc(0.75rem - 0.25rem)',
        panel: '0.875rem',
        chip: '0.5rem',
      },
      zIndex: {
        sticky: 20,
        reveal: 30,
        bar: 40,
        dock: 50,
        modal: 60,
        toast: 70,
      },
      transitionDuration: {
        120: '120ms',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-quint': 'cubic-bezier(0.64, 0, 0.78, 0)',
      },
      animation: {
        'reveal-up': 'reveal-up 720ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};