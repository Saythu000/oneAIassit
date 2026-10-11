import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const journeys = await db.crossChannelJourney.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, journeys });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch journeys';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const body = await req.json();
    const {
      name,
      description,
      triggerType = 'CONTACT_CREATED',
      triggerConfig,
      steps = [],
      frequencyCapDays = 1,
      quietHoursStart = '21:00',
      quietHoursEnd = '08:00',
      exitConditions = ['CONVERTED', 'UNSUBSCRIBED'],
      status = 'ACTIVE',
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Journey name is required' }, { status: 400 });
    }

    const journey = await db.crossChannelJourney.create({
      data: {
        tenantId,
        name,
        description,
        triggerType,
        triggerConfig,
        steps,
        frequencyCapDays: Number(frequencyCapDays) || 1,
        quietHoursStart,
        quietHoursEnd,
        exitConditions,
        status,
      },
    });

    return NextResponse.json({ success: true, journey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create journey';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
