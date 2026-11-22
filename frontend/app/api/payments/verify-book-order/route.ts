import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookId,
      format,
    } = body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'ZPbb62VBJQHnw4AWH4ont8og';

    if (!keySecret) {
      return NextResponse.json({ error: 'Razorpay secret key not configured.' }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment signature. Verification failed.' },
        { status: 400 }
      );
    }

    // Determine download file for digital purchases
    let downloadUrl: string | null = null;
    let fileName: string | null = null;

    if (format === 'digital') {
      if (bookId === 'adv-qb-10') {
        fileName = 'Advanced Question Bank 10th.pdf';
        downloadUrl = `/books/${encodeURIComponent(fileName)}`;
      } else if (bookId === 'pyq-cbse-10') {
        fileName = 'PYQ Cbse 10th.pdf';
        downloadUrl = `/books/${encodeURIComponent(fileName)}`;
      } else {
        fileName = 'Class 10th Material.pdf';
        downloadUrl = `/books/Advanced%20Question%20Bank%2010th.pdf`;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully!',
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      format,
      downloadUrl,
      fileName,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
