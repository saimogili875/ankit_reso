import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const testPaperReadErrors = new Rate('test_paper_read_errors');
const answerSaveLatency = new Trend('answer_save_latency_ms');
const testPaperLoadLatency = new Trend('test_paper_load_latency_ms');
const submitLatency = new Trend('submit_latency_ms');

// Performance thresholds for exam-day SLA
export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp-up to 100 concurrent students
    { duration: '1m', target: 500 },   // Surge to 500 concurrent students at start bell
    { duration: '2m', target: 500 },   // Sustained exam load (reading, saving answers)
    { duration: '30s', target: 0 },    // Ramp-down after submit
  ],
  thresholds: {
    // 95% of all HTTP requests must complete in under 500ms
    http_req_duration: ['p(95)<500'],
    // Overall error rate must stay below 1%
    errors: ['rate<0.01'],
    // Test paper loading MUST have 0% errors (served directly from Redis cache)
    test_paper_read_errors: ['rate==0'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://127.0.0.1:8000/api';
const STUDENT_EMAIL = __ENV.STUDENT_EMAIL || 'mogilisaikumar875@gmail.com';
const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || 'sai@123';
const TARGET_TEST_ID = __ENV.TEST_ID || '1';

export default function () {
  // 1. Obtain CSRF cookie
  const csrfRes = http.get(`${BASE_URL}/auth/csrf/`);
  check(csrfRes, { 'CSRF token retrieved': (r) => r.status === 200 });

  let csrfToken = '';
  if (csrfRes.headers['Set-Cookie']) {
    const match = csrfRes.headers['Set-Cookie'].match(/csrftoken=([^;]+)/);
    if (match) csrfToken = match[1];
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-CSRFToken': csrfToken,
  };

  // 2. Student Authentication / Login
  const loginPayload = JSON.stringify({
    email: STUDENT_EMAIL,
    password: STUDENT_PASSWORD,
  });

  const loginRes = http.post(`${BASE_URL}/accounts/login/`, loginPayload, { headers: defaultHeaders });
  const loginOk = check(loginRes, {
    'Login succeeded (200)': (r) => r.status === 200,
  });
  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(1);
    return;
  }

  sleep(1);

  // 3. Simultaneous Test Paper Load (High concurrency burst at exam start)
  const startTimer = Date.now();
  const startRes = http.post(`${BASE_URL}/tests/${TARGET_TEST_ID}/start/`, '{}', { headers: defaultHeaders });
  const testLoadMs = Date.now() - startTimer;
  testPaperLoadLatency.add(testLoadMs);

  const testLoadOk = check(startRes, {
    'Test paper loaded (200)': (r) => r.status === 200,
    'Attempt ID returned': (r) => r.json('attempt_id') !== undefined,
    'Questions present': (r) => Array.isArray(r.json('questions')),
  });

  errorRate.add(!testLoadOk);
  testPaperReadErrors.add(!testLoadOk);

  if (!testLoadOk) {
    sleep(2);
    return;
  }

  const testData = startRes.json();
  const attemptId = testData.attempt_id;
  const questions = testData.questions || [];

  if (testData.already_submitted) {
    // Attempt already submitted; view results
    http.get(`${BASE_URL}/tests/attempts/${attemptId}/result/`, { headers: defaultHeaders });
    return;
  }

  // 4. Exam Simulation Loop (Answering questions with realistic think times)
  const simulatedAnswers = {};
  const questionsToAttempt = questions.slice(0, Math.min(questions.length, 15));

  for (let i = 0; i < questionsToAttempt.length; i++) {
    const q = questionsToAttempt[i];
    const optionId = q.options && q.options.length > 0 ? q.options[0].id : '42';
    simulatedAnswers[q.id] = optionId;

    // Simulate student reading & calculating before clicking Save & Next
    sleep(Math.random() * 2 + 1); // 1-3 seconds between answers in load test

    const eventPayload = JSON.stringify({
      question_id: q.id,
      event_type: 'answer',
      selected_answer: optionId,
      time_spent_delta: 30,
      new_state: 'ANSWERED',
    });

    const eventStart = Date.now();
    const eventRes = http.post(
      `${BASE_URL}/tests/attempts/${attemptId}/event/`,
      eventPayload,
      { headers: defaultHeaders }
    );
    answerSaveLatency.add(Date.now() - eventStart);

    check(eventRes, {
      'Answer saved successfully': (r) => r.status === 200,
    });
  }

  sleep(2);

  // 5. Final Test Submission
  const submitPayload = JSON.stringify({
    answers: simulatedAnswers,
    time_taken_seconds: 1800,
    is_auto: false,
  });

  const submitStart = Date.now();
  const submitRes = http.post(
    `${BASE_URL}/tests/attempts/${attemptId}/submit/`,
    submitPayload,
    { headers: defaultHeaders }
  );
  submitLatency.add(Date.now() - submitStart);

  const submitOk = check(submitRes, {
    'Test submitted successfully (200 or 201)': (r) => r.status === 200 || r.status === 201,
    'Score received': (r) => r.json('score') !== undefined,
  });
  errorRate.add(!submitOk);

  // 6. View Result Page
  sleep(1);
  const resultRes = http.get(`${BASE_URL}/tests/attempts/${attemptId}/result/`, { headers: defaultHeaders });
  check(resultRes, {
    'Result analysis returned': (r) => r.status === 200,
  });
}
