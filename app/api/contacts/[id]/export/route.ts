import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const customerId = params.id;

    const customer = await db.customer.findUnique({
      where: { id: customerId },
      include: {
        customerChannels: true,
        conversations: {
          include: {
            messages: {
              select: {
                id: true,
                direction: true,
                senderType: true,
                content: true,
                channel: true,
                createdAt: true,
              },
            },
          },
        },
        leads: true,
        policies: true,
      },
    });

    if (!customer || customer.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      exportDate: new Date().toISOString(),
      customer,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Export failed' }, { status: 500 });
  }
}
