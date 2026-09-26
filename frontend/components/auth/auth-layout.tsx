import React from 'react';
import { ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, isAdmin = false }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center relative overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* Background Decorative Lighting Gradient */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* LEFT DESKTOP BRAND PANEL (Hidden on mobile, visible on lg screens 1024px+) */}
          <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center space-y-8 pr-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/60 border border-blue-800/60 text-blue-400 text-xs font-semibold w-max">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ANKIT JEE Platform 2025</span>
            </div>

            <div className="space-y-3 max-w-xl">
              <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight">
                {isAdmin ? (
                  <>
                    Management Portal & <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                      Content Command Center
                    </span>
                  </>
                ) : (
                  <>
                    Master JEE Main & Advanced <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                      With Structured Learning
                    </span>
                  </>
                )}
              </h1>
              <p className="text-base text-slate-400 leading-relaxed">
                {isAdmin
                  ? 'Access administrative tools to publish video lectures, structure exam question banks, and monitor platform analytics.'
                  : 'Access video lectures, solve chapter-wise PYQs, attempt CBT mock tests, and review detailed accuracy analytics.'}
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-2 gap-4 max-w-lg pt-2">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">
                  {isAdmin ? 'CMS Publishing' : 'Dual Video Streams'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isAdmin ? 'Manage YouTube & R2 cloud videos' : 'YouTube + R2 Cloud HD Video lectures'}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200">
                  {isAdmin ? 'Secure Controls' : 'PYQ Bank'}
                </h4>
                <p className="text-xs text-slate-400">
                  {isAdmin ? 'Role-based access & audit logs' : '2019-2024 JEE Main & Advanced PYQs'}
                </p>
              </div>
            </div>

            {/* Testimonial / Target Pill */}
            <div className="flex items-center gap-3 text-xs text-slate-400 border-t border-slate-800/80 pt-6 max-w-lg">
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] border border-slate-900">P</div>
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] border border-slate-900">C</div>
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-[10px] border border-slate-900">M</div>
              </div>
              <span>Physics, Chemistry & Mathematics syllabus coverage</span>
            </div>
          </div>

          {/* RIGHT AUTH CARD CONTAINER (Responsive 100% width on mobile 360-412px, centered col-span-5/6 on desktop) */}
          <div className="col-span-1 lg:col-span-6 xl:col-span-5 flex justify-center w-full">
            {children}
          </div>

        </div>
      </div>

      {/* Responsive Footer */}
      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-900">
        © 2025 ANKIT JEE Learning Platform. All rights reserved.
      </footer>
    </div>
  );
};
