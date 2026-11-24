import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Truck, ArrowLeft, Mail, Phone, Clock, MapPin, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy | Adept Eduverse',
  description: 'Shipping timelines, dispatch process, and delivery coverage for Adept Eduverse printed study books and materials across India.',
};

export default function ShippingPage() {
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
            <Truck className="w-3.5 h-3.5" />
            Pan-India Delivery
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">Shipping &amp; Delivery Policy</h1>
          <p className="text-sm text-slate-400">Doorstep delivery information for physical textbooks and study question banks</p>
        </div>

        <div className="space-y-8 text-sm md:text-base leading-relaxed text-slate-300">
          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              1. Dispatch &amp; Delivery Timelines
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">Dispatch Window</span>
                <p className="text-white font-medium text-lg">Within 24 to 48 Hours</p>
                <p className="text-xs text-slate-400 mt-1">Orders placed on working days are packed with protective bubble wrapping and dispatched promptly.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">Estimated Delivery</span>
                <p className="text-white font-medium text-lg">3 to 7 Working Days</p>
                <p className="text-xs text-slate-400 mt-1">Metro cities typically arrive in 3-4 days; regional and remote pincodes arrive within 5-7 days.</p>
              </div>
            </div>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              2. Delivery Coverage &amp; Courier Partners
            </h2>
            <p className="mb-3">
              We ship to all serviceable postal pincodes across India via trusted logistics partners including India Post Speed Post, Blue Dart, Delhivery, and DTDC.
            </p>
            <p>
              Once your shipment is handed over to the courier partner, an automated tracking update with tracking number and tracking URL is shared to your registered mobile phone and email.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              3. Packaging &amp; Damaged Consignments
            </h2>
            <p className="mb-3">
              Every book is packed in moisture-resistant bubble mailers with reinforced spine protectors to prevent bent corners during transit.
            </p>
            <p>
              If your package appears tampered with or arrives damaged, please take a clear photograph before opening and reach out to our WhatsApp support desk at <strong>+91 93825 57693</strong>. We will arrange a free immediate replacement.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">4. Shipping Charges</h2>
            <p>
              Standard courier delivery charges are included transparently at book checkout or offered with free shipping promotions during active academic enrollment drives.
            </p>
          </section>

          <section className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-xl font-bold text-white mb-3">5. Delivery Support Desk</h2>
            <p className="mb-4">
              Need to modify a shipping address or track a dispatched consignment?
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
