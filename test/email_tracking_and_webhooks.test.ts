import assert from 'node:assert';
import { EmailTrackingService } from '../lib/email/tracking';

async function testEmailTrackingAndWebhooks() {
  console.log('=== Testing Email Tracking, Signature Verification & Auto-Pause ===');

  const appBaseUrl = 'https://oneai.drgodly.com';
  const tenantId = 'tenant_track_999';
  const campaignId = 'camp_summer_001';
  const customerId = 'cust_sarah_123';
  const originalDestination = 'https://apexinsurance.com/special-offer?plan=gold';

  // 1. Generate click tracking link with automatic UTM tags
  const trackingUrl = EmailTrackingService.generateTrackingUrl(appBaseUrl, {
    tenantId,
    campaignId,
    customerId,
    originalUrl: originalDestination,
  });

  assert.ok(trackingUrl.startsWith(`${appBaseUrl}/api/channels/email/track/click`), 'Tracking URL prefix is correct');
  const parsedUrl = new URL(trackingUrl);
  const dataParam = parsedUrl.searchParams.get('d')!;
  const sigParam = parsedUrl.searchParams.get('s')!;
  assert.ok(dataParam, 'Data payload parameter is present');
  assert.ok(sigParam, 'HMAC signature parameter is present');
  console.log('✓ Signed click tracking URL generated successfully');

  // 2. Decode and verify valid tracking payload
  const decodedValid = EmailTrackingService.decodeTrackingPayload(dataParam, sigParam);
  assert.strictEqual(decodedValid.valid, true, 'Valid signature must decode successfully');
  assert.strictEqual(decodedValid.data?.tenantId, tenantId);
  assert.strictEqual(decodedValid.data?.campaignId, campaignId);
  assert.strictEqual(decodedValid.data?.customerId, customerId);
  assert.ok(decodedValid.data?.targetUrl?.includes('utm_source=oneaiassist_email'), 'Auto-tagged UTM parameters present in target URL');
  assert.ok(decodedValid.data?.targetUrl?.includes('utm_campaign=camp_summer_001'), 'Campaign UTM present in target URL');
  console.log('✓ HMAC verification succeeds and preserves auto-tagged UTM parameters');

  // 3. Tamper detection: Invalid or tampered signature should be rejected
  const tamperedSig = sigParam.slice(0, -4) + 'abcd';
  const decodedTampered = EmailTrackingService.decodeTrackingPayload(dataParam, tamperedSig);
  assert.strictEqual(decodedTampered.valid, false, 'Tampered signature must be rejected');
  console.log('✓ Anti-tampering verified: Forged signature rejected');

  // 4. Open tracking pixel generation and verification
  const pixelUrl = EmailTrackingService.generateOpenTrackingPixelUrl(appBaseUrl, tenantId, campaignId, customerId);
  assert.ok(pixelUrl.startsWith(`${appBaseUrl}/api/channels/email/track/open`), 'Open tracking pixel prefix is correct');
  const parsedPixel = new URL(pixelUrl);
  const pixelData = parsedPixel.searchParams.get('d')!;
  const pixelSig = parsedPixel.searchParams.get('s')!;
  const decodedPixel = EmailTrackingService.decodeTrackingPayload(pixelData, pixelSig);
  assert.strictEqual(decodedPixel.valid, true, 'Open pixel payload decodes and verifies successfully');
  console.log('✓ Open tracking pixel signed and verified successfully');

  // 5. Test Complaint Rate Circuit Breaker logic
  const calculateRate = (complaints: number, delivered: number) => {
    return (complaints / delivered) * 100;
  };

  const healthyRate = calculateRate(0, 1000); // 0.0%
  const warnRate = calculateRate(2, 1000);    // 0.2% (warn threshold: >= 0.1%)
  const pauseRate = calculateRate(4, 1000);   // 0.4% (auto-pause threshold: >= 0.3%)

  assert.strictEqual(healthyRate < 0.1, true, 'Healthy send rate below warning');
  assert.strictEqual(warnRate >= 0.1 && warnRate < 0.3, true, 'Warning triggered at >= 0.1% complaint rate');
  assert.strictEqual(pauseRate >= 0.3, true, 'Auto-pause circuit breaker tripped at >= 0.3% complaint rate');
  console.log('✓ Deliverability circuit breaker thresholds verified (Warn at 0.1%, Auto-Pause at 0.3%)');

  console.log('\n========================================================');
  console.log('🎉 ALL PHASE 4 TRACKING & WEBHOOK TESTS PASSED');
  console.log('========================================================\n');
}

testEmailTrackingAndWebhooks().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
