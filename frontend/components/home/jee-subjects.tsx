'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Atom, FlaskConical, Calculator, ArrowRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface ApiSubject {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color_code?: string;
}

export const JEESubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient.get<ApiSubject[]>('/academics/subjects/')
      .then((data) => {
        if (!isMounted) return;
        setSubjects(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getSubjectIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phys')) return Atom;
    if (lower.includes('chem')) return FlaskConical;
    return Calculator;
  };

  const getSubjectColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phys')) {
      return {
        card: 'border-blue-500/30 bg-gradient-to-b from-slate-900 to-blue-950/20 text-blue-400',
        badge: 'blue' as const,
      };
    }
    if (lower.includes('chem')) {
      return {
        card: 'border-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/20 text-emerald-400',
        badge: 'emerald' as const,
      };
    }
    return {
      card: 'border-purple-500/30 bg-gradient-to-b from-slate-900 to-purple-950/20 text-purple-400',
      badge: 'purple' as const,
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Your JEE Subjects</h3>
          <p className="text-xs text-slate-400">Class 11 & Class 12 Syllabus Coverage</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-300">No subjects added yet</p>
          <p className="text-xs text-slate-500">Subjects will appear once added by faculty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subjects.map((subj) => {
            const Icon = getSubjectIcon(subj.name);
            const { card, badge } = getSubjectColor(subj.name);

            return (
              <div
                key={subj.id}
                className={`p-6 rounded-2xl border space-y-4 shadow-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 ${card}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant={badge}>Class 11 & 12</Badge>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-xl text-slate-100">{subj.name}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {subj.description || `Master JEE Main & Advanced core concepts in ${subj.name}.`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  <Link
                    href={`/learn?subject=${encodeURIComponent(subj.slug || subj.id)}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-bold text-slate-100 transition-colors"
                  >
                    <span>Start Learning</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
