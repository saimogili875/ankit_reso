/**
 * Razorpay Standard Web Checkout Integration Helper
 * Script: https://checkout.razorpay.com/v1/checkout.js
 */

import { apiClient } from './api-client';

export interface CreateOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
  receipt?: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message: string;
  payment_id?: string;
  order_id?: string;
  enrolled?: boolean;
  course_title?: string;
  error?: string;
}

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: RazorpayPrefill;
  notes?: Record<string, string>;
  theme?: {
    color?: string;
    backdrop_color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
      close: () => void;
    };
  }
}

/**
 * Dynamically loads the Razorpay checkout.js script if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.getElementById('razorpay-checkout-js');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Initiates Razorpay Standard Checkout:
 * 1. Calls backend /api/payments/create-order/ to create an order (sends course_id only)
 * 2. Opens the Razorpay modal
 * 3. On success, calls backend /api/payments/verify/ to verify signature
 */
export async function processRazorpayPayment(params: {
  courseId?: string;
  addonItemIds?: string[];
  courseTitle?: string;
  amountPaise?: number;
  description?: string;
  prefill?: RazorpayPrefill;
}): Promise<{
  order: CreateOrderResponse;
  payment: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };
  verification: VerifyPaymentResponse;
}> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !window.Razorpay) {
    throw new Error('Failed to load Razorpay SDK. Please check your internet connection and try again.');
  }

  let targetCourseId = params.courseId;
  if (!targetCourseId && !params.amountPaise) {
    try {
      const coursesRes = await apiClient.get<Array<{ id: string; is_free?: boolean }>>('/courses/');
      if (Array.isArray(coursesRes) && coursesRes.length > 0) {
        const paidCourse = coursesRes.find((c) => !c.is_free) || coursesRes[0];
        targetCourseId = paidCourse.id;
      }
    } catch {}
  }

  // STEP 1: Backend - Create Order (Price calculated strictly server-side)
  const orderPayload: Record<string, unknown> = {};
  if (targetCourseId) {
    orderPayload.course_id = targetCourseId;
    if (params.addonItemIds && params.addonItemIds.length > 0) {
      orderPayload.addon_item_ids = params.addonItemIds;
    }
  } else if (params.amountPaise) {
    orderPayload.amount = params.amountPaise;
  }

  const order = await apiClient.post<CreateOrderResponse>('/payments/create-order/', orderPayload);

  const keyId = order.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  if (!keyId) {
    throw new Error('Razorpay public key ID is not configured on the client or server.');
  }

  // STEP 2: Frontend - Open Razorpay Modal
  const paymentResult = await new Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>((resolve, reject) => {
    const options: RazorpayOptions = {
      key: keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'AdeptEduverse',
      description: params.description || params.courseTitle || 'JEE Course Enrollment',
      image: '/images/hero/slide-1.jpg',
      order_id: order.order_id,
      prefill: params.prefill || {
        name: 'Student',
        email: 'student@example.com',
      },
      theme: {
        color: '#2563eb', // Brand Blue
      },
      handler: (response) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment window was closed by the user.'));
        },
      },
    };

    try {
      const rzp = new window.Razorpay!(options);

      rzp.on('payment.failed', (response: unknown) => {
        const err = response as { error?: { description?: string; code?: string } };
        const msg = err?.error?.description || 'Payment failed. Please try again.';
        reject(new Error(msg));
      });

      rzp.open();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to launch Razorpay modal.';
      reject(new Error(msg));
    }
  });

  // STEP 3: Backend - Verify Signature
  const verification = await apiClient.post<VerifyPaymentResponse>('/payments/verify/', {
    razorpay_order_id: paymentResult.razorpay_order_id,
    razorpay_payment_id: paymentResult.razorpay_payment_id,
    razorpay_signature: paymentResult.razorpay_signature,
  });

  if (!verification.success) {
    throw new Error(verification.error || 'Payment signature verification failed.');
  }

  return {
    order,
    payment: paymentResult,
    verification,
  };
}
