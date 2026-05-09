import type { Config } from 'tailwindcss';

/**
 * SUPRA V. AGENCY OS — TAILWIND
 * Tokens = variables CSS (globals.css). Accents orange Supra (#FF450F / #FF3D0A).
 */

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        surface: 'hsl(var(--surface))',
        'surface-secondary': 'hsl(var(--surface-secondary))',
        'orange-glow': 'hsl(var(--orange-glow))',

        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },

        /* Orange Supra (échelle directe — badges, charts, overrides) */
        supra: {
          DEFAULT: '#ff450f',
          vivid: '#ff3d0a',
          soft: '#ff6a2a',
          deep: '#080706',
          button: '#1a0703',
          brown: '#3a120a',
          border: '#6b2416',
          cream: '#f8f4ef',
          muted: '#a8a19a',
          card: '#11100f',
          surface: '#181513',
          50: '#fff2ed',
          100: '#ffd4c7',
          200: '#ffab94',
          300: '#ff8560',
          400: '#ff6a2a',
          500: '#ff450f',
          600: '#e62e00',
          700: '#b82408',
          800: '#7a1a0a',
          900: '#3d0f06',
        },

        /* Alias rétrocompat : gold → orange Supra */
        gold: {
          DEFAULT: '#ff450f',
          50: '#fff2ed',
          100: '#ffd4c7',
          200: '#ffab94',
          300: '#ff8560',
          400: '#ff6a2a',
          500: '#ff450f',
          600: '#e62e00',
          700: '#b82408',
          800: '#7a1a0a',
          900: '#3d0f06',
        },

        /* Alertes secondaires (hors destructive shadcn) */
        warning: '#c95a38',

        danger: '#c23b32',
        info: '#5b8fd4',

        surfaceScale: {
          0: '#080706',
          1: '#11100f',
          2: '#181513',
          3: '#1f1b18',
          4: '#2a221c',
        },
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        18: '4.5rem',
        88: '22rem',
        112: '28rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.35)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.55), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
        pop: '0 10px 15px -3px rgba(0, 0, 0, 0.55), 0 4px 6px -4px rgba(0, 0, 0, 0.45)',
        'glow-supra': '0 0 28px -6px color-mix(in srgb, #ff450f 32%, transparent)',
        'glow-gold': '0 0 28px -6px color-mix(in srgb, #ff450f 28%, transparent)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'slide-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
