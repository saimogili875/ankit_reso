import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookId, format, bookTitle } = body;

    // Pricing in INR:
    // Digital: ₹299 + 18% GST (₹53.82) = ₹352.82 rounded to ₹353
    // Hard Copy: ₹399 + 18% GST (₹71.82) = ₹470.82 rounded to ₹471
    const amountInRupees = format === 'hardcopy' ? 471 : 353;
    const basePrice = format === 'hardcopy' ? 399 : 299;
    const amountInPaise = amountInRupees * 100;

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || 'rzp_test_U2vi5DOEHSekBJ';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'ZPbb62VBJQHnw4AWH4ont8og';

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: 'Razorpay payment keys are not configured.' },
        { status: 500 }
      );
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const receiptId = `bk_${Date.now().toString().slice(-8)}`;

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: {
          bookId: bookId || 'general-book',
          bookTitle: bookTitle || 'Class 10th Study Material',
          format: format || 'digital',
          basePrice: String(basePrice),
          gst: '18%',
        },
      }),
    });

    if (!rzpRes.ok) {
      const errorText = await rzpRes.text();
      console.error('Razorpay order creation error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create payment order with Razorpay.' },
        { status: 502 }
      );
    }

    const orderData = await rzpRes.json();

    return NextResponse.json({
      order_id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      key_id: keyId,
      basePrice,
      totalAmount: amountInRupees,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
