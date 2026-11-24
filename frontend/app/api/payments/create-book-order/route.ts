import { NextResponse } from 'next/server';

function getBackendOrigin(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000';
  return raw.replace(/\/api\/?$/, '').replace(/\/+$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendOrigin = getBackendOrigin();

    // Delegate strictly to Django DRF payments API (server-side price calculation & security)
    const backendRes = await fetch(`${backendOrigin}/api/payments/books/create-order/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json().catch(() => ({}));
    if (!backendRes.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to initialize payment order on server.' },
        { status: backendRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
