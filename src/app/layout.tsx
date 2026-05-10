import type { Metadata, Viewport } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import { APP_NAME } from '@/lib/constants';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

/* ──────────────────────────────────────────────────────────────────────────
   Fonts — loaded via next/font for zero-CLS, automatic preloading
   ─ DM Sans  → UI body & headings (modern, neutral, premium)
   ─ DM Serif → display accents (numbers, hero titles, invoice typography)
   ────────────────────────────────────────────────────────────────────────── */

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-dm-serif',
  display: 'swap',
  weight: ['400'],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s — ${APP_NAME}`,
  },
  description: "Système d'exploitation interne de l'agence Supra v.",
  robots: { index: false, follow: false }, // Internal app — never index
  // Favicon clair/sombre : attribut `media` sur les <link> (les navigateurs ignorent souvent le @media *dans* le SVG).
  icons: {
    icon: [
      {
        url: '/favicon-dark.svg',
        type: 'image/svg+xml',
        media: '(prefers-color-scheme: dark)',
      },
      // Fallback clair (thème clair ou navigateur qui n’applique pas `media` sur la première entrée)
      { url: '/favicon-light.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#080706',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${dmSerif.variable}`} suppressHydrationWarning>
      {/* suppressHydrationWarning: password-manager / security extensions often inject body attrs (e.g. bis_register) before hydration. */}
      <body
        suppressHydrationWarning
        className="min-h-screen bg-background text-foreground font-sans antialiased"
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
