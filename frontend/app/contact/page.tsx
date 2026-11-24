import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, Phone, MessageSquare, ArrowLeft, Clock } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | Adept Eduverse',
  description: 'Reach Ankit Kumar and the Adept Eduverse admissions and academic support desk via WhatsApp or email.',
};

export default function ContactPage() {
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
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold uppercase tracking-wider mb-4">
            <MessageSquare className="w-3.5 h-3.5" />
            Get in Touch
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Contact Admissions &amp; Support</h1>
          <p className="text-sm md:text-base text-slate-400">
            Have questions about batches for Class VI-XII, study materials, or book orders? Connect with Ankit Sir and our academic desk directly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* WhatsApp card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0F1B38] to-[#0A1128] border border-amber-500/30 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <Phone className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">WhatsApp Admissions Desk</h2>
              <p className="text-sm text-slate-300 mb-4">
                Quickest response for batch counseling, fee questions, curriculum details, or book orders.
              </p>
              <div className="space-y-1 text-sm text-slate-300">
                <p className="font-semibold text-emerald-400">+91 93825 57693</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Mon – Sat: 9:00 AM – 8:00 PM IST
                </p>
              </div>
            </div>
            <div className="mt-6">
              <a
                href="https://wa.me/919382557693?text=Hi%2C%20I%20have%20an%20inquiry%20regarding%20Adept%20Eduverse%20courses%20and%20books"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-lg shadow-emerald-950/40 text-sm"
              >
                Chat on WhatsApp Now
              </a>
            </div>
          </div>

          {/* Email card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0F1B38] to-[#0A1128] border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Mail className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Official Email Support</h2>
              <p className="text-sm text-slate-300 mb-4">
                For order receipts, academic inquiries, enterprise/school partnerships, or institutional feedback.
              </p>
              <div className="space-y-1 text-sm text-slate-300">
                <p className="font-semibold text-blue-400">adepteduverse@gmail.com</p>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Response within 24 hours
                </p>
              </div>
            </div>
            <div className="mt-6">
              <a
                href="mailto:adepteduverse@gmail.com"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors border border-slate-700 text-sm"
              >
                Send Email
              </a>
            </div>
          </div>
        </div>

        {/* Academic Leadership card */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden relative flex-shrink-0 border-2 border-amber-400/40">
            <Image
              src="/images/ankit/ankit-headshot.webp"
              alt="Ankit Kumar"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-white">Ankit Kumar</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">Founder &amp; Academic Head</span>
            </div>
            <p className="text-xs text-slate-400 mb-2">B.Tech Mechanical Engineering, IIT Kharagpur (2019)</p>
            <p className="text-sm text-slate-300">
              Personalized academic mentorship and direct problem-solving guidance. Adept Eduverse is dedicated to building rigorous mathematical intuition without unnecessary hype.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
