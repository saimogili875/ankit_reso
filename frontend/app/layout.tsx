import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import './landing.css';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AuthProvider } from '@/hooks/use-auth';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
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
    <html lang="en" className={`${bricolage.variable} ${figtree.variable} dark`}>
      <body className="antialiased bg-[#F4F6F8] dark:bg-slate-950 text-[#101828] dark:text-slate-100 font-sans min-h-[100dvh]">
        <ClerkProvider
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
