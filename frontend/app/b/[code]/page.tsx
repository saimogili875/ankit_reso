import { redirect } from 'next/navigation';
import { SHORT_BOOK_ALIASES } from '@/components/books/BookPurchaseModal';

interface ShortBookPageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortBookRedirectPage({ params }: ShortBookPageProps) {
  const { code } = await params;
  const clean = (code || '').toLowerCase().trim();
  const alias = SHORT_BOOK_ALIASES[clean] || clean || 'advanced-10';

  // If it's PYQ or Mental Ability, direct to internal /books catalog page
  if (alias.includes('pyq') || alias.includes('reasoning') || clean.includes('pyq') || clean.includes('reasoning')) {
    redirect(`/books#${alias}`);
  }

  // Flagship textbooks are directly on the main landing page
  redirect(`/#${alias}`);
}
