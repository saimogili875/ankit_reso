import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.adepteduverse.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/books',
          '/books/*',
          '/courses',
          '/courses/*',
          '/terms',
          '/privacy',
          '/refund',
          '/shipping',
          '/contact',
        ],
        disallow: [
          '/admin',
          '/admin/*',
          '/api/*',
          '/dashboard',
          '/dashboard/*',
          '/analysis',
          '/analysis/*',
          '/practice/*',
          '/tests/*',
          '/sign-in',
          '/sign-up',
          '/login',
          '/403',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
