import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, ArrowLeft, Mail, Phone } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | Adept Eduverse',
  description: 'Terms of service and student enrollment agreement for Adept Eduverse courses, test series, and official publications.',
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            Legal Agreement
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Terms &amp; Conditions</h1>
          <p className="text-sm text-slate-400">Last updated: November 2024 • Effective upon enrollment or purchase</p>
          <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90">
            Note: This terms agreement governs online courses, digital study materials, printed book purchases, and test series provided by Adept Eduverse (founded by Ankit Kumar, B.Tech, IIT Kharagpur).
          </div>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">1. Introduction &amp; Acceptance</h2>
            <p>
              Welcome to Adept Eduverse (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;, or the &quot;Platform&quot;). By accessing our website (adepteduverse.com), enrolling in our courses, buying study materials or printed books, or registering on our learning portal, you agree to comply with and be bound by these Terms and Conditions.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">2. User Accounts &amp; Minor Students</h2>
            <p className="mb-3">
              Students preparing for Class VI-XII and competitive examinations like JEE Main &amp; Advanced may access the platform under parental or guardian supervision. Account credentials must be kept confidential and cannot be shared across multiple devices or individuals.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts found sharing login credentials, redistributing proprietary videos, or attempting unauthorized platform access.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">3. Course Content &amp; Intellectual Property</h2>
            <p className="mb-3">
              All lectures, question banks, handwritten notes, video explanations, problem sets, and printed textbooks are the copyrighted intellectual property of Adept Eduverse and Ankit Kumar.
            </p>
            <p>
              You receive a personal, non-exclusive, non-transferable license to view digital content. Reproduction, recording, distribution, commercial resale, or public streaming of any Adept Eduverse material is strictly prohibited and subject to legal prosecution under Indian copyright laws.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">4. Payments, Pricing &amp; Taxes</h2>
            <p className="mb-3">
              Course fees and book prices are displayed in Indian Rupees (₹ INR). Goods and Services Tax (GST) is charged where legally applicable (18% on educational publications and digital access). Payments are processed through secure, RBI-compliant payment gateways (Razorpay).
            </p>
            <p>
              Prices are subject to revision without prior notice, but any active enrollment or finalized order will remain honored at the agreed price.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">5. Doubt Support &amp; WhatsApp Concierge</h2>
            <p>
              Academic doubt assistance is provided via designated WhatsApp desks (+91 93825 57693) and platform features during academic working hours. Doubt support is intended for conceptual clarification and problem-solving guidance directly related to enrolled syllabus.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">6. Contact Information</h2>
            <p className="mb-4">
              For any legal or contractual inquiries, please contact our administrative desk:
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
