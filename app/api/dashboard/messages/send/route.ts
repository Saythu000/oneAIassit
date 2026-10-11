import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function POST(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const { conversationId, text } = await req.json();

    if (!conversationId || !text) {
      return NextResponse.json({ error: 'conversationId and text are required' }, { status: 400 });
    }

    // 1. Fetch Conversation details
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // 2. Multi-Channel dispatch: Check if conversation is EMAIL
    if (conversation.channel === 'EMAIL') {
      const customer = await db.customer.findUnique({
        where: { id: conversation.customerId },
      });

      if (!customer?.email) {
        return NextResponse.json({ error: 'Customer email address not found' }, { status: 400 });
      }

      const { EmailTransportAdapter } = await import('@/lib/email/EmailTransportAdapter');
      const emailTransport = new EmailTransportAdapter(tenantId);
      await emailTransport.sendText(customer.email, text);

      const message = await db.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          senderType: 'AGENT',
          channel: 'EMAIL',
          messageType: 'TEXT',
          content: text,
          status: 'SENT',
        },
      });

      await db.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() },
      });

      return NextResponse.json({ success: true, messageId: message.id });
    }

    // 3. WhatsApp dispatch (default)
    const result = await sendWhatsAppMessage({
      tenantId,
      customerId: conversation.customerId,
      text,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
