import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const [
      config,
      totalDelivered,
      totalComplaints,
      totalBounces,
      totalUnsubscribes,
      domains,
      recentEvents,
    ] = await Promise.all([
      db.tenantEmailConfig.findUnique({ where: { tenantId } }),
      db.emailEvent.count({ where: { tenantId, eventType: 'DELIVERED' } }),
      db.emailEvent.count({ where: { tenantId, eventType: 'COMPLAINT' } }),
      db.emailEvent.count({ where: { tenantId, eventType: 'BOUNCE_HARD' } }),
      db.emailEvent.count({ where: { tenantId, eventType: 'UNSUBSCRIBE' } }),
      db.tenantSendingDomain.findMany({ where: { tenantId } }),
      db.emailEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          eventType: true,
          createdAt: true,
          url: true,
        },
      }),
    ]);

    const complaintRate =
      totalDelivered > 0 ? Number(((totalComplaints / totalDelivered) * 100).toFixed(3)) : 0.0;
    const bounceRate =
      totalDelivered > 0 ? Number(((totalBounces / totalDelivered) * 100).toFixed(2)) : 0.0;

    const isAutoPaused = config?.isAutoPaused || complaintRate >= 0.3;
    const isWarning = !isAutoPaused && complaintRate >= 0.1;

    // Warm-up ramp calculation
    const currentDailyQuota = config?.dailySendQuota || 1000;
    const hourlyPace = config?.hourlySendRate || 100;

    return NextResponse.json({
      healthStatus: isAutoPaused ? 'PAUSED' : isWarning ? 'WARNING' : 'HEALTHY',
      isAutoPaused,
      isWarning,
      metrics: {
        totalDelivered,
        totalComplaints,
        totalBounces,
        totalUnsubscribes,
        complaintRate,
        bounceRate,
        thresholds: {
          warning: 0.1,
          autoPause: 0.3,
        },
      },
      warmup: {
        dailyQuota: currentDailyQuota,
        hourlyRate: hourlyPace,
        recommendedStage: currentDailyQuota <= 500 ? 'Stage 1 (Initial)' : currentDailyQuota <= 2000 ? 'Stage 2 (Growth)' : 'Stage 3 (Mature)',
      },
      domains: domains.map((d) => ({
        domain: d.domain,
        status: d.status,
        verifiedAt: d.verifiedAt,
      })),
      recentEvents,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching deliverability metrics';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const body = await req.json();
    const { action, dailySendQuota, hourlySendRate } = body;

    if (action === 'RESUME_SENDING') {
      await db.tenantEmailConfig.updateMany({
        where: { tenantId },
        data: { isAutoPaused: false },
      });
      return NextResponse.json({ success: true, message: 'Sending successfully resumed.' });
    }

    if (action === 'UPDATE_WARMUP') {
      await db.tenantEmailConfig.updateMany({
        where: { tenantId },
        data: {
          dailySendQuota: dailySendQuota ? Number(dailySendQuota) : undefined,
          hourlySendRate: hourlySendRate ? Number(hourlySendRate) : undefined,
        },
      });
      return NextResponse.json({ success: true, message: 'Warm-up schedule updated.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating deliverability status';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
