import { redirect } from 'next/navigation';
import { SHORT_BOOK_ALIASES } from '@/components/books/BookPurchaseModal';

interface ShortBookPageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortBookRedirectPage({ params }: ShortBookPageProps) {
  const { code } = await params;
  const clean = (code || '').toLowerCase().trim();
  const alias = SHORT_BOOK_ALIASES[clean] || clean || 'advanced-10';

  // Instant redirect to the main front page directly anchored to the target book
  redirect(`/#${alias}`);
}
