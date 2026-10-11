import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant';
import { getTenantAIClient } from '@/lib/ai/client';

export async function POST(req: Request) {
  try {
    const { tenantId } = await getTenantContext();

    const body = await req.json();
    const {
      action, // 'generate_subject' | 'draft_body' | 'improve_tone' | 'translate'
      topic,
      currentSubject,
      currentBody,
      tone = 'professional and engaging',
      targetLanguage = 'Spanish',
      audience = 'potential insurance and financial clients',
    } = body;

    const ai = await getTenantAIClient(tenantId, true);

    let systemInstruction = `You are an expert enterprise email copywriter specializing in high-converting email marketing campaigns benchmarked against Klaviyo and Brevo.`;
    let userPrompt = '';

    if (action === 'generate_subject') {
      userPrompt = `Generate 5 high-converting, spam-filter safe email subject line variants for an email campaign about: "${topic || currentSubject}".
Audience: ${audience}.
Tone: ${tone}.
Include 1-2 variants with curiosity, 1 with urgency, and 1 direct variant.
Return ONLY a valid JSON array of strings, e.g. ["Variant 1", "Variant 2", "Variant 3", "Variant 4", "Variant 5"]. No other markdown or conversational commentary.`;
    } else if (action === 'draft_body') {
      userPrompt = `Draft a modern, responsive HTML email marketing body for an email about: "${topic}".
Audience: ${audience}.
Tone: ${tone}.
Use standard semantic HTML elements (h1, p, a, div, table). Include personal merge tags like {{first_name | "there"}}, {{policy_number}}, and a footer with a {{unsubscribe_url}} and {{sender_address}}.
Keep it punchy, clear, and focused on 1 primary call to action.
Return ONLY clean HTML inside an <div> container.`;
    } else if (action === 'improve_tone') {
      userPrompt = `Rewrite the following email copy to make it more ${tone}. Preserve merge tags like {{first_name}} and links.
Current copy:
"""${currentBody}"""

Return ONLY the rewritten HTML or text.`;
    } else if (action === 'translate') {
      userPrompt = `Translate the following email copy into ${targetLanguage}. Maintain all merge tags (e.g. {{first_name | "there"}}), URLs, and formatting untouched.
Content:
"""${currentBody || currentSubject}"""

Return ONLY the translated content.`;
    } else {
      return NextResponse.json({ error: 'Invalid AI action.' }, { status: 400 });
    }

    const aiResponse = await ai.generateChat([
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ]);

    let parsedResult: any = aiResponse;
    if (action === 'generate_subject') {
      try {
        const cleaned = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedResult = JSON.parse(cleaned);
      } catch {
        parsedResult = aiResponse
          .split('\n')
          .filter((line: string) => line.trim().length > 0)
          .map((line: string) => line.replace(/^[-*\d.)\s]+/, '').trim());
      }
    }

    return NextResponse.json({
      success: true,
      action,
      result: parsedResult,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI generation error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
