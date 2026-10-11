import { NextResponse } from 'next/server';
import { getTenantPrisma } from '@/lib/db';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';

function extractEmailAddress(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1].trim().toLowerCase();
  return raw.trim().toLowerCase();
}

function extractName(raw: string): string {
  if (!raw) return 'Unknown Contact';
  const match = raw.match(/^([^<]+)</);
  if (match) return match[1].trim();
  const clean = raw.trim();
  return clean.includes('@') ? clean.split('@')[0] : clean;
}

export async function POST(req: Request) {
  try {
    let payload: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      const obj: Record<string, any> = {};
      formData.forEach((val, key) => {
        obj[key] = val;
      });
      payload = obj;
    } else {
      payload = await req.json();
    }

    // Provider Normalization (SendGrid, Resend, AWS SES SNS, Postmark/Generic)
    const fromRaw = payload.from || payload.sender || payload.From || '';
    const toRaw = payload.to || payload.recipient || payload.To || '';
    const subject = payload.subject || payload.Subject || '(No Subject)';
    const textBody = payload.text || payload.body || payload.Text || '';
    const htmlBody = payload.html || payload.Html || '';
    const messageId = payload.messageId || payload['message-id'] || `inbound-${Date.now()}`;
    const tenantSlugOrId = payload.tenantId || req.headers.get('x-tenant-id');

    const senderEmail = extractEmailAddress(fromRaw);
    const senderName = extractName(fromRaw);
    const recipientEmail = extractEmailAddress(toRaw);

    if (!senderEmail) {
      return NextResponse.json({ error: 'Sender email (from) is required' }, { status: 400 });
    }

    // Resolve tenant from recipient domain or header
    const recipientDomain = recipientEmail.includes('@') ? recipientEmail.split('@')[1] : '';
    const { prisma } = await import('@/lib/db');

    let tenantId = tenantSlugOrId;
    if (!tenantId && recipientDomain) {
      const sendingDomain = await prisma.tenantSendingDomain.findFirst({
        where: { domain: recipientDomain },
      });
      if (sendingDomain) {
        tenantId = sendingDomain.tenantId;
      }
    }

    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst();
      tenantId = firstTenant?.id;
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context could not be identified' }, { status: 400 });
    }

    const db = getTenantPrisma(tenantId, 'ADMIN');

    // 1. Find or create unified Customer record
    let customer = await db.customer.findFirst({
      where: {
        tenantId,
        email: senderEmail,
      },
    });

    if (!customer) {
      customer = await db.customer.create({
        data: {
          tenantId,
          displayName: senderName,
          email: senderEmail,
          primaryPhone: `email:${senderEmail}`,
          emailConsentStatus: 'SUBSCRIBED',
          optedIn: true,
          tags: ['Inbound Email Lead'],
        },
      });
    }

    // 2. Find or create Email Conversation thread
    let conversation = await db.conversation.findFirst({
      where: {
        tenantId,
        customerId: customer.id,
        channel: 'EMAIL',
      },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          tenantId,
          customerId: customer.id,
          channel: 'EMAIL',
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      });
    } else {
      await db.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          status: 'OPEN',
        },
      });
    }

    // 3. Sanitize HTML content to prevent XSS
    const sanitizedHtml = htmlBody ? sanitizeEmailHtml(htmlBody) : '';
    const finalContent = sanitizedHtml || textBody || '[Empty email received]';

    // 4. Store inbound message record
    const message = await db.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        direction: 'INBOUND',
        senderType: 'CUSTOMER',
        channel: 'EMAIL',
        messageType: 'TEXT',
        content: finalContent,
        status: 'DELIVERED',
        channelMessageId: messageId,
      },
    });

    // 5. Record timeline EmailEvent
    await db.emailEvent.create({
      data: {
        tenantId,
        customerId: customer.id,
        email: senderEmail,
        eventType: 'DELIVERED',
        messageId,
        metadata: {
          direction: 'INBOUND',
          subject,
          replyTo: recipientEmail,
        },
      },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      messageId: message.id,
      customerId: customer.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error processing inbound email';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
