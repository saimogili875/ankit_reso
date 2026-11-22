import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import './landing.css';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AuthProvider } from '@/hooks/use-auth';

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
  title: 'AdeptEduverse — Premier JEE Main & Advanced Prep Platform',
  description: 'A professional EdTech platform for JEE Main & JEE Advanced preparation with video lectures, PYQs, mock tests, and detailed performance analytics.',
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
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="antialiased bg-[#F4F6F8] dark:bg-slate-950 text-[#101828] dark:text-slate-100 font-sans min-h-[100dvh]">
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
            <DashboardShell>{children}</DashboardShell>
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
