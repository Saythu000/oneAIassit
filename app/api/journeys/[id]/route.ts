import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const { id } = await params;

    const journey = await db.crossChannelJourney.findUnique({
      where: { id, tenantId },
      include: {
        enrollments: {
          take: 20,
          orderBy: { updatedAt: 'desc' },
          include: {
            customer: {
              select: { id: true, displayName: true, email: true, primaryPhone: true },
            },
          },
        },
      },
    });

    if (!journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, journey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch journey';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const { id } = await params;
    const body = await req.json();

    const { status, name, description, steps, frequencyCapDays, quietHoursStart, quietHoursEnd } = body;

    const updated = await db.crossChannelJourney.update({
      where: { id, tenantId },
      data: {
        status: status || undefined,
        name: name || undefined,
        description: description !== undefined ? description : undefined,
        steps: steps || undefined,
        frequencyCapDays: frequencyCapDays !== undefined ? Number(frequencyCapDays) : undefined,
        quietHoursStart: quietHoursStart !== undefined ? quietHoursStart : undefined,
        quietHoursEnd: quietHoursEnd !== undefined ? quietHoursEnd : undefined,
      },
    });

    return NextResponse.json({ success: true, journey: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update journey';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const { id } = await params;

    await db.crossChannelJourney.delete({
      where: { id, tenantId },
    });

    return NextResponse.json({ success: true, message: 'Journey deleted.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete journey';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
