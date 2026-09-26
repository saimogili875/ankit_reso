'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, CheckCircle2 } from 'lucide-react';

export default function LearnPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">Learn & Video Lectures</h1>
          <p className="text-sm text-slate-400">Structured video courses for Physics, Chemistry, and Mathematics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="blue">JEE Main & Advanced</Badge>
          <Badge variant="slate">Class 11 & 12</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card hoverEffect className="space-y-4">
          <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-blue-600/20 transition-colors" />
            <PlayCircle className="w-12 h-12 text-blue-400 group-hover:scale-110 transition-transform relative z-10" />
            <span className="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
              45:20
            </span>
          </div>
          <div className="space-y-1">
            <Badge variant="purple" className="mb-1">Physics — Kinematics</Badge>
            <h3 className="font-bold text-base text-slate-100">Projectile Motion & Relative Velocity</h3>
            <p className="text-xs text-slate-400">Complete theory & solved JEE Advanced illustrations</p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Free Preview
            </span>
            <span>Cloud & YouTube Video</span>
          </div>
        </Card>

        <Card hoverEffect className="space-y-4">
          <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-600/10 group-hover:bg-emerald-600/20 transition-colors" />
            <PlayCircle className="w-12 h-12 text-emerald-400 group-hover:scale-110 transition-transform relative z-10" />
            <span className="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
              52:10
            </span>
          </div>
          <div className="space-y-1">
            <Badge variant="emerald" className="mb-1">Chemistry — Physical</Badge>
            <h3 className="font-bold text-base text-slate-100">Chemical Thermodynamics & Energetics</h3>
            <p className="text-xs text-slate-400">First Law, Enthalpy, Hess Law & Entropy</p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>Module 3 of 8</span>
            <span>R2 Cloud Stream</span>
          </div>
        </Card>

        <Card hoverEffect className="space-y-4">
          <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-purple-600/10 group-hover:bg-purple-600/20 transition-colors" />
            <PlayCircle className="w-12 h-12 text-purple-400 group-hover:scale-110 transition-transform relative z-10" />
            <span className="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
              60:00
            </span>
          </div>
          <div className="space-y-1">
            <Badge variant="amber" className="mb-1">Mathematics — Calculus</Badge>
            <h3 className="font-bold text-base text-slate-100">Definite Integrals & Reduction Formulas</h3>
            <p className="text-xs text-slate-400">Properties of Definite Integrals & King Property</p>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
            <span>Module 5 of 12</span>
            <span>R2 Cloud Stream</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
