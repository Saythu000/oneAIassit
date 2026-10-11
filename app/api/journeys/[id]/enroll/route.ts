import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { CrossChannelJourneyEngine } from '@/lib/email/journeyEngine';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await getTenantContext();
    const { id } = await params;
    const body = await req.json();
    const { customerId, customerIds } = body;

    const targets = customerIds && Array.isArray(customerIds) ? customerIds : customerId ? [customerId] : [];

    if (targets.length === 0) {
      return NextResponse.json({ error: 'At least one customerId is required' }, { status: 400 });
    }

    const results = [];
    for (const cId of targets) {
      const res = await CrossChannelJourneyEngine.enrollCustomer(tenantId, id, cId);
      results.push({ customerId: cId, ...res });
    }

    return NextResponse.json({ success: true, enrolled: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to enroll customer into journey';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
