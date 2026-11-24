import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'Adept Eduverse – Class VI–XII & JEE Mathematics | Ankit Kumar (IIT Kharagpur)',
  description:
    'Master Class VI-XII Mathematics & JEE with Ankit Kumar, B.Tech IIT Kharagpur. Conceptual curriculum, comprehensive problem banks, and direct WhatsApp doubt support.',
};

export default function LandingRoute() {
  return <LandingPage />;
}
