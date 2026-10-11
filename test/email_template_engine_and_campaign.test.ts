import assert from 'node:assert';
import { EmailTemplateEngine } from '../lib/email/templateEngine';

async function testTemplateEngineAndPreSendChecklist() {
  console.log('=== Testing Email Template Engine & Pre-Send Validation ===');

  // 1. Merge tags with fallback
  const templateWithFallback = 'Hello {{first_name | "Valued Customer"}}, your policy {{policy_number}} is ready.';
  
  // Case A: Variables provided
  const renderedA = EmailTemplateEngine.render(templateWithFallback, {
    first_name: 'Sarah',
    policy_number: 'POL-10029',
  });
  assert.strictEqual(renderedA, 'Hello Sarah, your policy POL-10029 is ready.');
  console.log('✓ Merge tags with values rendered successfully');

  // Case B: Variable missing, fallback triggered
  const renderedB = EmailTemplateEngine.render(templateWithFallback, {
    policy_number: 'POL-10029',
  });
  assert.strictEqual(renderedB, 'Hello Valued Customer, your policy POL-10029 is ready.');
  console.log('✓ Fallback merge tags rendered successfully when variable is empty');

  // 2. Conditional block rendering: {{#if is_vip}}...{{else}}...{{/if}}
  const conditionalTemplate = 'Welcome! {{#if is_vip}}You are a VIP Member with 24/7 priority support.{{else}}Upgrade to VIP for 24/7 support.{{/if}}';
  
  const vipRendered = EmailTemplateEngine.render(conditionalTemplate, { is_vip: true });
  assert.strictEqual(vipRendered, 'Welcome! You are a VIP Member with 24/7 priority support.');
  console.log('✓ Conditional {{#if}} truthy branch rendered successfully');

  const regularRendered = EmailTemplateEngine.render(conditionalTemplate, { is_vip: false });
  assert.strictEqual(regularRendered, 'Welcome! Upgrade to VIP for 24/7 support.');
  console.log('✓ Conditional {{else}} falsy branch rendered successfully');

  // 3. HTML to Plain Text Conversion
  const htmlSample = `
    <html>
      <body>
        <h1 style="color: blue;">Welcome to Apex Care</h1>
        <p>Dear customer, please review your policy <a href="https://example.com/pol">details here</a>.</p>
        <br/>
        <div style="font-size: 12px;">Unsubscribe at any time.</div>
      </body>
    </html>
  `;
  const plainText = EmailTemplateEngine.htmlToPlainText(htmlSample);
  assert.ok(plainText.includes('Welcome to Apex Care'), 'Plain text contains header');
  assert.ok(plainText.includes('details here (https://example.com/pol)'), 'Links converted cleanly to text with URL in parens');
  assert.ok(!plainText.includes('<h1'), 'No HTML tags remain');
  console.log('✓ Responsive HTML successfully converted to clean plain text');

  // 4. Pre-send Deliverability & Compliance Checklist
  // Case A: Non-compliant email (missing unsubscribe link)
  const badCheck = EmailTemplateEngine.validatePreSend({
    subject: 'Act now!!! Make money fast 100% free winner!!!',
    htmlBody: '<div>Hello customer, buy our products right now.</div>',
  });
  assert.strictEqual(badCheck.passed, false, 'Non-compliant email should fail validation');
  assert.ok(badCheck.errors.some((e) => e.includes('Unsubscribe')), 'Missing unsubscribe caught as error');
  assert.ok(badCheck.warnings.some((w) => w.includes('Spam alert')), 'Spam words caught as warnings');
  console.log('✓ Pre-send checklist catches compliance violations and spam triggers');

  // Case B: Compliant email with unsubscribe and physical address
  const goodCheck = EmailTemplateEngine.validatePreSend({
    subject: 'Your Annual Policy Summary for {{first_name}}',
    htmlBody: '<div>Review your coverage.<p><a href="{{unsubscribe_url}}">Unsubscribe</a></p><p>{{sender_address}}</p></div>',
  });
  assert.strictEqual(goodCheck.passed, true, 'Compliant email passes pre-send validation');
  assert.strictEqual(goodCheck.errors.length, 0, 'Zero errors for compliant email');
  console.log('✓ Compliant email passes pre-send checklist with 0 errors');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 3 TEMPLATE & CAMPAIGN TESTS PASSED');
  console.log('======================================================\n');
}

testTemplateEngineAndPreSendChecklist().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
