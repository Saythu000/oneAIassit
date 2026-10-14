import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-100 pb-6 mb-8">
          <Link href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-500 mb-4 inline-block">
            ← Back to OneAIAssist
          </Link>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-500 mt-2">Effective Date: October 14, 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Overview</h2>
            <p>
              OneAIAssist (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides AI-driven communication, workflow automation, and multi-channel marketing tools. This Privacy Policy describes how we collect, store, and process personal and business information when you use our platform and integrations (including Meta / Facebook and Instagram integrations).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">2. Information We Access &amp; Use</h2>
            <p>
              When you connect third-party platforms such as Meta Facebook Pages or Instagram Professional accounts via OAuth 2.0:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>We securely store authorized Page Access Tokens using AES-256-GCM encryption.</li>
              <li>We only read page public engagement metrics and publish posts, photos, or videos that you explicitly author and schedule.</li>
              <li>We do not store your Facebook personal passwords or sell your data to any third party.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Data Security &amp; Retention</h2>
            <p>
              All authorization credentials and communications are transmitted via TLS 1.3 encryption and stored in secure cloud infrastructure with tenant isolation. You may disconnect your integrations or request deletion of your account and tokens at any time through your dashboard settings.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or your data, please contact us at <span className="font-medium text-slate-900">support@drgodly.com</span>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
