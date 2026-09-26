'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/stats-card';
import {
  BookOpen,
  FileCheck2,
  TrendingUp,
  Award,
  Atom,
  FlaskConical,
  Calculator,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/40 to-slate-900 border border-blue-500/20 p-6 lg:p-8">
        <div className="relative z-10 max-w-2xl space-y-3">
          <Badge variant="blue" className="bg-blue-500/20 border-blue-400/30 text-blue-300">
            ANKIT JEE 2025 Architecture Edition
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Welcome back to <span className="text-blue-400">ANKIT JEE</span>
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Your structured learning hub for JEE Main & Advanced. Access lectures, solve previous-year questions, and track your accuracy.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" className="gap-2">
              <span>Start Learning</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm">
              View Latest Tests
            </Button>
          </div>
        </div>
      </div>

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Lectures Watched"
          value="24"
          subtitle="Physics & Chemistry"
          icon={BookOpen}
          iconColor="text-blue-400 bg-blue-500/10"
          badgeText="+4 lectures this week"
        />
        <StatsCard
          title="Questions Solved"
          value="342"
          subtitle="JEE Main & Advanced PYQs"
          icon={FileCheck2}
          iconColor="text-emerald-400 bg-emerald-500/10"
          badgeText="78% accuracy rate"
        />
        <StatsCard
          title="Tests Completed"
          value="8"
          subtitle="Full & Chapter Mocks"
          icon={TrendingUp}
          iconColor="text-purple-400 bg-purple-500/10"
          badgeText="Avg. Score: 210/300"
        />
        <StatsCard
          title="Overall Percentile"
          value="98.5"
          subtitle="Predicted JEE Rank"
          icon={Award}
          iconColor="text-amber-400 bg-amber-500/10"
          badgeText="Top 1.5% Candidates"
        />
      </div>

      {/* Main Grid: Subjects & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subject Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Core JEE Subjects</span>
              <Sparkles className="w-4 h-4 text-blue-400" />
            </h2>
            <span className="text-xs text-slate-400">Class 11 & Class 12 Syllabus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Physics */}
            <Card hoverEffect className="space-y-3 bg-gradient-to-b from-slate-900 to-slate-900/90">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
                <Atom className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Physics</h3>
                <p className="text-xs text-slate-400">Mechanics, Electrodynamics, Modern Physics</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Completion</span>
                <span className="font-semibold text-blue-400">65%</span>
              </div>
            </Card>

            {/* Chemistry */}
            <Card hoverEffect className="space-y-3 bg-gradient-to-b from-slate-900 to-slate-900/90">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Chemistry</h3>
                <p className="text-xs text-slate-400">Physical, Organic & Inorganic Chemistry</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Completion</span>
                <span className="font-semibold text-emerald-400">72%</span>
              </div>
            </Card>

            {/* Mathematics */}
            <Card hoverEffect className="space-y-3 bg-gradient-to-b from-slate-900 to-slate-900/90">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Mathematics</h3>
                <p className="text-xs text-slate-400">Calculus, Algebra, Coordinate Geometry</p>
              </div>
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Completion</span>
                <span className="font-semibold text-purple-400">58%</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Mock Test & Analysis */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-100">Recent Test Performance</h2>
          <Card className="space-y-4 bg-slate-900">
            <div className="flex items-center justify-between">
              <Badge variant="purple">JEE Main Mock #4</Badge>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Yesterday
              </span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-100">224 / 300</div>
              <p className="text-xs text-slate-400 mt-0.5">Rank: #14 out of 1,280 students</p>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Physics:</span>
                <span className="font-semibold text-slate-200">78 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Chemistry:</span>
                <span className="font-semibold text-slate-200">84 / 100</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mathematics:</span>
                <span className="font-semibold text-slate-200">62 / 100</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full text-xs">
              View Detailed Test Analysis
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
