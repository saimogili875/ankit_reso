'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Student Profile & Settings</h1>
        <p className="text-sm text-slate-400">Account management and target examination configuration</p>
      </div>

      <Card className="space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold border-2 border-blue-400 shadow-lg shadow-blue-500/20">
            A
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">Ankit</h2>
              <Badge variant="blue">Student / Content Admin</Badge>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
              <Mail className="w-3.5 h-3.5" /> ankit@ankitjee.com
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Examination</label>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm font-medium text-slate-200">
              JEE Main & JEE Advanced 2025
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mobile Number</label>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-sm font-medium text-slate-200">
              +91 98765 43210
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
          <Button variant="outline" size="sm">Edit Profile</Button>
          <Button variant="primary" size="sm">Save Changes</Button>
        </div>
      </Card>
    </div>
  );
}
