'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useAuth } from '@/hooks/use-auth';
import { GraduationCap, Star, LayoutDashboard, LogOut, BookOpen, ShieldCheck, MessageCircle, ArrowRight, Home, LogIn } from 'lucide-react';
import { BannerSlider } from '@/components/banners/BannerSlider';
import { CoursesSection } from './courses-section';
import { BooksSection } from './books-section';
import { StudentResultsSection } from './student-results-section';

interface FAQItemData {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItemData[] = [
  {
    question: 'How do courses work and how can I access study materials?',
    answer:
      'All courses provide 24/7 self-paced video lecture access, downloadable chapter-wise notes, and step-by-step problem solutions. You can study on your own schedule across mobile, tablet, or desktop with no expiration during the academic session.',
  },
  {
    question: 'Is this curriculum aligned with CBSE Board and JEE exams?',
    answer:
      'Yes, absolutely. Ankit Sir’s pedagogy begins with first-principles conceptual derivations strictly aligned with CBSE/NCERT theory, and systematically escalates into advanced problem-solving bridging foundational board mastery with JEE Main and Advanced problem types.',
  },
  {
    question: 'How does doubt support work?',
    answer:
      'Students get direct academic doubt assistance through our dedicated WhatsApp desk (+91 93825 57693) and the in-app doubt solver, where Ankit Sir and the academic team provide step-by-step written or video explanations.',
  },
  {
    question: 'What study materials and practice papers are included in each course?',
    answer:
      'Depending on the selected course, enrollments include sample papers, previous years solved questions (PYQs), mental ability modules, Olympiad drills, and comprehensive chapter-wise tests with detailed solutions.',
  },
  {
    question: 'How do I purchase books or enroll in a course?',
    answer:
      'Books can be purchased directly as instant Digital PDFs or ordered as printed hard copies delivered to your doorstep with no login required. Course enrollments can be completed via our secure Razorpay checkout or assisted through our WhatsApp admissions desk (+91 93825 57693).',
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
                <a href="#courses">Courses</a>
              </li>
              <li>
                <Link href="/books">Books</Link>
              </li>
              <li>
                <a href="#about">About</a>
              </li>
              <li>
                <a href="#faq">FAQ</a>
              </li>
            </ul>

            <div className="nav-actions">
              <a
                href="https://wa.me/919382557693?text=Hi%2C%20I%20have%20an%20inquiry%20regarding%20Adept%20Eduverse%20courses"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>+91 93825 57693</span>
              </a>
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

            {/* Mobile Header Quick Actions */}
            <div className="flex items-center gap-1.5 lg:hidden mr-1">
              <a
                href="#courses"
                className="px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold text-slate-200 bg-slate-800/90 border border-slate-700/80 hover:text-white"
              >
                Courses
              </a>
              <Link
                href="/books"
                className="px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 flex items-center gap-1"
              >
                <BookOpen className="w-3 h-3" />
                <span>Books</span>
              </Link>
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
          <a href="#courses" className="mobile-link" onClick={closeMobileMenu}>
            Courses &amp; Curriculum
          </a>
          <Link href="/books" className="mobile-link" onClick={closeMobileMenu}>
            Official Books
          </Link>
          <a href="#about" className="mobile-link" onClick={closeMobileMenu}>
            About
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
                Rigorous mathematics mentorship for Class VI–XII, JEE Mains &amp; Advanced by{' '}
                <strong className="text-white font-semibold">Ankit Kumar, B.Tech IIT Kharagpur (2019)</strong>.
                Uncompromising conceptual depth, verified problem banks, and 24/7 self-paced access.
              </p>

              <div className="hero-actions">
                <a className="landing-btn btn-primary" href="#courses">
                  <span>Explore Courses</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link className="landing-btn btn-glass" href="/books">
                  <span>Buy Official Books</span>
                  <BookOpen className="w-4 h-4" />
                </Link>
                <a
                  className="landing-btn btn-whatsapp sm:hidden"
                  href="https://wa.me/919382557693"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp Desk
                </a>
              </div>

              <div className="hero-trust">
                <div className="trust-item">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span>
                    <strong>IIT Kharagpur</strong> Founder
                  </span>
                </div>
                <div className="trust-item">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Complete</strong> Curriculum Coverage
                  </span>
                </div>
                <div className="trust-item">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span>
                    <strong>WhatsApp</strong> Doubt Assistance
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
                <div className="stat-number">Class VI–XII</div>
                <div className="stat-label">Complete Mathematics &amp; Foundation Series</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">2,700+</div>
                <div className="stat-label">Free In-Depth Video Lectures on YouTube</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">IIT Kharagpur</div>
                <div className="stat-label">B.Tech Mechanical Engineering (2019)</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">24 / 7</div>
                <div className="stat-label">Self-Paced Learning &amp; WhatsApp Doubt Desk</div>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================================
             COURSES - DYNAMIC PRICING SYSTEM & CLASS SELECTOR
             ==================================================================== */}
        <CoursesSection />

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
                  year to select the optimal foundation or advanced course.
                </p>
              </div>

              <div className="step-card">
                <span className="step-number">03</span>
                <h3>Step into the Arena</h3>
                <p>
                  Receive your verified credentials to access the Adept Eduverse classroom, digital notes archive,
                  daily assignment vault, and chapter mock examinations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
             OFFICIAL BOOKS & PUBLICATIONS SECTION
             ==================================================================== */}
        <BooksSection />

        {/* ====================================================================
             ABOUT / TEACHER & PEDAGOGY SHOWCASE (ANKIT SIR)
             ==================================================================== */}
        <section className="landing-section teacher-section" id="about">
          {/* Support both #about and legacy #teacher anchor */}
          <div id="teacher" className="scroll-mt-24" />
          <div className="landing-wrap teacher-grid">
            <div className="teacher-portrait-box" id="faculty-profile-card">
              <div className="portrait-halo">
                <Image
                  src="/images/ankit/ankit-teacher.webp"
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
                  <span className="seal-sub">B.Tech Engineering Alumnus (2019)</span>
                </div>
              </div>

              <div className="iit-seal-badge" id="teacher-feedback-badge">
                <Star className="seal-icon" width={22} height={22} />
                <div className="seal-text-group">
                  <span className="seal-title">96% Positive Feedback</span>
                  <span className="seal-sub">Student ratings, 2025–26</span>
                </div>
              </div>

              <div className="teacher-caption">
                <h3 className="teacher-name">Ankit Kumar</h3>
                <div className="teacher-deg">B.Tech, IIT Kharagpur | Mathematics Specialist</div>
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
                Ankit Sir mentors students across Classes VI through XII, demystifying
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
                    Direct communication with Ankit Sir on WhatsApp to clear doubts, study hurdles, and exam preparation
                    questions throughout the year.
                  </div>
                </div>
              </div>

              <div className="teacher-actions">
                <a
                  className="landing-btn btn-whatsapp"
                  href="https://wa.me/919382557693?text=Hi%20Ankit%20Sir%2C%20I%20am%20interested%20in%20joining%20your%20Mathematics%20course"
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
             RESULTS & WALL OF FAME (Only renders if verified consent exists)
             ==================================================================== */}
        <StudentResultsSection />

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
          <div className="landing-wrap !max-w-5xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 text-left">
              <div className="flex-1 space-y-4">
                <h2 className="!text-left !m-0">
                  Your IIT &amp; Board Goal Begins with a <span className="gold-text">Single Decision.</span>
                </h2>
                <p className="!text-left !m-0 text-slate-300 text-sm sm:text-base leading-relaxed">
                  Join Ankit Sir&apos;s mentorship today and experience mathematics transformed from a daunting subject into your
                  highest scoring strength on exam day.
                </p>

                <div className="final-actions !justify-start !pt-2 flex-wrap">
                  <a
                    className="landing-btn btn-whatsapp"
                    href="https://wa.me/919382557693?text=Hi%20Ankit%20Sir%2C%20I%20am%20ready%20to%20enroll%20in%20Adept%20Eduverse"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Enroll via WhatsApp (+91 93825 57693)
                  </a>
                  <Link href="/books" className="landing-btn btn-glass">
                    Official Books
                  </Link>
                  <Link href="/sign-in" className="landing-btn btn-primary">
                    Student Login
                  </Link>
                </div>

                <div className="final-support-note !justify-start text-xs text-slate-400">
                  <span></span>
                  Admissions open for 2025–26 session. Founder: Ankit Kumar (B.Tech Mechanical, IIT Kharagpur, 2019).
                </div>
              </div>

              {/* Ankit Sir Thumbs Up Photo with Gold Halo Frame */}
              <div className="relative w-44 h-44 sm:w-56 sm:h-56 shrink-0">
                <div className="absolute inset-0 rounded-3xl bg-amber-400/20 blur-xl pointer-events-none" />
                <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-amber-400/60 shadow-2xl bg-slate-900">
                  <Image
                    src="/images/ankit/ankit-thumbsup.webp"
                    alt="Ankit Kumar Sir giving thumbs up"
                    fill
                    sizes="(max-width: 640px) 176px, 224px"
                    className="object-cover object-top"
                  />
                </div>
              </div>
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
                  <a href="#courses">Class VI-X Foundation Courses</a>
                </li>
                <li>
                  <a href="#courses">Class 11 &amp; 12 JEE + Board</a>
                </li>
                <li>
                  <a href="#courses">Dropper Immersion Course</a>
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
           MOBILE BOTTOM NAVIGATION BAR
           ==================================================================== */}
      <nav className="mobile-dock" aria-label="Mobile Navigation">
        <a href="#top" className="mobile-dock-tab" aria-label="Home">
          <Home className="w-5 h-5" />
          <span>Home</span>
        </a>
        <a href="#courses" className="mobile-dock-tab" aria-label="Courses">
          <GraduationCap className="w-5 h-5 text-indigo-400" />
          <span>Courses</span>
        </a>
        <Link href="/books" className="mobile-dock-tab highlight" aria-label="Official Books">
          <div className="relative">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-amber-500 text-[8px] font-black text-slate-950 rounded-full leading-tight">
              HOT
            </span>
          </div>
          <span className="text-amber-400 font-bold">Books</span>
        </Link>
        <a
          href="https://wa.me/919382557693?text=Hi%2C%20I%20have%20an%20inquiry%20regarding%20Adept%20Eduverse"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-dock-tab"
          aria-label="WhatsApp Support"
        >
          <MessageCircle className="w-5 h-5 text-emerald-400" />
          <span>WhatsApp</span>
        </a>
        <Link
          href={isLoaded && isSignedIn && user ? dashboardHref : "/sign-in"}
          className="mobile-dock-tab"
          aria-label={isLoaded && isSignedIn && user ? "Dashboard" : "Login"}
        >
          {isLoaded && isSignedIn && user ? (
            <LayoutDashboard className="w-5 h-5 text-sky-400" />
          ) : (
            <LogIn className="w-5 h-5 text-rose-400" />
          )}
          <span>{isLoaded && isSignedIn && user ? "Portal" : "Login"}</span>
        </Link>
      </nav>
    </div>
  );
};
