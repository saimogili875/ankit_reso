'use client';

import React, { useState, useEffect } from 'react';
import { HeroCarousel } from '@/components/home/hero-carousel';
import { TodayScheduleWidget } from '@/components/home/today-schedule-widget';
import { QuickAccess } from '@/components/home/quick-access';
import { JEESubjects } from '@/components/home/jee-subjects';
import { ContinueLearning } from '@/components/home/continue-learning';
import { LandingPage } from '@/components/landing/landing-page';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Detect whether an authenticated session cookie is present
    const cookies = document.cookie.split(';');
    const hasSession = cookies.some((c) => {
      const trimmed = c.trim();
      return (
        trimmed.startsWith('auth_session=') ||
        trimmed.startsWith('sessionid=')
      );
    });
    setIsAuthenticated(hasSession);
  }, []);

  // When unauthenticated, display the full Adept Eduverse Premier Landing Page
  if (isAuthenticated === false) {
    return <LandingPage />;
  }

  // When authenticated, render the personalized student learning dashboard
  if (isAuthenticated === true) {
    return (
      <div className="space-y-10 pb-6">
        {/* 1. HERO PROMOTIONAL CAROUSEL (4 Slides, 5s Auto-Loop, Dynamic Prices, Visuals) */}
        <section>
          <HeroCarousel />
        </section>

        {/* 2. TODAY'S SCHEDULE */}
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

  // Pre-hydration placeholder: default to landing page view for zero-flash public rendering
  return <LandingPage />;
}
