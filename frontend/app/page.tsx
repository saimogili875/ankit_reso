'use client';

import React from 'react';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { TodayScheduleWidget } from '@/components/home/today-schedule-widget';
import { QuickAccess } from '@/components/home/quick-access';
import { JEESubjects } from '@/components/home/jee-subjects';
import { ContinueLearning } from '@/components/home/continue-learning';

export default function HomePage() {
  return (
    <div className="space-y-10 pb-6">
      {/* 1. HERO PROMOTIONAL CAROUSEL (4 Slides, 5s Auto-Loop, Dynamic Prices, Visuals) */}
      <section>
        <HeroCarousel />
      </section>

      {/* 2. TODAY'S SCHEDULE & LIVE NOW BANNER */}
      <section>
        <TodayScheduleWidget />
      </section>

      {/* 3. QUICK ACCESS (Learn, Practice, Tests, Analysis, Doubt Solver) */}
      <section>
        <QuickAccess />
      </section>

      {/* 4. YOUR JEE SUBJECTS (Physics, Chemistry, Mathematics) */}
      <section>
        <JEESubjects />
      </section>

      {/* 5. CONTINUE LEARNING (Pick up where you left off) */}
      <section>
        <ContinueLearning />
      </section>
    </div>
  );
}
