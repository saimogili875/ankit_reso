'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export default function TestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">JEE Mock Tests & PYQs</h1>
        <p className="text-sm text-slate-400">Computer Based Test (CBT) environment styled for JEE Main & Advanced</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card hoverEffect className="space-y-4">
          <div className="flex justify-between items-start">
            <Badge variant="blue">JEE Main 2025</Badge>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 3 Hours
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Full Syllabus Mock Test #05</h3>
            <p className="text-xs text-slate-400 mt-1">75 Questions (Physics, Chemistry, Mathematics)</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-lg text-xs">
            <div>
              <div className="text-slate-400">Total Marks</div>
              <div className="font-bold text-slate-200">300</div>
            </div>
            <div>
              <div className="text-slate-400">Pattern</div>
              <div className="font-bold text-slate-200">CBT NTA</div>
            </div>
            <div>
              <div className="text-slate-400">Negative</div>
              <div className="font-bold text-rose-400">-1 Mark</div>
            </div>
          </div>
          <Button variant="primary" className="w-full">Start Test Attempt</Button>
        </Card>

        <Card hoverEffect className="space-y-4">
          <div className="flex justify-between items-start">
            <Badge variant="purple">JEE Advanced 2024</Badge>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 3 Hours
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Paper 1 Previous Year Question Test</h3>
            <p className="text-xs text-slate-400 mt-1">Single Choice, Multi Choice & Numerical Section</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-950 p-3 rounded-lg text-xs">
            <div>
              <div className="text-slate-400">Total Marks</div>
              <div className="font-bold text-slate-200">180</div>
            </div>
            <div>
              <div className="text-slate-400">Pattern</div>
              <div className="font-bold text-purple-400">Advanced</div>
            </div>
            <div>
              <div className="text-slate-400">Partial Marking</div>
              <div className="font-bold text-emerald-400">Yes</div>
            </div>
          </div>
          <Button variant="outline" className="w-full">Start PYQ Test</Button>
        </Card>
      </div>
    </div>
  );
}
