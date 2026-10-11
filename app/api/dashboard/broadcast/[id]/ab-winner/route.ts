import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { AbTestingService } from '@/lib/email/abTesting';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await getTenantContext();
    const { id: campaignId } = await params;

    const evaluation = await AbTestingService.evaluateAbWinner(tenantId, campaignId);

    return NextResponse.json(evaluation);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error evaluating A/B winner';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
