import { getTenantPrisma } from '@/lib/db';

export interface AbTestEvaluationResult {
  campaignId: string;
  winner: 'A' | 'B' | 'TIE';
  metric: 'CLICKS' | 'OPENS';
  variantA: { sent: number; opens: number; clicks: number; conversionRate: number };
  variantB: { sent: number; opens: number; clicks: number; conversionRate: number };
  message: string;
}

export class AbTestingService {
  /**
   * Split customer recipients deterministically between Variant A and Variant B.
   */
  static splitRecipients<T>(recipients: T[], splitPercent: number = 50): { variantA: T[]; variantB: T[] } {
    const variantA: T[] = [];
    const variantB: T[] = [];

    const threshold = Math.max(10, Math.min(90, splitPercent));

    recipients.forEach((item, idx) => {
      // Deterministic round-robin / percentage allocation
      if ((idx % 100) < threshold) {
        variantA.push(item);
      } else {
        variantB.push(item);
      }
    });

    return { variantA, variantB };
  }

  /**
   * Pure calculation helper for determining winner from email events.
   */
  static calculateWinner(
    events: Array<{ eventType: string; metadata?: any }>,
    metric: 'CLICKS' | 'OPENS' = 'CLICKS',
    totalSent: number = 0
  ): {
    winner: 'A' | 'B' | 'TIE';
    variantA: { sent: number; opens: number; clicks: number; conversionRate: number };
    variantB: { sent: number; opens: number; clicks: number; conversionRate: number };
    message: string;
  } {
    let aOpens = 0, aClicks = 0, aSent = 0;
    let bOpens = 0, bClicks = 0, bSent = 0;

    events.forEach((ev) => {
      const meta = ev.metadata as any;
      const variant = meta?.variant || 'A';
      if (variant === 'B') {
        if (ev.eventType === 'DELIVERED') bSent++;
        if (ev.eventType === 'OPEN') bOpens++;
        if (ev.eventType === 'CLICK') bClicks++;
      } else {
        if (ev.eventType === 'DELIVERED') aSent++;
        if (ev.eventType === 'OPEN') aOpens++;
        if (ev.eventType === 'CLICK') aClicks++;
      }
    });

    if (aSent === 0 && totalSent > 0) aSent = Math.ceil(totalSent / 2);
    if (bSent === 0 && totalSent > 0) bSent = Math.floor(totalSent / 2);

    const scoreA = metric === 'CLICKS' ? aClicks : aOpens;
    const scoreB = metric === 'CLICKS' ? bClicks : bOpens;

    let winner: 'A' | 'B' | 'TIE' = 'TIE';
    if (scoreA > scoreB) winner = 'A';
    else if (scoreB > scoreA) winner = 'B';

    const rateA = aSent > 0 ? (scoreA / aSent) * 100 : 0;
    const rateB = bSent > 0 ? (scoreB / bSent) * 100 : 0;

    return {
      winner,
      variantA: {
        sent: aSent,
        opens: aOpens,
        clicks: aClicks,
        conversionRate: Number(rateA.toFixed(2)),
      },
      variantB: {
        sent: bSent,
        opens: bOpens,
        clicks: bClicks,
        conversionRate: Number(rateB.toFixed(2)),
      },
      message:
        winner === 'TIE'
          ? 'Performance is currently even between Variant A and Variant B.'
          : `Variant ${winner} won with ${winner === 'A' ? scoreA : scoreB} ${metric.toLowerCase()} (${winner === 'A' ? rateA.toFixed(1) : rateB.toFixed(1)}% conversion).`,
    };
  }

  /**
   * Evaluates performance of an active A/B test campaign and picks the winner.
   */
  static async evaluateAbWinner(tenantId: string, campaignId: string): Promise<AbTestEvaluationResult> {
    const db = getTenantPrisma(tenantId, 'ADMIN');

    const campaign = await db.broadcastCampaign.findUnique({
      where: { id: campaignId, tenantId },
    });

    if (!campaign || !campaign.isAbTest) {
      throw new Error('Campaign is not configured as an A/B test.');
    }

    const events = await db.emailEvent.findMany({
      where: { campaignId, tenantId },
      select: { eventType: true, metadata: true },
    });

    const metric = (campaign.abWinnerMetric || 'CLICKS') as 'CLICKS' | 'OPENS';
    const result = this.calculateWinner(events, metric, campaign.sent);

    if (result.winner !== 'TIE') {
      await db.broadcastCampaign.update({
        where: { id: campaignId },
        data: { abWinnerSelected: result.winner },
      });
    }

    return {
      campaignId,
      metric,
      ...result,
    };
  }
}
