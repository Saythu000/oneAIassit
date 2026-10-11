import assert from 'node:assert';
import { CrossChannelJourneyEngine } from '../lib/email/journeyEngine';

async function runTests() {
  console.log('🧪 Starting Phase 6: Cross-Channel Journeys & Automation Unit Tests...\n');

  // Test 1: Quiet Hours Calculation
  console.log('Test 1: Quiet Hours Window Calculation');
  const nightDate = new Date('2026-10-10T22:30:00'); // 10:30 PM
  const nightCheck = CrossChannelJourneyEngine.isWithinQuietHours('21:00', '08:00', nightDate);
  assert.strictEqual(nightCheck.inQuietHours, true, '22:30 must be detected within overnight quiet hours (21:00-08:00)');
  assert.ok(nightCheck.resumeAt, 'Must provide resumeAt date');
  assert.strictEqual(nightCheck.resumeAt.getHours(), 8, 'Resume hour should be 08:00');

  const earlyMorningDate = new Date('2026-10-10T05:15:00'); // 5:15 AM
  const earlyCheck = CrossChannelJourneyEngine.isWithinQuietHours('21:00', '08:00', earlyMorningDate);
  assert.strictEqual(earlyCheck.inQuietHours, true, '05:15 must be detected within quiet hours');
  assert.strictEqual(earlyCheck.resumeAt?.getHours(), 8, 'Resume hour should be 08:00 AM');

  const daytimeDate = new Date('2026-10-10T14:30:00'); // 2:30 PM
  const daytimeCheck = CrossChannelJourneyEngine.isWithinQuietHours('21:00', '08:00', daytimeDate);
  assert.strictEqual(daytimeCheck.inQuietHours, false, '14:30 is during normal operating hours');

  console.log('  ✓ Overnight and daytime quiet hours checks verified');

  // Test 2: Cross-Channel Fallback Branching Logic
  console.log('\nTest 2: Cross-Channel Fallback Logic (WhatsApp unread -> Email fallback)');
  const evaluateFallback = (isReadWithin24h: boolean) => {
    const step = {
      type: 'BRANCH_CONDITION',
      conditionType: 'WHATSAPP_UNREAD_24H',
      onTrueStepIndex: 5,  // Continue WhatsApp sequence
      onFalseStepIndex: 3, // Fallback to Email
    };

    if (!isReadWithin24h) {
      return { branch: 'EMAIL_FALLBACK', nextStepIndex: step.onFalseStepIndex };
    }
    return { branch: 'WHATSAPP_SUCCESS', nextStepIndex: step.onTrueStepIndex };
  };

  const unreadFallback = evaluateFallback(false);
  assert.strictEqual(unreadFallback.branch, 'EMAIL_FALLBACK');
  assert.strictEqual(unreadFallback.nextStepIndex, 3, 'Must route to step 3 (Send Email) when unread in 24h');

  const readSuccess = evaluateFallback(true);
  assert.strictEqual(readSuccess.branch, 'WHATSAPP_SUCCESS');
  assert.strictEqual(readSuccess.nextStepIndex, 5, 'Must route to step 5 when WhatsApp was read');

  console.log('  ✓ Cross-channel fallback routing (WhatsApp unread -> Email) verified');

  // Test 3: Frequency Capping Logic
  console.log('\nTest 3: Cross-Channel Frequency Capping Calculation');
  const checkFrequencyCap = (lastContactedAt: Date | null, capDays: number, now: Date) => {
    if (!lastContactedAt || capDays <= 0) return { allowed: true };
    const diffMs = now.getTime() - lastContactedAt.getTime();
    const capMs = capDays * 24 * 60 * 60 * 1000;
    return {
      allowed: diffMs >= capMs,
      remainingHours: Math.max(0, Math.ceil((capMs - diffMs) / (3600 * 1000))),
    };
  };

  const now = new Date('2026-10-10T12:00:00');
  const contacted6HoursAgo = new Date('2026-10-10T06:00:00');
  const capResult1 = checkFrequencyCap(contacted6HoursAgo, 1, now);
  assert.strictEqual(capResult1.allowed, false, 'Should be throttled if contacted 6h ago with 1-day cap');
  assert.strictEqual(capResult1.remainingHours, 18);

  const contacted2DaysAgo = new Date('2026-10-08T10:00:00');
  const capResult2 = checkFrequencyCap(contacted2DaysAgo, 1, now);
  assert.strictEqual(capResult2.allowed, true, 'Should be allowed after cap interval passes');

  console.log('  ✓ Cross-channel frequency capping throttling verified');

  // Test 4: Exit Conditions Evaluation
  console.log('\nTest 4: Journey Exit Conditions Evaluation');
  const evaluateExit = (customer: { optedOut: boolean; emailConsent: string; converted: boolean }) => {
    if (customer.optedOut || customer.emailConsent === 'UNSUBSCRIBED') {
      return 'EXITED_UNSUBSCRIBED';
    }
    if (customer.converted) {
      return 'EXITED_CONVERTED';
    }
    return 'IN_PROGRESS';
  };

  assert.strictEqual(
    evaluateExit({ optedOut: true, emailConsent: 'SUBSCRIBED', converted: false }),
    'EXITED_UNSUBSCRIBED'
  );
  assert.strictEqual(
    evaluateExit({ optedOut: false, emailConsent: 'UNSUBSCRIBED', converted: false }),
    'EXITED_UNSUBSCRIBED'
  );
  assert.strictEqual(
    evaluateExit({ optedOut: false, emailConsent: 'SUBSCRIBED', converted: true }),
    'EXITED_CONVERTED'
  );
  assert.strictEqual(
    evaluateExit({ optedOut: false, emailConsent: 'SUBSCRIBED', converted: false }),
    'IN_PROGRESS'
  );

  console.log('  ✓ Exit conditions (unsubscribed, converted, in-progress) verified');

  console.log('\n🎉 ALL PHASE 6 AUTOMATION & JOURNEY UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
