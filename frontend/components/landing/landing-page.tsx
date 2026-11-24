'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@/hooks/use-auth';
import { GraduationCap, LayoutDashboard, LogOut } from 'lucide-react';
import { BannerSlider } from '@/components/banners/BannerSlider';
import { BatchesSection } from './batches-section';
import { BooksSection } from './books-section';

interface FAQItemData {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItemData[] = [
  {
    question: 'What are the live class timings, and what if I miss a lecture?',
    answer:
      'Live classes for Class 11 and 12 run Monday through Saturday from 6:30 PM to 8:30 PM, while the Droppers Immersion batch meets Monday through Saturday from 9:00 AM to 12:00 PM. If you miss any session due to school exams or personal emergencies, high-definition video recordings are processed and uploaded to your student portal within 2 hours, accessible 24/7 for the entire academic year.',
  },
  {
    question: 'Is this curriculum sufficient for both JEE Mains and JEE Advanced?',
    answer:
      'Yes, absolutely. Ankit Sir’s pedagogy begins with first-principles conceptual derivations aligned with CBSE/NCERT theory, and progressively escalates into single-correct, multi-correct, matrix-match, and paragraph-style numerical problems taken from the toughest JEE Advanced archives and original Olympiad-level extensions.',
  },
  {
    question: 'How are student doubts cleared during and after class?',
    answer:
      'During live sessions, students interact directly via audio and chat with Ankit Sir. Outside class hours, students have access to a dedicated WhatsApp Academic Desk (+91 93825 57693) and weekly live doubt-clearing sessions to ensure no conceptual backlog accumulates.',
  },
  {
    question: 'What study materials and test series are included in the batches?',
    answer:
      'All enrolled students receive chapter-wise Daily Practice Problem (DPP) sheets with complete step-by-step solutions, formula sheets, revision mind maps, and admission to our Sunday All-India computer-based mock tests with percentile benchmarking and personalized error analysis.',
  },
  {
    question: 'How do I enroll and what payment options are supported?',
    answer:
      'You can click any "Get Fee Details on WhatsApp" button or reach out directly at +91 93825 57693. Our admissions counselors will verify batch availability, discuss your academic goals, and provide a secure payment link supporting UPI, all major credit/debit cards, and Net Banking.',
  },
];

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const { user, isLoaded, isSignedIn } = useUser();
  const { logout } = useAuth();

  const userRole = ((user?.publicMetadata?.role as string) || 'student').toLowerCase();
  const dashboardHref = userRole === 'admin' || userRole === 'teacher' ? '/admin' : '/';
  const displayName = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Account';

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="landing-body" id="top">
      {/* ====================================================================
           HEADER / NAVIGATION BAR
           ==================================================================== */}
      <header className="landing-header">
        <div className="landing-wrap">
          <div className="brand-wrapper">
            <Link href="#top" className="logo-badge" aria-label="Adept Eduverse Home">
              <Image
                src="/images/logo-transparent.png"
                alt="Adept Eduverse – A Skillful Learning"
                width={160}
                height={42}
                className="logo-img"
                priority
              />
            </Link>
            <div className="brand-text">
              <span className="brand-title">Adept Eduverse</span>
              <span className="brand-subtitle">A Skillful Learning</span>
            </div>
          </div>

          <nav className="landing-nav" aria-label="Main Navigation">
            <ul className="nav-links">
              <li>
                <a href="#batches">Batches</a>
              </li>
              <li>
                <a href="#books">Books</a>
              </li>
              <li>
                <a href="#teacher">Faculty</a>
              </li>
              <li>
                <a href="#results">Results</a>
              </li>
              <li>
                <a href="#pedagogy">Methodology</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>

            <div className="nav-actions">
              {isLoaded && isSignedIn && user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href={dashboardHref}
                    className="landing-btn btn-primary btn-sm flex items-center gap-1.5"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Link>

                  <div className="flex items-center gap-2 pl-2 border-l border-slate-700/80">
                    <span className="text-xs font-semibold text-slate-200 hidden xl:inline max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="login-link text-xs flex items-center gap-1 text-slate-400 hover:text-white"
                      title="Sign out"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Sign out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link href="/sign-in" className="login-link" title="Login" aria-label="Login">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Login
                  </Link>
                  <Link
                    href="/sign-up"
                    className="landing-btn btn-primary btn-sm"
                  >
                    Create account
                  </Link>
                </>
              )}
            </div>

            <button
              className="mobile-toggle"
              id="mobileToggle"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </nav>
        </div>

        {/* Mobile Dropdown Menu */}
        <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`} id="mobileMenu">
          <a href="#batches" className="mobile-link" onClick={closeMobileMenu}>
            JEE Batches
          </a>
          <a href="#books" className="mobile-link" onClick={closeMobileMenu}>
            Books &amp; Publications
          </a>
          <a href="#teacher" className="mobile-link" onClick={closeMobileMenu}>
            IIT Faculty
          </a>
          <a href="#results" className="mobile-link" onClick={closeMobileMenu}>
            Rank Results (AIR 125)
          </a>
          <a href="#pedagogy" className="mobile-link" onClick={closeMobileMenu}>
            How We Teach
          </a>
          <a href="#faq" className="mobile-link" onClick={closeMobileMenu}>
            Frequently Asked Questions
          </a>

          {isLoaded && isSignedIn && user ? (
            <div className="p-3 my-2 rounded-xl bg-slate-900 border border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{displayName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold uppercase">{userRole}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                <Link href={dashboardHref} className="text-xs text-indigo-400 font-semibold" onClick={closeMobileMenu}>
                  Go to Dashboard →
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-xs text-rose-400 font-semibold ml-auto"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link href="/sign-in" className="mobile-link" onClick={closeMobileMenu}>
                Login
              </Link>
              <Link href="/sign-up" className="mobile-link" onClick={closeMobileMenu}>
                Create account
              </Link>
            </>
          )}
          <a
            href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20to%20know%20more%20about%20Adept%20Eduverse%20classes"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-btn btn-whatsapp"
            style={{ marginTop: 8 }}
          >
            WhatsApp Academic Desk
          </a>
          <a
            href="https://www.youtube.com/@adepteduverse"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-btn btn-primary"
          >
            Watch Free Classes
          </a>
        </div>
      </header>

      <main>
        {/* ====================================================================
             HERO SECTION
             ==================================================================== */}
        <section className="hero-section">
          <div className="landing-wrap hero-grid">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="pulse-dot"></span>
                IIT Kharagpur Pedagogy · Admissions Open 2025–26
              </div>

              <h1>
                Begin at the Sea.
                <br />
                <span className="gold-text">Rise to the IITs.</span>
              </h1>

              <p className="hero-subtitle">
                Elite live and recorded JEE Mains &amp; Advanced mathematics mentorship by{' '}
                <strong className="text-white font-semibold">Ankit Kumar, B.Tech IIT Kharagpur</strong>.
                Uncompromising conceptual depth engineered for Class 11, Class 12, and Dropper aspirants.
              </p>

              <div className="hero-actions">
                <a
                  className="landing-btn btn-primary"
                  href="https://www.youtube.com/@adepteduverse"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Watch a Free Class
                </a>
                <a className="landing-btn btn-glass" href="#batches">
                  Explore Batches &amp; Fees
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div className="hero-trust">
                <div className="trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                  <span>
                    <strong>96%</strong> Positive Rating
                  </span>
                </div>
                <div className="trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  </svg>
                  <span>
                    <strong>AIR 125</strong> Best JEE Adv Rank
                  </span>
                </div>
                <div className="trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z" />
                  </svg>
                  <span>
                    <strong>2,700+</strong> YouTube Video Lectures
                  </span>
                </div>
              </div>
            </div>

            {/* Right Hero Promotional Banner Slider */}
            <div className="hero-banner-container w-full">
              <BannerSlider placement="home" />
            </div>
          </div>

          {/* Organic Sea Wave SVG Divider */}
          <div className="sea-divider" aria-hidden="true">
            <svg viewBox="0 0 1440 60" preserveAspectRatio="none">
              <path
                fill="#071224"
                d="M0,32L60,37.3C120,43,240,53,360,48C480,43,600,21,720,16C840,11,960,21,1080,26.7C1200,32,1320,32,1380,32L1440,32L1440,60L1380,60C1320,60,1200,60,1080,60C960,60,840,60,720,60C600,60,480,60,360,60C240,60,120,60,60,60L0,60Z"
              ></path>
            </svg>
          </div>
        </section>

        {/* ====================================================================
             STATS & SOCIAL PROOF STRIP
             ==================================================================== */}
        <div className="proof-section">
          <div className="landing-wrap">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number">96%</div>
                <div className="stat-label">Positive Student &amp; Parent Feedback (2025–26)</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">2,700+</div>
                <div className="stat-label">Free In-Depth Video Lectures on YouTube</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">AIR 125</div>
                <div className="stat-label">Top All India Rank in JEE Advanced 2025</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">IIT Kharagpur</div>
                <div className="stat-label">B.Tech Engineering Alma Mater of Your Teacher</div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
             BATCHES (COURSES) - DYNAMIC PRICING SYSTEM
             ==================================================================== */}
        <BatchesSection />

        {/* ====================================================================
             OFFICIAL BOOKS & PUBLICATIONS SECTION
             ==================================================================== */}
        <BooksSection />

        {/* ====================================================================
             TEACHER & PEDAGOGY SHOWCASE (ANKIT SIR)
             ==================================================================== */}
        <section className="landing-section teacher-section" id="teacher">
          <div className="landing-wrap teacher-grid">
            <div className="teacher-portrait-box" id="faculty-profile-card">
              <div className="portrait-halo">
                <Image
                  src="/images/ankit-sir-headshot.jpg"
                  alt="Ankit Kumar, B.Tech IIT Kharagpur – Founder Adept Eduverse"
                  width={320}
                  height={320}
                  className="teacher-pic"
                  priority
                />
              </div>

              <div className="iit-seal-badge">
                <GraduationCap className="seal-icon" width={22} height={22} />
                <div className="seal-text-group">
                  <span className="seal-title">IIT Kharagpur</span>
                  <span className="seal-sub">B.Tech Engineering Alumnus</span>
                </div>
              </div>

              <div className="teacher-caption">
                <h3 className="teacher-name">Ankit Kumar</h3>
                <div className="teacher-deg">B.Tech, IIT Kharagpur | JEE Math Specialist</div>
              </div>
            </div>

            <div className="teacher-content" id="pedagogy">
              <div className="section-tag">Faculty &amp; Pedagogy</div>
              <h2>
                Master Mathematics with an <span className="gold-text">IIT Kharagpur Mindset</span>
              </h2>

              <p className="teacher-bio">
                Mathematics for JEE Advanced is not about rote memorization or applying mechanical formulas. It is
                an art of recognizing hidden symmetry, decomposing multi-layered problems into elegant first principles,
                and executing calculations with calm precision under timed pressure.
              </p>
              <p className="teacher-bio" style={{ marginTop: -10 }}>
                For over a decade, Ankit Sir has personally mentored thousands of high-school aspirants, demystifying
                Calculus, Coordinate Geometry, and Algebra into structured visual frameworks that turn math from a
                fearful obstacle into a student&apos;s highest scoring strength.
              </p>

              <div className="pillars-grid">
                <div className="pillar-item">
                  <div className="pillar-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    First-Principles Derivations
                  </div>
                  <div className="pillar-desc">
                    Every formula is derived from geometric and algebraic intuition so you can reconstruct proofs even
                    under exam pressure.
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Advanced Problem Archetypes
                  </div>
                  <div className="pillar-desc">
                    Classification of questions into structural archetypes, enabling students to identify the shortest
                    solving trajectory in 45 seconds.
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Pattern Recognition &amp; Speed
                  </div>
                  <div className="pillar-desc">
                    Specialized shortcut strategies, boundary testing, and elimination methods to save precious time on
                    JEE Mains &amp; Advanced.
                  </div>
                </div>

                <div className="pillar-item">
                  <div className="pillar-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Continuous Mentor Guidance
                  </div>
                  <div className="pillar-desc">
                    Direct communication with Ankit Sir to clear emotional hurdles, exam anxiety, and mathematical
                    doubts throughout the year.
                  </div>
                </div>
              </div>

              <div className="teacher-actions">
                <a
                  className="landing-btn btn-whatsapp"
                  href="https://wa.me/919382557693?text=Hi%20Ankit%20Sir%2C%20I%20am%20interested%20in%20joining%20your%20JEE%20Mathematics%20batch"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connect on WhatsApp
                </a>
                <a
                  className="landing-btn btn-glass"
                  href="https://www.youtube.com/@adepteduverse"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch Lecture on YouTube
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
             THREE STEPS TO JOIN (ROADMAP)
             ==================================================================== */}
        <section className="landing-section steps-section">
          <div className="landing-wrap">
            <div className="section-tag center">Seamless Onboarding</div>
            <h2>Three Steps to Your IIT Journey</h2>
            <p className="section-subtitle">
              We make enrollment transparent, supportive, and focused entirely on the student&apos;s academic alignment.
            </p>

            <div className="steps-grid">
              <div className="step-card">
                <span className="step-number">01</span>
                <h3>Experience the Pedagogy</h3>
                <p>
                  Watch our comprehensive video series on YouTube covering complex topics like Calculus and Coordinate
                  Geometry. Observe how intuition replaces memory.
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">02</span>
                <h3>Consult the Academic Desk</h3>
                <p>
                  Reach out via WhatsApp (+91 93825 57693). Discuss your current grade, syllabus coverage, and target JEE
                  year to select the optimal live or recorded batch.
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">03</span>
                <h3>Step into the Arena</h3>
                <p>
                  Receive your verified credentials to access the Adept Eduverse live classroom, digital notes archive,
                  daily assignment vault, and Sunday mock examinations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
             RESULTS & WALL OF FAME
             ==================================================================== */}
        <section className="landing-section results-section" id="results">
          <div className="landing-wrap">
            <div className="section-tag center">Proven Track Record</div>
            <h2>Results Engineered by Dedication</h2>
            <p className="section-subtitle">
              Our students consistently breach the elite rank thresholds of JEE Advanced and gain admission into India’s
              foremost engineering institutions.
            </p>

            <div className="results-layout">
              {/* Featured Rank Card */}
              <div className="featured-rank-card">
                <div className="topper-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Top JEE Advanced Performer
                </div>
                <div className="big-rank">AIR 125</div>
                <div className="big-rank-sub">JEE Advanced 2025</div>

                <div className="topper-details">
                  <div className="topper-name">Subhashish Panda</div>
                  <div className="topper-college">IIT Bombay</div>
                  <div className="topper-branch">Computer Science &amp; Engineering</div>
                </div>
              </div>

              {/* Toppers List Grid */}
              <div className="toppers-grid">
                <div className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">AIR 482</div>
                    <div className="topper-student-info">
                      <div className="student-name">Pritam Sen</div>
                      <div className="student-achievement">JEE Advanced · 99.6%ile Math</div>
                    </div>
                  </div>
                  <span className="college-pill">IIT Delhi (EE)</span>
                </div>

                <div className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">AIR 815</div>
                    <div className="topper-student-info">
                      <div className="student-name">Ananya Sharma</div>
                      <div className="student-achievement">JEE Advanced · Math Score: 92/120</div>
                    </div>
                  </div>
                  <span className="college-pill">IIT Kanpur (M&amp;SC)</span>
                </div>

                <div className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">AIR 1140</div>
                    <div className="topper-student-info">
                      <div className="student-name">Aryan Verma</div>
                      <div className="student-achievement">JEE Advanced · 99.4%ile Overall</div>
                    </div>
                  </div>
                  <span className="college-pill">IIT Kharagpur (ME)</span>
                </div>

                <div className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">AIR 1680</div>
                    <div className="topper-student-info">
                      <div className="student-name">Rishabh Ghosh</div>
                      <div className="student-achievement">JEE Advanced · Top 0.5% State</div>
                    </div>
                  </div>
                  <span className="college-pill">IIT Roorkee (DS&amp;AI)</span>
                </div>

                <div className="topper-row">
                  <div className="topper-rank-tag">
                    <div className="rank-badge-box">99.85 %ile</div>
                    <div className="topper-student-info">
                      <div className="student-name">Devansh Gupta</div>
                      <div className="student-achievement">JEE Main 2025 · 100/100 Mathematics</div>
                    </div>
                  </div>
                  <span className="college-pill">NIT Trichy (CSE)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
             FAQ ACCORDION
             ==================================================================== */}
        <section className="landing-section faq-section" id="faq">
          <div className="landing-wrap">
            <div className="section-tag center">Got Questions?</div>
            <h2>Frequently Asked Questions</h2>
            <p className="section-subtitle">
              Clear, transparent information about class structure, fees, recordings, and enrollment.
            </p>

            <div className="faq-container">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div key={index} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
                    <button
                      className="faq-header"
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleFaq(index)}
                    >
                      <span>{item.question}</span>
                      <span className="faq-icon" aria-hidden="true">
                        +
                      </span>
                    </button>
                    {isOpen && <div className="faq-content">{item.answer}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ====================================================================
             FINAL HIGH-IMPACT CALL TO ACTION
             ==================================================================== */}
        <section className="final-cta">
          <div className="landing-wrap">
            <h2>
              Your IIT Dream Begins with a <span className="gold-text">Single Decision.</span>
            </h2>
            <p>
              Join Ankit Sir&apos;s mentorship today and experience mathematics transformed from a daunting subject into your
              highest scoring weapon on exam day.
            </p>

            <div className="final-actions">
              <a
                className="landing-btn btn-whatsapp"
                href="https://wa.me/919382557693?text=Hi%20Ankit%20Sir%2C%20I%20am%20ready%20to%20enroll%20in%20Adept%20Eduverse"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enroll via WhatsApp (+91 93825 57693)
              </a>
              <Link href="/sign-in" className="landing-btn btn-glass">
                Student Portal Login
              </Link>
              <a
                className="landing-btn btn-primary"
                href="https://www.youtube.com/@adepteduverse"
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch Free Demo on YouTube
              </a>
            </div>

            <div className="final-support-note">
              <span></span>
              Admissions currently open for 2025–26 academic batches. Batch sizes strictly capped.
            </div>
          </div>
        </section>
      </main>

      {/* ====================================================================
           FOOTER
           ==================================================================== */}
      <footer className="landing-footer">
        <div className="landing-wrap">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="brand-wrapper">
                <div className="logo-badge">
                  <Image
                    src="/images/logo-transparent.png"
                    alt="Adept Eduverse"
                    width={150}
                    height={38}
                    className="logo-img"
                  />
                </div>
                <div className="brand-text">
                  <span className="brand-title">Adept Eduverse</span>
                  <span className="brand-subtitle">A Skillful Learning</span>
                </div>
              </div>
              <p className="footer-desc">
                Adept Eduverse is an elite mathematics academy founded by Ankit Kumar (B.Tech, IIT Kharagpur).
                Dedicated to cultivating rigorous conceptual depth and problem-solving mastery for JEE Mains &amp;
                Advanced aspirants nationwide.
              </p>
              <div className="social-links">
                <a
                  href="https://www.youtube.com/@adepteduverse"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn"
                  aria-label="YouTube Channel"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                  </svg>
                </a>
                <a
                  href="https://wa.me/919382557693"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn"
                  aria-label="WhatsApp Desk"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="footer-col">
              <h4>Programs</h4>
              <ul className="footer-links">
                <li>
                  <a href="#batches">Class VI-X Foundation Batches</a>
                </li>
                <li>
                  <a href="#batches">Class 11 &amp; 12 JEE + Board</a>
                </li>
                <li>
                  <a href="#batches">Dropper Immersion Batch</a>
                </li>
                <li>
                  <Link href="/books">Official Book Store</Link>
                </li>
                <li>
                  <a href="#faq">Fee &amp; Payment Details</a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Direct Access</h4>
              <ul className="footer-links">
                <li>
                  <Link href="/books">Official Books &amp; Publications</Link>
                </li>
                <li>
                  <Link href="/sign-in">Student Portal Login</Link>
                </li>
                <li>
                  <Link href="/sign-up">Student Registration</Link>
                </li>
                <li>
                  <a href="https://wa.me/919382557693" target="_blank" rel="noopener noreferrer">
                    Admissions Desk (WhatsApp)
                  </a>
                </li>
                <li>
                  <a href="https://www.youtube.com/@adepteduverse" target="_blank" rel="noopener noreferrer">
                    Official YouTube Channel
                  </a>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Legal &amp; Policies</h4>
              <ul className="footer-links">
                <li>
                  <Link href="/terms">Terms &amp; Conditions</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/refund">Refund &amp; Cancellation</Link>
                </li>
                <li>
                  <Link href="/shipping">Shipping &amp; Delivery</Link>
                </li>
                <li>
                  <Link href="/contact">Contact &amp; Support</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} Adept Eduverse. All rights reserved. Founded by Ankit Kumar (B.Tech, IIT Kharagpur).</p>
            <div className="trust-badges">
              <span>✦ IIT Kharagpur Founder</span>
              <span>✦ Complete Syllabus Coverage</span>
              <span>✦ Dedicated WhatsApp Doubt Support</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ====================================================================
           MOBILE FLOATING CONCIERGE DOCK
           ==================================================================== */}
      <div className="mobile-dock">
        <a
          href="https://wa.me/919382557693?text=Hi%2C%20I%20want%20to%20know%20more%20about%20Adept%20Eduverse%20JEE%20classes"
          target="_blank"
          rel="noopener noreferrer"
          className="landing-btn btn-whatsapp"
        >
          WhatsApp Desk
        </a>
        <Link
          href={isLoaded && isSignedIn && user ? dashboardHref : "/sign-in"}
          className="landing-btn btn-primary"
        >
          {isLoaded && isSignedIn && user ? "Dashboard" : "Login"}
        </Link>
      </div>
    </div>
  );
};
