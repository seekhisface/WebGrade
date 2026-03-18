/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Frost theme — sky blue / white / deep navy
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        nav: {
          bg:     '#0c4a6e',
          border: '#075985',
        },
        page: {
          bg:     '#f0f9ff',
          card:   '#ffffff',
          border: '#bae6fd',
        },
        status: {
          green:  '#0d9488',
          yellow: '#b45309',
          red:    '#b91c1c',
          blue:   '#0284c7',
        },
        intent: {
          high:       '#0d9488',
          medium:     '#b45309',
          low:        '#b91c1c',
          researcher: '#7c3aed',
          competitor: '#64748b',
          bot:        '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(12,74,110,0.08), 0 1px 2px rgba(12,74,110,0.04)',
        'card-md': '0 4px 12px rgba(12,74,110,0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
