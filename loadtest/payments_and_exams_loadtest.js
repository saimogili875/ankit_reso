import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('errors');
const orderCreateLatency = new Trend('order_create_latency_ms');
const paymentVerifyLatency = new Trend('payment_verify_latency_ms');
const webhookLatency = new Trend('webhook_latency_ms');
const examSubmitLatency = new Trend('exam_submit_latency_ms');
const successfulOrders = new Counter('successful_orders');
const successfulSubmissions = new Counter('successful_submissions');

// Configurable Test Profiles via environment variable:
// SCENARIO=1000_PAYMENTS (default): 1,000 users across 10 minutes
// SCENARIO=5000_PAYMENTS: 5,000 users across 10 minutes
// SCENARIO=1000_EXAM_SUBMITS: 1,000 concurrent exam submissions
const SCENARIO = __ENV.SCENARIO || '1000_PAYMENTS';

export const options = {
  scenarios: {
    payments_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages:
        SCENARIO === '5000_PAYMENTS'
          ? [
              { duration: '2m', target: 200 },
              { duration: '6m', target: 500 },
              { duration: '2m', target: 0 },
            ]
          : SCENARIO === '1000_EXAM_SUBMITS'
          ? [
              { duration: '30s', target: 200 },
              { duration: '1m', target: 1000 }, // Peak 1,000 concurrent submissions
              { duration: '2m', target: 1000 },
              { duration: '30s', target: 0 },
            ]
          : [
              // Default: 1,000 users in 10 minutes
              { duration: '2m', target: 50 },
              { duration: '6m', target: 120 },
              { duration: '2m', target: 0 },
            ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<600'], // p95 latency under 600ms
    errors: ['rate<0.01'],            // error rate < 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://127.0.0.1:8000/api';
const MOCK_BATCH_ID = __ENV.BATCH_ID || '00000000-0000-0000-0000-000000000001';
const MOCK_TEST_ID = __ENV.TEST_ID || '1';

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const timestamp = Date.now();
  const studentEmail = `student_${vuId}_${iterId}_${timestamp}@adepteduverse.test`;

  const headers = {
    'Content-Type': 'application/json',
  };

  // Branch 1: Exam Submission Load Test
  if (SCENARIO === '1000_EXAM_SUBMITS') {
    const submitStart = Date.now();
    const submitPayload = JSON.stringify({
      test_id: MOCK_TEST_ID,
      answers: {
        'q1': 'opt_a',
        'q2': 'opt_c',
        'q3': '42',
      },
      time_taken_seconds: 5400,
      auto_submitted: false,
    });

    const submitRes = http.post(
      `${BASE_URL}/tests/${MOCK_TEST_ID}/submit/`,
      submitPayload,
      { headers }
    );
    examSubmitLatency.add(Date.now() - submitStart);

    const isOk = check(submitRes, {
      'Exam submit returned 200 or 201': (r) => r.status === 200 || r.status === 201,
    });
    errorRate.add(!isOk);
    if (isOk) successfulSubmissions.add(1);
    sleep(1);
    return;
  }

  // Branch 2 & 3: Payments Load Test (create-order -> verify -> webhook)
  // Step 1: Create Order
  const createOrderStart = Date.now();
  const createOrderPayload = JSON.stringify({
    batch_id: MOCK_BATCH_ID,
    email: studentEmail,
    phone: '9876543210',
    full_name: `Student VU ${vuId}`,
  });

  const orderRes = http.post(`${BASE_URL}/payments/create-order/`, createOrderPayload, { headers });
  orderCreateLatency.add(Date.now() - createOrderStart);

  const orderOk = check(orderRes, {
    'Create order succeeded (200/201)': (r) => r.status === 200 || r.status === 201,
    'Order ID returned': (r) => r.json('order_id') !== undefined,
  });
  errorRate.add(!orderOk);

  if (!orderOk) {
    sleep(1);
    return;
  }

  const orderId = orderRes.json('order_id');
  const mockPaymentId = `pay_mock_${vuId}_${iterId}_${timestamp}`;

  // Step 2: Verify Payment (Mocked client signature callback)
  const verifyStart = Date.now();
  const verifyPayload = JSON.stringify({
    razorpay_order_id: orderId,
    razorpay_payment_id: mockPaymentId,
    razorpay_signature: `mock_sig_${orderId}_${mockPaymentId}`,
  });

  const verifyRes = http.post(`${BASE_URL}/payments/verify/`, verifyPayload, { headers });
  paymentVerifyLatency.add(Date.now() - verifyStart);

  const verifyOk = check(verifyRes, {
    'Verify payment processed': (r) => r.status === 200 || r.status === 400, // 400 if mock signature rejects
  });
  errorRate.add(!verifyOk);

  // Step 3: Razorpay Webhook Callback (Server-to-server asynchronous confirmation)
  const webhookStart = Date.now();
  const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: mockPaymentId,
          order_id: orderId,
          amount: 499900,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });

  const webhookHeaders = {
    ...headers,
    'X-Razorpay-Signature': 'mock_valid_webhook_signature',
  };

  const webhookRes = http.post(`${BASE_URL}/payments/webhook/`, webhookPayload, { headers: webhookHeaders });
  webhookLatency.add(Date.now() - webhookStart);

  const webhookOk = check(webhookRes, {
    'Webhook received': (r) => r.status === 200 || r.status === 400,
  });
  errorRate.add(!webhookOk);

  if (orderOk) {
    successfulOrders.add(1);
  }

  sleep(1);
}
