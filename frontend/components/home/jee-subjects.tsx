import React from 'react';
import Link from 'next/link';
import { Atom, FlaskConical, Calculator, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SubjectItem {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  topics: string[];
  color: string;
  badgeVariant: 'blue' | 'emerald' | 'amber';
  href: string;
}

const subjects: SubjectItem[] = [
  {
    id: 'physics',
    name: 'Physics',
    icon: Atom,
    description: 'Master physical laws, vectors, kinematics, electromagnetism and modern physics concepts.',
    topics: ['Mechanics', 'Electrodynamics', 'Modern Physics'],
    color: 'border-blue-500/30 bg-gradient-to-b from-slate-900 to-blue-950/20 text-blue-400',
    badgeVariant: 'blue',
    href: '/learn?subject=physics',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    icon: FlaskConical,
    description: 'Understand reaction mechanisms, mole concept, chemical bonding and inorganic trends.',
    topics: ['Physical Chemistry', 'Organic Chemistry', 'Inorganic Chemistry'],
    color: 'border-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/20 text-emerald-400',
    badgeVariant: 'emerald',
    href: '/learn?subject=chemistry',
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: Calculator,
    description: 'Solve complex calculus integrals, matrix algebra, coordinate geometry and vector equations.',
    topics: ['Calculus', 'Algebra', 'Coordinate Geometry'],
    color: 'border-purple-500/30 bg-gradient-to-b from-slate-900 to-purple-950/20 text-purple-400',
    badgeVariant: 'amber',
    href: '/learn?subject=mathematics',
  },
];

export const JEESubjects: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-100">Your JEE Subjects</h3>
          <p className="text-xs text-slate-400">Class 11 & Class 12 Syllabus Coverage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {subjects.map((subj) => {
          const Icon = subj.icon;

          return (
            <div
              key={subj.id}
              className={`p-6 rounded-2xl border space-y-4 shadow-xl flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 ${subj.color}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge variant={subj.badgeVariant}>Class 11 & 12</Badge>
                </div>

                <div>
                  <h4 className="font-extrabold text-xl text-slate-100">{subj.name}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    {subj.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Core Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {subj.topics.map((topic, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-medium text-slate-300"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <Link
                  href={subj.href}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-bold text-slate-100 transition-colors"
                >
                  <span>Continue Learning</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
