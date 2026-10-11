import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { CrossChannelJourneyEngine } from '@/lib/email/journeyEngine';

export async function POST() {
  try {
    const { tenantId } = await getTenantContext();
    const result = await CrossChannelJourneyEngine.processDueEnrollments(tenantId);
    return NextResponse.json({ success: true, processed: result.processed });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error processing journey tick';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
