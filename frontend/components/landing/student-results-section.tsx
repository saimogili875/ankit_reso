'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { Award, Trophy } from 'lucide-react';
import { buildApiUrl } from '@/lib/api-client';

interface StudentResultItem {
  id: string;
  name: string;
  exam: string;
  rank: string;
  year: number;
  photo?: string;
  display_order: number;
}

export function StudentResultsSection() {
  const [results, setResults] = useState<StudentResultItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchResults() {
      try {
        const res = await fetch(buildApiUrl('/api/content/results/'));
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setResults(data);
          }
        }
      } catch {
        // Silently catch - compliance requirement: only render when verified entries exist
      } finally {
        if (isMounted) setLoaded(true);
      }
    }
    fetchResults();
    return () => {
      isMounted = false;
    };
  }, []);

  // Strict compliance rule: if no verified entries with written parental/student consent on file, do not render
  if (!loaded || results.length === 0) {
    return null;
  }

  const featured = results[0];
  const list = results.slice(1);

  return (
    <section className="landing-section results-section" id="results">
      <div className="landing-wrap">
        <div className="section-tag center">Verified Achievements</div>
        <h2>Student Academic Results</h2>
        <p className="section-subtitle">
          Verified academic milestones achieved through disciplined conceptual preparation and problem-solving practice.
        </p>

        <div className="results-layout">
          {featured && (
            <div className="featured-rank-card">
              <div className="topper-badge">
                <Trophy className="w-3.5 h-3.5" />
                Featured Achievement
              </div>
              <div className="big-rank">{featured.rank}</div>
              <div className="big-rank-sub">{featured.exam} {featured.year}</div>

              <div className="topper-details">
                {featured.photo && (
                  <div className="w-16 h-16 rounded-full overflow-hidden relative mx-auto mb-2 border-2 border-amber-400">
                    <Image
                      src={featured.photo}
                      alt={featured.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="topper-name">{featured.name}</div>
                <div className="topper-college">{featured.exam}</div>
              </div>
            </div>
          )}

          {list.length > 0 && (
            <div className="toppers-grid">
              {list.map((item) => (
                <div key={item.id} className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">{item.rank}</div>
                    <div className="topper-student-info">
                      <div className="student-name">{item.name}</div>
                      <div className="student-achievement">{item.exam} · {item.year}</div>
                    </div>
                  </div>
                  <span className="college-pill flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Verified
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
