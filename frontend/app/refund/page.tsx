import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { RotateCcw, ArrowLeft, Mail, Phone, CheckCircle2 } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy | Adept Eduverse',
  description: 'Fair and transparent refund and cancellation guidelines for Adept Eduverse online courses, test series, and printed books.',
};

export default function RefundPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold uppercase tracking-wider mb-4">
            <RotateCcw className="w-3.5 h-3.5" />
            Transparent Guarantee
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Refund &amp; Cancellation Policy</h1>
          <p className="text-sm text-slate-400">Clear guidelines for online courses, digital study materials, and physical books</p>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">1. Online Courses &amp; Batch Enrollments</h2>
            <div className="space-y-3">
              <p>
                We strive to ensure every student and parent receives exceptional mathematical training. Because our complete digital curriculum, past test solutions, and recorded lecture archives are unlocked immediately upon enrollment:
              </p>
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>7-Day Course Cancellation Window:</strong> If you face genuine technical issues accessing course materials or find the course unsuitable within 7 days of purchase, you may request a review for batch transfer or prorated refund.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                  <span><strong>Batch Transfer:</strong> Students transitioning between classes (e.g., Class X to Class XI) can transfer batch credit seamlessly without any penalty.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">2. Physical Books &amp; Study Material Delivery</h2>
            <div className="space-y-3">
              <p>
                For printed books (e.g., Mathematics Complete Syllabus, Previous Years Questions, Mental Ability):
              </p>
              <ul className="space-y-2 list-disc list-inside">
                <li><strong>Cancellation Before Dispatch:</strong> You can cancel your hardcopy book order within 24 hours of placement or anytime before shipment for a 100% full refund.</li>
                <li><strong>Damaged or Defective Copies:</strong> If a book arrives with printing defects, missing pages, or transit damage, report it within 5 days of delivery with photos to our WhatsApp desk. We dispatch a brand new replacement free of cost immediately.</li>
                <li><strong>Return Shipping:</strong> In case of replacement for transit defects, reverse courier pickup is arranged at no extra charge to the buyer.</li>
              </ul>
            </div>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">3. Digital PDF Downloads</h2>
            <p>
              Instant digital PDF downloads (Single Book Digital Edition) are granted with lifetime access tokens immediately upon payment. Because digital assets cannot be revoked once downloaded, standalone PDF purchases are non-refundable once the download link has been utilized.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">4. Refund Processing Timeline</h2>
            <p className="mb-3">
              Approved refunds are credited back to the original payment source (bank account, UPI, debit/credit card) via Razorpay within <strong>5 to 7 business days</strong> depending on your issuing bank.
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
