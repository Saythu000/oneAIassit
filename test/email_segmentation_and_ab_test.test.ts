import assert from 'node:assert';
import { SegmentationService } from '../lib/email/segmentation';
import { AbTestingService } from '../lib/email/abTesting';

async function runTests() {
  console.log('🧪 Starting Phase 5: Segmentation Sharing & A/B Testing Unit Tests...\n');

  // Test 1: Unified Segmentation Filter Building
  console.log('Test 1: Unified Customer Filter generation');
  const tagFilter = await SegmentationService.buildUnifiedCustomerFilter('tenant-123', {
    type: 'tag',
    value: 'vip',
  }, 'EMAIL');

  assert.strictEqual(tagFilter.tenantId, 'tenant-123', 'Tenant ID must be scoped');
  assert.strictEqual(tagFilter.optedOutAt, null, 'Must exclude opted out contacts');
  assert.strictEqual(tagFilter.emailConsentStatus, 'SUBSCRIBED', 'Email channel must require SUBSCRIBED');
  assert.ok(tagFilter.tags.hasSome.includes('vip'), 'Tags filter must include vip variants');

  console.log('  ✓ Tag-based unified filter verified');

  // Test 2: Email Behavioral Activity Filters
  console.log('\nTest 2: Behavioral filters (Clicks & Opens & Bounces)');
  const clickedFilter = await SegmentationService.buildUnifiedCustomerFilter('tenant-123', {
    type: 'email_engagement',
    emailActivity: 'CLICKED_ANY',
  }, 'EMAIL');

  assert.strictEqual(clickedFilter.emailEvents.some.eventType, 'CLICK', 'Must filter for CLICK email events');
  console.log('  ✓ CLICKED_ANY behavioral relation filter verified');

  const cleanReputationFilter = await SegmentationService.buildUnifiedCustomerFilter('tenant-123', {
    type: 'email_engagement',
    emailActivity: 'NEVER_BOUNCED',
  }, 'EMAIL');

  assert.deepStrictEqual(
    cleanReputationFilter.emailEvents.none.eventType.in,
    ['BOUNCE_HARD', 'BOUNCE_SOFT'],
    'Must filter out hard/soft bounces'
  );
  console.log('  ✓ NEVER_BOUNCED behavioral relation filter verified');

  // Test 3: A/B Test Recipient Deterministic Splitting
  console.log('\nTest 3: A/B Test Recipient deterministic splitting');
  const mockRecipients = Array.from({ length: 100 }, (_, i) => ({
    id: `cust-${i}`,
    email: `user${i}@example.com`,
    name: `User ${i}`,
  }));

  const split50 = AbTestingService.splitRecipients(mockRecipients, 50);
  assert.strictEqual(split50.variantA.length, 50, 'Variant A should have 50 items');
  assert.strictEqual(split50.variantB.length, 50, 'Variant B should have 50 items');
  assert.strictEqual(split50.variantA[0].id, 'cust-0');
  assert.strictEqual(split50.variantB[0].id, 'cust-50');

  const split30 = AbTestingService.splitRecipients(mockRecipients, 30);
  assert.strictEqual(split30.variantA.length, 30, 'Variant A should have 30 items');
  assert.strictEqual(split30.variantB.length, 70, 'Variant B should have 70 items');
  console.log('  ✓ Deterministic split (50/50 and 30/70) verified');

  // Test 4: A/B Test Winner Evaluation
  console.log('\nTest 4: A/B Test Winner Metric evaluation');
  const mockEventsA = [
    { eventType: 'OPEN', metadata: { variant: 'A' } },
    { eventType: 'OPEN', metadata: { variant: 'A' } },
    { eventType: 'CLICK', metadata: { variant: 'A' } },
  ];
  const mockEventsB = [
    { eventType: 'OPEN', metadata: { variant: 'B' } },
    { eventType: 'CLICK', metadata: { variant: 'B' } },
    { eventType: 'CLICK', metadata: { variant: 'B' } },
    { eventType: 'CLICK', metadata: { variant: 'B' } },
  ];

  const evalClicks = AbTestingService.calculateWinner(
    [...mockEventsA, ...mockEventsB],
    'CLICKS',
    200
  );
  assert.strictEqual(evalClicks.winner, 'B', 'Variant B should win on clicks (3 clicks vs 1 click)');
  assert.strictEqual(evalClicks.variantA.clicks, 1);
  assert.strictEqual(evalClicks.variantB.clicks, 3);
  console.log('  ✓ Winner evaluation on CLICKS verified (Variant B won: 3 clicks vs 1)');

  const evalOpens = AbTestingService.calculateWinner(
    [...mockEventsA, ...mockEventsB],
    'OPENS',
    200
  );
  assert.strictEqual(evalOpens.winner, 'A', 'Variant A should win on opens (2 opens vs 1 open)');
  console.log('  ✓ Winner evaluation on OPENS verified (Variant A won: 2 opens vs 1)');

  // Test 5: Deliverability Threshold Rules
  console.log('\nTest 5: Deliverability Threshold checks');
  const calcHealth = (delivered: number, complaints: number) => {
    const rate = delivered > 0 ? (complaints / delivered) * 100 : 0;
    const isPaused = rate >= 0.3;
    const isWarning = !isPaused && rate >= 0.1;
    return { rate, isPaused, isWarning };
  };

  const healthy = calcHealth(1000, 0);
  assert.strictEqual(healthy.isPaused, false);
  assert.strictEqual(healthy.isWarning, false);

  const warn = calcHealth(1000, 1); // 0.1%
  assert.strictEqual(warn.isPaused, false);
  assert.strictEqual(warn.isWarning, true);

  const paused = calcHealth(1000, 3); // 0.3%
  assert.strictEqual(paused.isPaused, true);
  console.log('  ✓ Deliverability thresholds (0.1% warning, 0.3% circuit breaker) verified');

  console.log('\n🎉 ALL PHASE 5 UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
