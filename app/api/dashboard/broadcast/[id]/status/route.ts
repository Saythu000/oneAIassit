import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const { id: campaignId } = await params;

    const body = await req.json();
    const { action } = body; // 'PAUSE' | 'RESUME' | 'CANCEL'

    if (!['PAUSE', 'RESUME', 'CANCEL'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be PAUSE, RESUME, or CANCEL.' },
        { status: 400 }
      );
    }

    const campaign = await db.broadcastCampaign.findUnique({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    let nextStatus: string = campaign.status;

    if (action === 'PAUSE') {
      if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
        return NextResponse.json(
          { error: `Cannot pause a campaign that is already ${campaign.status}.` },
          { status: 400 }
        );
      }
      nextStatus = 'PAUSED';
    } else if (action === 'RESUME') {
      if (campaign.status !== 'PAUSED') {
        return NextResponse.json(
          { error: `Cannot resume a campaign that is currently ${campaign.status}.` },
          { status: 400 }
        );
      }
      nextStatus = 'QUEUED';
    } else if (action === 'CANCEL') {
      if (campaign.status === 'COMPLETED') {
        return NextResponse.json(
          { error: 'Cannot cancel a campaign that has already completed.' },
          { status: 400 }
        );
      }
      nextStatus = 'CANCELLED';

      // Also mark any pending/queued broadcast jobs as CANCELLED
      await db.broadcastJob.updateMany({
        where: {
          campaignId: campaign.id,
          tenantId,
          status: 'PENDING',
        },
        data: {
          status: 'FAILED',
          lastError: 'Campaign cancelled by operator.',
        },
      });
    }

    const updated = await db.broadcastCampaign.update({
      where: { id: campaign.id },
      data: { status: nextStatus as any },
    });

    return NextResponse.json({
      success: true,
      campaignId: updated.id,
      status: updated.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
