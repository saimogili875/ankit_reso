'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, ShieldCheck } from 'lucide-react';

export default function MaterialsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Study Materials & Notes</h1>
        <p className="text-sm text-slate-400">PDF Formula sheets, Revision Handouts, and Practice Sheets stored securely on Cloudflare R2</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card hoverEffect className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="blue">Physics PDF</Badge>
            <span className="text-[10px] text-slate-500 font-mono">2.4 MB</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">Kinematics & Laws of Motion — Formula Sheet</h3>
            <p className="text-xs text-slate-400 mt-1">Quick revision notes with key equations & vector tricks</p>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> R2 Secure Storage
            </span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </div>
        </Card>

        <Card hoverEffect className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="emerald">Chemistry PDF</Badge>
            <span className="text-[10px] text-slate-500 font-mono">4.1 MB</span>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">Organic Chemistry Reaction Mechanisms Map</h3>
            <p className="text-xs text-slate-400 mt-1">Comprehensive reaction chart for JEE Advanced</p>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> R2 Secure Storage
            </span>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
