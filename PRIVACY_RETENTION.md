# Privacy, Data Retention & DPDP Compliance

This document outlines Adept Eduverse's data privacy, PII protection, and statutory data retention policies in compliance with the **Digital Personal Data Protection Act (DPDP)** and regulatory financial guidelines in India.

---

## 1. Statutory Data Retention Schedule

| Data Category | Table(s) | Minimum Retention Period | Justification / Legal Basis | Post-Retention Action |
|---|---|---|---|---|
| **Financial & Payment Records** | `payments_payment`, `books_bookorder` | **7 to 8 Years** | Statutory requirement under Indian Companies Act (Sec 128) & GST Act for tax compliance, accounting audits, and chargeback disputes. | Archived to cold encrypted storage; PII pseudonymized where permitted. |
| **Academic & Test Examination Records** | `tests_testattempt`, `tests_questionattemptlog`, `tests_testattemptanalysis` | **3 Years** | Performance benchmarking, cohort percentile calculation, dispute resolution for entrance evaluations. | Aggregated into anonymous statistical percentiles; individual student attempt details scrubbed upon user erasure request. |
| **Video Playback & Streaming Telemetry** | `content_playbackstat`, `content_videoprogress` | **1 Year** | Bandwidth audit, cheat/leak detection, analytics. | Telemetry records older than 365 days are aggregated into chapter-level view counts and purged. |
| **Authentication & Access Logs** | Rate limit logs, session tokens | **90 Days** | Cybersecurity analysis, IP fraud prevention, brute force mitigation. | Automatically purged via Redis TTL and rolling logs. |

---

## 2. Personal Identifiable Information (PII) Protection

1. **Zero Raw PII Logging**:
   - Phone numbers, email addresses, and OTP codes are strictly masked in logs (`j***e@domain.com`, `+91******4356`, `******`).
   - OTP codes are never logged to console, disk, or external log aggregators.
2. **Third-Party Telemetry & Error Tracking**:
   - Sentry error monitoring is configured with `send_default_pii=False`.
   - No payment card numbers, UPI PINs, or net-banking credentials ever traverse the server (processed exclusively client-side via PCI-DSS Level 1 certified Razorpay checkout).

---

## 3. Student DPDP Rights & Implementation

1. **Right to Access & Data Portability**:
   - Endpoint: `GET /api/auth/me/export-data/`
   - Returns a structured JSON archive of all personal information, enrollment history, test attempt performance, and payment ledger records.
2. **Right to Erasure (Account Deletion)**:
   - Endpoint: `POST /api/auth/me/delete-account/` with `{ "confirmation": "DELETE" }`.
   - Deactivates the student account (`is_active = False`), scrubs all personal identifiers (name, username, email, phone, bio) to irreversible random placeholders (`deleted_<uuid>@anonymized.invalid`), and marks credentials unusable while retaining financial audit logs as mandated by Indian financial statutes.
