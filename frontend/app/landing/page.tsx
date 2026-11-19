import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

export const metadata: Metadata = {
  title: 'Adept Eduverse – Premier JEE Mains & Advanced Mathematics | Ankit Kumar (IIT Kharagpur)',
  description:
    'Master JEE Mains and Advanced Mathematics with Ankit Kumar, B.Tech IIT Kharagpur. Elite live online classes, 2,700+ video lessons, and proven AIR 125 results.',
};

export default function LandingRoute() {
  return <LandingPage />;
}
