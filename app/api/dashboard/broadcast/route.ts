import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

function buildDateFilter(start?: string | null, end?: string | null) {
  let gte: Date | undefined;
  let lte: Date | undefined;

  if (start && start.trim()) {
    const d = new Date(start.includes('T') ? start : `${start}T00:00:00`);
    if (!isNaN(d.getTime())) gte = d;
  }

  if (end && end.trim()) {
    const d = new Date(end.includes('T') ? end : `${end}T23:59:59.999`);
    if (!isNaN(d.getTime())) lte = d;
  }

  if (!gte && !lte) return null;

  const dateCond: any = {};
  if (gte) dateCond.gte = gte;
  if (lte) dateCond.lte = lte;

  return {
    OR: [
      { createdAt: dateCond },
      { leads: { some: { createdAt: dateCond } } },
    ],
  };
}

function buildTagFilter(value: string) {
  const v = value.trim();
  if (!v) return null;
  const variants = Array.from(new Set([
    v,
    v.toUpperCase(),
    v.toLowerCase(),
    v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(),
  ]));
  return {
    tags: {
      hasSome: variants,
    },
  };
}

export async function GET(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    const url = new URL(req.url);
    if (url.searchParams.get('preview') === 'true') {
      const type = (url.searchParams.get('type') || 'all') as any;
      const value = url.searchParams.get('value') || '';
      const start = url.searchParams.get('start') || '';
      const end = url.searchParams.get('end') || '';
      const emailActivity = (url.searchParams.get('emailActivity') || undefined) as any;
      const channel = (url.searchParams.get('channel') || 'WHATSAPP') as any;

      const { SegmentationService } = await import('@/lib/email/segmentation');
      const filter: any = {
        type: type === 'email_engagement' ? 'email_engagement' : type,
        value: type === 'date_range' ? { start, end } : value,
        emailActivity: emailActivity || (type === 'email_engagement' ? (value as any) : undefined),
      };

      const { audienceCount, optedOutCount } = await SegmentationService.countSegmentAudience(
        tenantId,
        filter,
        channel
      );

      return NextResponse.json({ recipientCount: audienceCount, optedOutCount });
    }

    const channelFilter = url.searchParams.get('channel');
    const where: any = { tenantId };
    if (channelFilter && channelFilter !== 'ALL') {
      where.channel = channelFilter;
    }

    const campaigns = await db.broadcastCampaign.findMany({
      where,
      include: { template: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(campaigns);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
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
      channel = 'WHATSAPP',
      templateId,
      recipientFilter,
      scheduledAt,
      subject,
      previewText,
      senderName,
      senderEmail,
      replyTo,
      isAbTest = false,
      abSubjectB,
      abSenderNameB,
      abTemplateIdB,
      abTestSplit = 50,
      abWinnerMetric = 'CLICKS',
      abDurationHours = 4,
    } = body;

    if (!name || !templateId || !recipientFilter) {
      return NextResponse.json(
        { error: 'Campaign name, template ID, and recipient filters are required' },
        { status: 400 }
      );
    }

    // 0. Auto-pause deliverability circuit breaker check
    if (channel === 'EMAIL') {
      const emailConfig = await db.tenantEmailConfig.findUnique({ where: { tenantId } });
      if (emailConfig?.isAutoPaused) {
        return NextResponse.json(
          { error: 'Email sending is currently paused due to high spam complaints (≥0.3%). Review your list and resume in Channel Settings.' },
          { status: 403 }
        );
      }
    }

    // 1. Fetch template
    const template = await db.template.findUnique({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    let templateB = null;
    if (isAbTest && abTemplateIdB) {
      templateB = await db.template.findUnique({
        where: { id: abTemplateIdB, tenantId },
      });
    }

    // 2. Query target customers based on unified segmentation
    const { SegmentationService } = await import('@/lib/email/segmentation');
    const whereClause = await SegmentationService.buildUnifiedCustomerFilter(
      tenantId,
      recipientFilter,
      channel as any
    );

    const customers = await db.customer.findMany({
      where: whereClause,
      include: {
        activePolicy: true,
      },
    });

    // 3. Compute cost estimate
    let pricePerMessage = 0.020; // Default WHATSAPP MARKETING
    if (channel === 'EMAIL') {
      pricePerMessage = 0.001; // Typical transactional/marketing email unit cost (~$1/1000)
    } else if (template.category === 'UTILITY') {
      pricePerMessage = 0.010;
    } else if (template.category === 'AUTHENTICATION') {
      pricePerMessage = 0.005;
    }
    const estimatedCost = customers.length * pricePerMessage;

    // 4. Create Campaign record
    const campaignStatus = scheduledAt ? 'QUEUED' : 'COMPLETED';
    const campaign = await db.broadcastCampaign.create({
      data: {
        tenantId,
        name,
        channel: channel as any,
        templateId,
        subject: subject || template.subject || null,
        previewText: previewText || template.previewText || null,
        senderName: senderName || null,
        senderEmail: senderEmail || null,
        replyTo: replyTo || null,
        recipientFilter,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: campaignStatus,
        sent: customers.length,
        cost: estimatedCost,
        isAbTest: Boolean(isAbTest),
        abSubjectB: abSubjectB || null,
        abSenderNameB: abSenderNameB || null,
        abTemplateIdB: abTemplateIdB || null,
        abTestSplit: abTestSplit ? Number(abTestSplit) : 50,
        abWinnerMetric: abWinnerMetric || 'CLICKS',
        abDurationHours: abDurationHours ? Number(abDurationHours) : 4,
      },
    });

    // 5. If sending now, create job stubs and dispatch
    if (!scheduledAt) {
      await db.broadcastCampaign.update({
        where: { id: campaign.id },
        data: {
          delivered: 0,
          read: 0,
          replied: 0,
          converted: 0,
          failed: 0,
        },
      });

      if (channel === 'EMAIL') {
        const { EmailTransportAdapter } = await import('@/lib/email/EmailTransportAdapter');
        const emailTransport = new EmailTransportAdapter(tenantId);
        const { AbTestingService } = await import('@/lib/email/abTesting');

        const { variantA, variantB } = isAbTest
          ? AbTestingService.splitRecipients(customers, abTestSplit)
          : { variantA: customers, variantB: [] };

        const dispatchBatch = async (batch: typeof customers, variantLabel: 'A' | 'B') => {
          const activeTpl = variantLabel === 'B' && templateB ? templateB : template;
          const activeSubject = variantLabel === 'B' && abSubjectB ? abSubjectB : (campaign.subject || template.name);

          for (const customer of batch) {
            if (!customer.email) continue;

            const job = await db.broadcastJob.create({
              data: {
                tenantId,
                campaignId: campaign.id,
                customerId: customer.id,
                status: 'SENT',
                scheduledFor: new Date(),
                processedAt: new Date(),
              },
            });

            let conversation = await db.conversation.findFirst({
              where: { tenantId, customerId: customer.id, channel: 'EMAIL' },
            });

            if (!conversation) {
              conversation = await db.conversation.create({
                data: {
                  tenantId,
                  customerId: customer.id,
                  channel: 'EMAIL',
                  status: 'OPEN',
                },
              });
            }

            const rawBody = activeTpl.htmlBody || activeTpl.body || '';
            const personalContext = {
              name: customer.displayName,
              first_name: customer.displayName.split(' ')[0],
              last_name: customer.displayName.split(' ').slice(1).join(' ') || '',
              email: customer.email,
              policy_number: customer.activePolicy?.policyNumber || 'POL-58472',
              unsubscribe_url: `https://${req.headers.get('host') || 'localhost:3000'}/api/unsubscribe?cid=${customer.id}`,
              sender_address: '100 Innovation Way, Suite 400, San Francisco, CA 94107',
            };

            const { EmailTemplateEngine } = await import('@/lib/email/templateEngine');
            const renderedHtml = EmailTemplateEngine.render(rawBody, personalContext);

            try {
              await emailTransport.sendText(customer.email, renderedHtml);
            } catch (sendErr) {
              console.error(`[Email Broadcast] Failed to send to ${customer.email}:`, sendErr);
              await db.broadcastJob.update({
                where: { id: job.id },
                data: { status: 'FAILED', lastError: sendErr instanceof Error ? sendErr.message : String(sendErr) },
              });
            }
          }
        };

        await dispatchBatch(variantA, 'A');
        if (variantB.length > 0) {
          await dispatchBatch(variantB, 'B');
        }
      } else {
        // Send real WhatsApp message via whatsapp-engine HTTP Service
        for (const customer of customers) {
          const job = await db.broadcastJob.create({
            data: {
              tenantId,
              campaignId: campaign.id,
              customerId: customer.id,
              status: 'SENT',
              scheduledFor: new Date(),
              processedAt: new Date(),
            },
          });

          // Resolve personalizations
          let messageContent = template.body
            .replace(/\{\{name\}\}/g, customer.displayName)
            .replace(/\{\{policy_number\}\}/g, customer.activePolicy?.policyNumber || 'POL-58472')
            .replace(/\{\{last_interaction\}\}/g, '2 days ago')
            .replace(/\{\{due_date\}\}/g, customer.activePolicy?.expiryDate 
              ? new Date(customer.activePolicy.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Oct 24, 2026'
            );

          if (template.header) {
            messageContent = `*${template.header}*\n\n${messageContent}`;
          }
          if (template.footer) {
            messageContent = `${messageContent}\n\n_${template.footer}_`;
          }

          try {
            await sendWhatsAppMessage({
              tenantId,
              customerId: customer.id,
              text: messageContent,
              campaignId: campaign.id,
              broadcastJobId: job.id,
            });
          } catch (engineErr) {
            console.warn(`[Broadcast Engine] WhatsApp dispatch notice for customer ${customer.id}:`, engineErr instanceof Error ? engineErr.message : engineErr);
            
            let conversation = await db.conversation.findFirst({
              where: { tenantId, customerId: customer.id, channel: 'WHATSAPP' },
            });

            if (!conversation) {
              conversation = await db.conversation.create({
                data: {
                  tenantId,
                  customerId: customer.id,
                  channel: 'WHATSAPP',
                  status: 'OPEN',
                },
              });
            }

            await db.message.create({
              data: {
                tenantId,
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                senderType: 'BOT',
                content: messageContent,
                channel: 'WHATSAPP',
              },
            });
          }
        }
      }

      // Log action to compliance AuditLog
      await db.auditLog.create({
        data: {
          tenantId,
          userId: (await getTenantContext()).userId,
          action: 'CAMPAIGN_SENT',
          metadata: {
            campaignId: campaign.id,
            campaignName: campaign.name,
            recipientsCount: customers.length,
            cost: estimatedCost,
          },
        },
      });
    }

    return NextResponse.json({ success: true, campaignId: campaign.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
