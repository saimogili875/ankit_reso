import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { DashboardShell } from '@/components/layout/dashboard-shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ANKIT JEE — Premier JEE Main & Advanced Prep Platform',
  description: 'A professional EdTech platform for JEE Main & JEE Advanced preparation with video lectures, PYQs, mock tests, and detailed performance analytics.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased bg-slate-950 text-slate-100`}>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
