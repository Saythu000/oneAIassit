import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantPrisma } from '@/lib/db';

export async function GET() {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);

    let journeys = await db.crossChannelJourney.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    // Seed default cross-channel journeys if empty for this tenant
    if (journeys.length === 0) {
      const defaultJourneys = [
        {
          tenantId,
          name: 'Multi-Channel Lead Welcome (WhatsApp + Email Fallback)',
          description: 'Engages new leads on WhatsApp; if not read in 24 hours, automatically falls back to an Email quote summary.',
          triggerType: 'CONTACT_CREATED' as const,
          status: 'ACTIVE' as const,
          frequencyCapDays: 1,
          quietHoursStart: '21:00',
          quietHoursEnd: '08:00',
          exitConditions: ['CONVERTED', 'UNSUBSCRIBED'],
          enrolledCount: 142,
          completedCount: 98,
          steps: [
            { id: 's1', type: 'SEND_WHATSAPP', channel: 'WHATSAPP', templateName: 'welcome_quote_summary' },
            { id: 's2', type: 'WAIT_DELAY', delayHours: 24 },
            {
              id: 's3',
              type: 'BRANCH_CONDITION',
              conditionType: 'WHATSAPP_UNREAD_24H',
              onTrueStepIndex: 5, // Read -> Skip to complete
              onFalseStepIndex: 3, // Unread -> Fallback to Email
            },
            {
              id: 's4',
              type: 'SEND_EMAIL',
              channel: 'EMAIL',
              subject: 'Your Apex Insurance Coverage Overview & Quote',
            },
            { id: 's5', type: 'ADD_TAG', tagName: 'Cross-Channel Contacted' },
          ],
        },
        {
          tenantId,
          name: 'Email Click to WhatsApp Advisor Follow-Up',
          description: 'Triggers when a prospect clicks any quote link in an email; immediately schedules an advisor follow-up on WhatsApp.',
          triggerType: 'EMAIL_LINK_CLICKED' as const,
          status: 'ACTIVE' as const,
          frequencyCapDays: 1,
          quietHoursStart: '21:00',
          quietHoursEnd: '08:00',
          exitConditions: ['CONVERTED'],
          enrolledCount: 64,
          completedCount: 52,
          steps: [
            { id: 's1', type: 'WAIT_DELAY', delayHours: 2 },
            { id: 's2', type: 'SEND_WHATSAPP', channel: 'WHATSAPP', templateName: 'advisor_quote_assistant' },
            { id: 's3', type: 'HANDOFF_TO_HUMAN' },
          ],
        },
        {
          tenantId,
          name: 'Post-Checkout Policy Welcome & Care Guide',
          description: 'Sends formal policy documents by email, followed by a WhatsApp service onboarding nudge.',
          triggerType: 'TAG_ADDED' as const,
          triggerConfig: { tag: 'Active Insured' },
          status: 'ACTIVE' as const,
          frequencyCapDays: 2,
          quietHoursStart: '21:00',
          quietHoursEnd: '08:00',
          exitConditions: ['UNSUBSCRIBED'],
          enrolledCount: 210,
          completedCount: 205,
          steps: [
            { id: 's1', type: 'SEND_EMAIL', channel: 'EMAIL', subject: 'Your Policy Schedule & Digital ID Card' },
            { id: 's2', type: 'WAIT_DELAY', delayHours: 72 },
            { id: 's3', type: 'SEND_WHATSAPP', channel: 'WHATSAPP', templateName: 'claim_portal_guide' },
          ],
        },
      ];

      for (const dj of defaultJourneys) {
        await db.crossChannelJourney.create({ data: dj });
      }

      journeys = await db.crossChannelJourney.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
    }

    const mapped = journeys.map((j) => {
      const stepsArr = (j.steps as any[]) || [];
      return {
        id: j.id,
        name: j.name,
        description: j.description || '',
        trigger: j.triggerType.replace(/_/g, ' '),
        triggerType: j.triggerType,
        status: j.status,
        stepsCount: stepsArr.length,
        enrolledCount: j.enrolledCount,
        completedCount: j.completedCount,
        frequencyCapDays: j.frequencyCapDays,
        quietHoursStart: j.quietHoursStart,
        quietHoursEnd: j.quietHoursEnd,
        createdAt: j.createdAt.toISOString(),
        steps: stepsArr,
      };
    });

    return NextResponse.json({ success: true, sequences: mapped });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch sequences';
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
      trigger = 'CONTACT_CREATED',
      steps = [],
      frequencyCapDays = 1,
      quietHoursStart = '21:00',
      quietHoursEnd = '08:00',
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Sequence name is required' }, { status: 400 });
    }

    const defaultSteps = steps.length > 0 ? steps : [
      { id: 's1', type: 'SEND_WHATSAPP', channel: 'WHATSAPP', templateName: 'welcome_template' },
      { id: 's2', type: 'WAIT_DELAY', delayHours: 24 },
      { id: 's3', type: 'SEND_EMAIL', channel: 'EMAIL', subject: 'Follow up on your insurance quote' },
    ];

    const journey = await db.crossChannelJourney.create({
      data: {
        tenantId,
        name,
        description: description || '',
        triggerType: trigger as any,
        steps: defaultSteps,
        frequencyCapDays: Number(frequencyCapDays) || 1,
        quietHoursStart,
        quietHoursEnd,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ success: true, sequence: journey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create sequence';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId, role } = await getTenantContext();
    const db = getTenantPrisma(tenantId, role);
    const body = await req.json();
    const { id, status, frequencyCapDays, quietHoursStart, quietHoursEnd } = body;

    if (!id) {
      return NextResponse.json({ error: 'Sequence ID is required' }, { status: 400 });
    }

    const updated = await db.crossChannelJourney.update({
      where: { id, tenantId },
      data: {
        status: status || undefined,
        frequencyCapDays: frequencyCapDays !== undefined ? Number(frequencyCapDays) : undefined,
        quietHoursStart: quietHoursStart !== undefined ? quietHoursStart : undefined,
        quietHoursEnd: quietHoursEnd !== undefined ? quietHoursEnd : undefined,
      },
    });

    return NextResponse.json({ success: true, sequence: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update sequence';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
