import { getTenantPrisma } from '@/lib/db';
import { EmailSuppressionService } from '@/lib/email/suppression';
import { EmailTemplateEngine } from '@/lib/email/templateEngine';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export type JourneyStepType =
  | 'SEND_EMAIL'
  | 'SEND_WHATSAPP'
  | 'SEND_INSTAGRAM'
  | 'WAIT_DELAY'
  | 'BRANCH_CONDITION'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'UPDATE_ATTRIBUTE'
  | 'HANDOFF_TO_HUMAN';

export interface JourneyStepDefinition {
  id: string;
  type: JourneyStepType;
  channel?: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM';
  templateId?: string;
  templateName?: string;
  subject?: string;
  delayHours?: number;
  conditionType?: 'WHATSAPP_UNREAD_24H' | 'EMAIL_CLICKED' | 'TAG_PRESENT';
  conditionValue?: string;
  onTrueStepIndex?: number;
  onFalseStepIndex?: number;
  tagName?: string;
  attributeKey?: string;
  attributeValue?: string;
}

export class CrossChannelJourneyEngine {
  /**
   * Determine whether current time falls within configured quiet hours.
   */
  static isWithinQuietHours(
    quietHoursStart?: string | null,
    quietHoursEnd?: string | null,
    date: Date = new Date()
  ): { inQuietHours: boolean; resumeAt?: Date } {
    if (!quietHoursStart || !quietHoursEnd) {
      return { inQuietHours: false };
    }

    const [startH, startM] = quietHoursStart.split(':').map(Number);
    const [endH, endM] = quietHoursEnd.split(':').map(Number);

    const currentH = date.getHours();
    const currentM = date.getMinutes();
    const currentMinutes = currentH * 60 + currentM;
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    let inQuietHours = false;
    if (startMinutes > endMinutes) {
      // Overnight range, e.g. 21:00 (1260m) to 08:00 (480m)
      inQuietHours = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Daytime quiet hours range, e.g. 13:00 to 15:00
      inQuietHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    if (!inQuietHours) {
      return { inQuietHours: false };
    }

    // Compute when quiet hours end
    const resumeDate = new Date(date);
    resumeDate.setHours(endH, endM || 0, 0, 0);
    if (resumeDate <= date) {
      // If end hour is already past today, resume is tomorrow
      resumeDate.setDate(resumeDate.getDate() + 1);
    }

    return { inQuietHours: true, resumeAt: resumeDate };
  }

  /**
   * Enrolls a customer into an active cross-channel journey.
   */
  static async enrollCustomer(
    tenantId: string,
    journeyId: string,
    customerId: string
  ): Promise<{ success: boolean; enrollmentId?: string; reason?: string }> {
    const db = getTenantPrisma(tenantId, 'ADMIN');

    const journey = await db.crossChannelJourney.findUnique({
      where: { id: journeyId, tenantId },
    });

    if (!journey || journey.status !== 'ACTIVE') {
      return { success: false, reason: 'Journey is not active or does not exist.' };
    }

    // Check if customer already enrolled
    const existing = await db.journeyEnrollment.findUnique({
      where: {
        journeyId_customerId: { journeyId, customerId },
      },
    });

    if (existing && existing.status === 'IN_PROGRESS') {
      return { success: false, reason: 'Customer is already active in this journey.' };
    }

    const customer = await db.customer.findUnique({
      where: { id: customerId, tenantId },
    });

    if (!customer) {
      return { success: false, reason: 'Customer not found.' };
    }

    // Check frequency cap
    if (journey.frequencyCapDays > 0) {
      const minContactInterval = journey.frequencyCapDays * 24 * 60 * 60 * 1000;
      const recentEnrollment = await db.journeyEnrollment.findFirst({
        where: {
          tenantId,
          customerId,
          lastContactedAt: { gte: new Date(Date.now() - minContactInterval) },
        },
      });

      if (recentEnrollment) {
        return {
          success: false,
          reason: `Frequency cap exceeded: Contacted within ${journey.frequencyCapDays} days across channels.`,
        };
      }
    }

    // Compute initial execution time (taking quiet hours into account)
    let nextExecutionAt = new Date();
    const quietCheck = this.isWithinQuietHours(
      journey.quietHoursStart,
      journey.quietHoursEnd,
      nextExecutionAt
    );
    if (quietCheck.inQuietHours && quietCheck.resumeAt) {
      nextExecutionAt = quietCheck.resumeAt;
    }

    const enrollment = await db.journeyEnrollment.upsert({
      where: {
        journeyId_customerId: { journeyId, customerId },
      },
      create: {
        tenantId,
        journeyId,
        customerId,
        currentStepIndex: 0,
        status: 'IN_PROGRESS',
        nextExecutionAt,
        logs: [
          {
            event: 'ENROLLED',
            timestamp: new Date().toISOString(),
            journeyName: journey.name,
          },
        ],
      },
      update: {
        currentStepIndex: 0,
        status: 'IN_PROGRESS',
        nextExecutionAt,
        logs: [
          {
            event: 'RE_ENROLLED',
            timestamp: new Date().toISOString(),
            journeyName: journey.name,
          },
        ],
      },
    });

    await db.crossChannelJourney.update({
      where: { id: journeyId },
      data: { enrolledCount: { increment: 1 } },
    });

    return { success: true, enrollmentId: enrollment.id };
  }

  /**
   * Executes the next pending step for an enrollment.
   */
  static async executeStep(
    tenantId: string,
    enrollmentId: string
  ): Promise<{ status: string; message: string }> {
    const db = getTenantPrisma(tenantId, 'ADMIN');

    const enrollment = await db.journeyEnrollment.findUnique({
      where: { id: enrollmentId, tenantId },
      include: {
        journey: true,
        customer: {
          include: {
            leads: true,
            emailEvents: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
      },
    });

    if (!enrollment || enrollment.status !== 'IN_PROGRESS') {
      return { status: 'SKIPPED', message: 'Enrollment is not in progress.' };
    }

    const { journey, customer } = enrollment;
    const steps = (journey.steps as unknown as JourneyStepDefinition[]) || [];

    // 1. Exit Conditions Check
    if (customer.optedOutAt || customer.emailConsentStatus === 'UNSUBSCRIBED') {
      await db.journeyEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'EXITED_UNSUBSCRIBED' },
      });
      return { status: 'EXITED', message: 'Contact opted out/unsubscribed.' };
    }

    const exitConditions = (journey.exitConditions as string[]) || [];
    if (exitConditions.includes('CONVERTED')) {
      const isConverted = customer.leads?.some((l) => l.status === 'CONVERTED');
      if (isConverted) {
        await db.journeyEnrollment.update({
          where: { id: enrollmentId },
          data: { status: 'EXITED_CONVERTED' },
        });
        return { status: 'EXITED', message: 'Customer converted to policyholder.' };
      }
    }

    // 2. Quiet Hours Guard
    const quietCheck = this.isWithinQuietHours(
      journey.quietHoursStart,
      journey.quietHoursEnd
    );
    if (quietCheck.inQuietHours && quietCheck.resumeAt) {
      await db.journeyEnrollment.update({
        where: { id: enrollmentId },
        data: { nextExecutionAt: quietCheck.resumeAt },
      });
      return {
        status: 'POSTPONED',
        message: `Postponed until ${quietCheck.resumeAt.toISOString()} due to quiet hours window.`,
      };
    }

    // 3. Completion Check
    if (enrollment.currentStepIndex >= steps.length) {
      await db.journeyEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED' },
      });
      await db.crossChannelJourney.update({
        where: { id: journey.id },
        data: { completedCount: { increment: 1 } },
      });
      return { status: 'COMPLETED', message: 'Journey completed all steps.' };
    }

    const step = steps[enrollment.currentStepIndex];
    let nextIndex = enrollment.currentStepIndex + 1;
    let nextExecution: Date | null = new Date();
    let stepResultDetails: any = {};

    // 4. Step Execution
    switch (step.type) {
      case 'SEND_EMAIL': {
        if (!customer.email || customer.emailConsentStatus !== 'SUBSCRIBED') {
          stepResultDetails = { skipped: true, reason: 'No subscribed email address' };
          break;
        }

        const suppression = await EmailSuppressionService.isEmailSuppressed(tenantId, customer.email);
        if (suppression.suppressed) {
          stepResultDetails = { skipped: true, reason: `Email is suppressed (${suppression.reason})` };
          break;
        }

        let subject = step.subject || 'Important update from your advisor';
        let bodyHtml = `<p>Hello ${customer.displayName || 'there'},</p><p>Here is an update regarding your coverage.</p>`;

        if (step.templateId) {
          const tpl = await db.template.findUnique({
            where: { id: step.templateId, tenantId },
          });
          if (tpl) {
            subject = tpl.subject || subject;
            bodyHtml = tpl.htmlBody || tpl.body;
          }
        }

        const renderedHtml = EmailTemplateEngine.render(bodyHtml, {
          first_name: customer.displayName.split(' ')[0],
          name: customer.displayName,
          email: customer.email,
        });

        const { EmailTransportAdapter } = await import('@/lib/email/EmailTransportAdapter');
        const emailAdapter = new EmailTransportAdapter(tenantId);
        await emailAdapter.sendText(customer.email, renderedHtml);

        stepResultDetails = { channel: 'EMAIL', sentTo: customer.email, subject };
        break;
      }

      case 'SEND_WHATSAPP': {
        if (!customer.primaryPhone || !customer.optedIn) {
          stepResultDetails = { skipped: true, reason: 'Customer has not opted in to WhatsApp' };
          break;
        }

        let messageText = `Hello ${customer.displayName}, thank you for connecting with us!`;
        if (step.templateName) {
          messageText = `[Template: ${step.templateName}] Hello ${customer.displayName}`;
        }

        await sendWhatsAppMessage({
          tenantId,
          customerId: customer.id,
          text: messageText,
        });

        stepResultDetails = { channel: 'WHATSAPP', sentTo: customer.primaryPhone };
        break;
      }

      case 'WAIT_DELAY': {
        const hours = step.delayHours || 24;
        nextExecution = new Date(Date.now() + hours * 3600 * 1000);
        stepResultDetails = { delayedHours: hours, resumeAt: nextExecution.toISOString() };
        break;
      }

      case 'BRANCH_CONDITION': {
        // Cross-Channel Fallback Logic
        if (step.conditionType === 'WHATSAPP_UNREAD_24H') {
          // Check if previous WhatsApp message was read within 24h
          const recentMsg = await db.message.findFirst({
            where: {
              tenantId,
              conversation: { customerId: customer.id },
              channel: 'WHATSAPP',
              direction: 'OUTBOUND',
              createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
          });

          const isRead = recentMsg?.status === 'READ';
          if (!isRead && step.onFalseStepIndex !== undefined) {
            // Take cross-channel fallback (e.g. Email fallback)
            nextIndex = step.onFalseStepIndex;
            stepResultDetails = {
              fallbackTaken: true,
              condition: 'WHATSAPP_UNREAD_24H',
              routedToStep: nextIndex,
            };
          } else if (step.onTrueStepIndex !== undefined) {
            nextIndex = step.onTrueStepIndex;
            stepResultDetails = { condition: 'WHATSAPP_READ', routedToStep: nextIndex };
          }
        } else if (step.conditionType === 'EMAIL_CLICKED') {
          const hasClicked = customer.emailEvents?.some((e) => e.eventType === 'CLICK');
          if (hasClicked && step.onTrueStepIndex !== undefined) {
            nextIndex = step.onTrueStepIndex;
            stepResultDetails = { condition: 'EMAIL_CLICKED_TRUE', routedToStep: nextIndex };
          } else if (!hasClicked && step.onFalseStepIndex !== undefined) {
            nextIndex = step.onFalseStepIndex;
            stepResultDetails = { condition: 'EMAIL_CLICKED_FALSE', routedToStep: nextIndex };
          }
        } else if (step.conditionType === 'TAG_PRESENT' && step.conditionValue) {
          const hasTag = customer.tags.includes(step.conditionValue);
          if (hasTag && step.onTrueStepIndex !== undefined) {
            nextIndex = step.onTrueStepIndex;
          } else if (!hasTag && step.onFalseStepIndex !== undefined) {
            nextIndex = step.onFalseStepIndex;
          }
        }
        break;
      }

      case 'ADD_TAG': {
        if (step.tagName && !customer.tags.includes(step.tagName)) {
          await db.customer.update({
            where: { id: customer.id },
            data: { tags: { push: step.tagName } },
          });
          stepResultDetails = { tagAdded: step.tagName };
        }
        break;
      }

      case 'REMOVE_TAG': {
        if (step.tagName) {
          const updatedTags = customer.tags.filter((t) => t !== step.tagName);
          await db.customer.update({
            where: { id: customer.id },
            data: { tags: updatedTags },
          });
          stepResultDetails = { tagRemoved: step.tagName };
        }
        break;
      }

      case 'HANDOFF_TO_HUMAN': {
        await db.conversation.updateMany({
          where: { tenantId, customerId: customer.id, status: 'OPEN' },
          data: { status: 'PENDING' },
        });
        stepResultDetails = { handoff: true, reason: 'Escalated to human advisor' };
        break;
      }

      default:
        break;
    }

    // 5. Update Enrollment State
    const existingLogs = Array.isArray(enrollment.logs) ? (enrollment.logs as any[]) : [];
    existingLogs.push({
      stepIndex: enrollment.currentStepIndex,
      stepType: step.type,
      executedAt: new Date().toISOString(),
      details: stepResultDetails,
    });

    const isFinished = nextIndex >= steps.length;
    await db.journeyEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStepIndex: nextIndex,
        status: isFinished ? 'COMPLETED' : 'IN_PROGRESS',
        lastContactedAt:
          step.type === 'SEND_EMAIL' || step.type === 'SEND_WHATSAPP' || step.type === 'SEND_INSTAGRAM'
            ? new Date()
            : enrollment.lastContactedAt,
        nextExecutionAt: isFinished ? null : nextExecution,
        logs: existingLogs,
      },
    });

    if (isFinished) {
      await db.crossChannelJourney.update({
        where: { id: journey.id },
        data: { completedCount: { increment: 1 } },
      });
    }

    return {
      status: isFinished ? 'COMPLETED' : 'STEP_EXECUTED',
      message: `Step ${step.type} executed. Next step: ${isFinished ? 'None (Completed)' : nextIndex}.`,
    };
  }

  /**
   * Process all pending enrollments due for execution.
   */
  static async processDueEnrollments(tenantId: string): Promise<{ processed: number }> {
    const db = getTenantPrisma(tenantId, 'ADMIN');

    const dueEnrollments = await db.journeyEnrollment.findMany({
      where: {
        tenantId,
        status: 'IN_PROGRESS',
        nextExecutionAt: { lte: new Date() },
      },
      take: 20,
    });

    let processed = 0;
    for (const enrollment of dueEnrollments) {
      try {
        await this.executeStep(tenantId, enrollment.id);
        processed++;
      } catch (err) {
        console.error(`Error processing journey enrollment ${enrollment.id}:`, err);
      }
    }

    return { processed };
  }
}
