import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import './landing.css';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AuthProvider } from '@/hooks/use-auth';
import { ThemeProvider } from '@/providers/theme-provider';

const inter = localFont({
  src: [
    {
      path: '../public/fonts/Inter-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Adept Eduverse — Class VI–XII & JEE Mathematics | Ankit Kumar (IIT Kharagpur)',
  description: 'Official platform for Class VI–XII mathematics, board mastery, and JEE preparation founded by Ankit Kumar (B.Tech, IIT Kharagpur). Video lessons, official publications, and WhatsApp doubt support.',
  icons: {
    icon: '/images/logo-icon.png',
    apple: '/app/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored || 'system';
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground font-sans min-h-[100dvh] transition-colors duration-150">
        <ClerkProvider
          afterSignOutUrl="/"
          appearance={{
            variables: {
              colorPrimary: '#2B2FB8',
              borderRadius: '0.75rem',
            },
          }}
        >
          <AuthProvider>
            <ThemeProvider>
              <DashboardShell>{children}</DashboardShell>
            </ThemeProvider>
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
