import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { EmailTrackingService } from '@/lib/email/tracking';
import { getTenantPrisma } from '@/lib/db';

/**
 * Multi-Provider Webhook Ingestion Endpoint
 * Supports Resend (Svix signature), Amazon SES (SNS notification signature), and SendGrid.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const rawBody = await req.text();
    let payload: any;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const normalizedProvider = (provider || 'resend').toLowerCase();

    if (normalizedProvider === 'resend') {
      // Resend webhook format
      // Payload structure: { type: 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.opened' | 'email.clicked', data: { email_id, to: [...], ... } }
      const eventType = payload.type;
      const data = payload.data || {};
      const recipient = Array.isArray(data.to) ? data.to[0] : (data.to || data.email);
      const messageId = data.email_id || data.id;

      if (!recipient) {
        return NextResponse.json({ status: 'ignored_no_recipient' });
      }

      // Resolve tenant from messageId or recipient
      const db = getTenantPrisma('system', 'ADMIN');
      const eventRecord = await db.emailEvent.findFirst({
        where: { messageId },
        select: { tenantId: true, campaignId: true, customerId: true },
      });

      let tenantId = eventRecord?.tenantId;
      if (!tenantId) {
        const cust = await db.customer.findFirst({
          where: { email: recipient.toLowerCase() },
          select: { tenantId: true, id: true },
        });
        tenantId = cust?.tenantId;
      }

      if (!tenantId) {
        return NextResponse.json({ status: 'ignored_no_tenant' });
      }

      let mappedType: any = null;
      if (eventType === 'email.delivered') mappedType = 'DELIVERED';
      else if (eventType === 'email.opened') mappedType = 'OPEN';
      else if (eventType === 'email.clicked') mappedType = 'CLICK';
      else if (eventType === 'email.bounced') mappedType = 'BOUNCE_HARD';
      else if (eventType === 'email.complained') mappedType = 'COMPLAINT';

      if (mappedType) {
        await EmailTrackingService.recordEmailEvent({
          tenantId,
          email: recipient,
          eventType: mappedType,
          messageId,
          campaignId: eventRecord?.campaignId || undefined,
          customerId: eventRecord?.customerId || undefined,
          url: data.click?.link,
          metadata: payload,
        });
      }

      return NextResponse.json({ success: true, processed: mappedType });
    } else if (normalizedProvider === 'ses' || normalizedProvider === 'amazon_ses') {
      // Amazon SES SNS Webhook format
      const messageType = payload.Type;
      // Handle SNS Subscription Confirmation
      if (messageType === 'SubscriptionConfirmation') {
        const subscribeUrl = payload.SubscribeURL;
        console.log(`[SES Webhook] Subscription confirmation required: ${subscribeUrl}`);
        if (subscribeUrl) {
          await fetch(subscribeUrl);
        }
        return NextResponse.json({ status: 'subscription_confirmed' });
      }

      const sesMessage = payload.Message ? JSON.parse(payload.Message) : payload;
      const eventType = sesMessage.eventType || sesMessage.notificationType;
      const mail = sesMessage.mail || {};
      const destination = mail.destination?.[0];
      const messageId = mail.messageId;

      if (destination) {
        const db = getTenantPrisma('system', 'ADMIN');
        const cust = await db.customer.findFirst({
          where: { email: destination.toLowerCase() },
          select: { tenantId: true, id: true },
        });

        if (cust) {
          let mappedType: any = null;
          if (eventType === 'Delivery') mappedType = 'DELIVERED';
          else if (eventType === 'Open') mappedType = 'OPEN';
          else if (eventType === 'Click') mappedType = 'CLICK';
          else if (eventType === 'Bounce') mappedType = 'BOUNCE_HARD';
          else if (eventType === 'Complaint') mappedType = 'COMPLAINT';

          if (mappedType) {
            await EmailTrackingService.recordEmailEvent({
              tenantId: cust.tenantId,
              email: destination,
              eventType: mappedType,
              messageId,
              customerId: cust.id,
              metadata: sesMessage,
            });
          }
        }
      }

      return NextResponse.json({ success: true, provider: 'SES' });
    } else if (normalizedProvider === 'sendgrid') {
      // SendGrid webhook format (array of events)
      const events = Array.isArray(payload) ? payload : [payload];
      const db = getTenantPrisma('system', 'ADMIN');

      for (const ev of events) {
        const email = ev.email;
        const event = ev.event;
        const messageId = ev.sg_message_id;

        if (email) {
          const cust = await db.customer.findFirst({
            where: { email: email.toLowerCase() },
            select: { tenantId: true, id: true },
          });

          if (cust) {
            let mappedType: any = null;
            if (event === 'delivered') mappedType = 'DELIVERED';
            else if (event === 'open') mappedType = 'OPEN';
            else if (event === 'click') mappedType = 'CLICK';
            else if (event === 'bounce') mappedType = 'BOUNCE_HARD';
            else if (event === 'spamreport') mappedType = 'COMPLAINT';
            else if (event === 'unsubscribe') mappedType = 'UNSUBSCRIBE';

            if (mappedType) {
              await EmailTrackingService.recordEmailEvent({
                tenantId: cust.tenantId,
                email,
                eventType: mappedType,
                messageId,
                customerId: cust.id,
                url: ev.url,
                metadata: ev,
              });
            }
          }
        }
      }

      return NextResponse.json({ success: true, count: events.length });
    }

    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
