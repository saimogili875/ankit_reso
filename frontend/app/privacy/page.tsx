import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, ArrowLeft, Mail, Phone, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Adept Eduverse',
  description: 'How Adept Eduverse collects, protects, and handles student, parent, and buyer information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060B18] text-slate-200">
      <header className="border-b border-slate-800/80 bg-[#0A1128]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Adept Eduverse"
              width={36}
              height={36}
              className="rounded-lg object-contain"
            />
            <span className="text-lg font-bold text-white tracking-wide">Adept Eduverse</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider mb-4">
            <Lock className="w-3.5 h-3.5" />
            Data Protection &amp; Student Privacy
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Last updated: November 2024 • Strictly adhering to Indian Digital Personal Data Protection Act</p>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-3">
              We collect information necessary to provide educational courses, dispatch study books, and maintain student academic records:
            </p>
            <ul className="space-y-2 list-disc list-inside text-slate-300">
              <li><strong>Student &amp; Parent Details:</strong> Full name, student grade/class (VI to XII / Dropper), parent contact details.</li>
              <li><strong>Contact &amp; Delivery:</strong> Email address, mobile phone number, physical shipping address (for hardcopy textbook delivery).</li>
              <li><strong>Academic Progress:</strong> Test scores, question attempts, lecture completion, and doubt submissions.</li>
              <li><strong>Payment Records:</strong> Razorpay transaction IDs and order amounts (we do not store credit/debit card numbers or CVV).</li>
            </ul>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">2. Protection of Minor Students</h2>
            <p className="mb-3">
              A large portion of our students are minors (Classes VI-XII). We hold student safety and privacy to the highest standard:
            </p>
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                <span>We <strong>never</strong> sell or rent student contact lists or academic data to third-party telemarketers or advertisers.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                <span>Student rank or academic results are published <strong>only</strong> with explicit written parental consent on file.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                <span>All communication is restricted to academic updates, lecture links, test schedules, and delivery tracking.</span>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Data</h2>
            <p>
              Your information is strictly used to: (a) authenticate your account and stream enrolled lectures, (b) process book orders and dispatch physical packages via registered couriers, (c) provide WhatsApp academic doubt assistance, and (d) generate personal performance analytics.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">4. Security &amp; Storage</h2>
            <p>
              Your data is stored securely on cloud infrastructure with encrypted TLS connections in transit and encrypted databases at rest. Access to administrative controls is restricted to authorized institute personnel.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">5. Contact Data Protection Desk</h2>
            <p className="mb-4">
              To request data correction, account deletion, or revoke result consent, contact our support desk:
            </p>
            <div className="flex flex-col sm:flex-row gap-4 text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-400" />
                <a href="mailto:adepteduverse@gmail.com" className="text-amber-400 hover:underline">adepteduverse@gmail.com</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400" />
                <a href="https://wa.me/919382557693" target="_blank" rel="noopener noreferrer" className="hover:underline">+91 93825 57693</a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
