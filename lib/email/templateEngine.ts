/**
 * Email Template Personalization Engine
 * Supports merge tags with fallbacks: {{first_name | "there"}}, {{attribute}}, conditional blocks {{#if ...}}...{{/if}}
 * and plain-text conversion.
 */

export interface MergeContext {
  [key: string]: any;
}

export class EmailTemplateEngine {
  /**
   * Render HTML and plain text with merge tag resolution and conditional blocks.
   * Syntax supported:
   * 1. {{key | "default_value"}} or {{key}}
   * 2. {{#if key}} content {{/if}} or {{#if key}} content {{else}} fallback {{/if}}
   */
  static render(content: string, context: MergeContext = {}): string {
    if (!content) return '';

    let output = content;

    // 1. Process conditional blocks: {{#if condition}}...{{else}}...{{/if}}
    const ifElseRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    output = output.replace(ifElseRegex, (_, key, truthyVal, falsyVal) => {
      const val = context[key];
      return val && val !== 'false' && val !== 0 ? truthyVal : falsyVal;
    });

    // 2. Process simple conditional blocks: {{#if condition}}...{{/if}}
    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    output = output.replace(ifRegex, (_, key, truthyVal) => {
      const val = context[key];
      return val && val !== 'false' && val !== 0 ? truthyVal : '';
    });

    // 3. Process merge tags with fallback: {{key | "fallback"}}
    const fallbackRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\|\s*["']([^"']*)["']\s*\}\}/g;
    output = output.replace(fallbackRegex, (_, key, fallback) => {
      const val = context[key];
      return val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : fallback;
    });

    // 4. Process standard merge tags: {{key}}
    const tagRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    output = output.replace(tagRegex, (_, key) => {
      const val = context[key];
      return val !== undefined && val !== null ? String(val) : '';
    });

    return output;
  }

  /**
   * Convert responsive HTML into clean, formatted plain text.
   * Standard library regex approach without external bloat.
   */
  static htmlToPlainText(html: string): string {
    if (!html) return '';

    let text = html;

    // Strip script and style blocks
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Replace line break tags
    text = text.replace(/<br\s*[\/]?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');

    // Convert links: <a href="url">text</a> -> text (url)
    text = text.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)');

    // Strip all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode standard HTML entities
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Clean up excessive whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s+\n/g, '\n\n');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text.trim();
  }

  /**
   * Run pre-send deliverability and safety checklist
   */
  static validatePreSend(params: {
    subject: string;
    htmlBody: string;
    senderEmail?: string;
  }): {
    passed: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const { subject, htmlBody, senderEmail } = params;

    if (!subject || !subject.trim()) {
      errors.push('Subject line is required.');
    } else if (subject.length > 100) {
      warnings.push('Subject line is over 100 characters. Shorter subject lines (30-50 chars) have higher open rates.');
    }

    if (!htmlBody || !htmlBody.trim()) {
      errors.push('Email body cannot be empty.');
    }

    // Check for unsubscribe link or placeholder
    const lowerBody = (htmlBody || '').toLowerCase();
    const hasUnsubscribe =
      lowerBody.includes('unsubscribe') ||
      lowerBody.includes('{{unsubscribe_url}}') ||
      lowerBody.includes('opt-out');

    if (!hasUnsubscribe) {
      errors.push('Missing mandatory Unsubscribe link or {{unsubscribe_url}} tag in body (CAN-SPAM / GDPR violation).');
    }

    // Check for sender address requirement
    const hasAddress =
      lowerBody.includes('{{sender_address}}') ||
      lowerBody.includes('address') ||
      lowerBody.includes('suite') ||
      lowerBody.includes('street') ||
      lowerBody.includes('p.o. box');

    if (!hasAddress) {
      warnings.push('Recommended: Include physical postal address or {{sender_address}} in footer for CAN-SPAM compliance.');
    }

    // Check spam trigger words in subject
    const spamWords = ['100% free', 'make money fast', 'act now!!!', 'risk free', 'winner!!!', 'earn $$$'];
    const lowerSubject = (subject || '').toLowerCase();
    for (const word of spamWords) {
      if (lowerSubject.includes(word)) {
        warnings.push(`Spam alert: Subject line contains potential spam trigger phrase "${word}".`);
      }
    }

    // Check broken or empty hrefs
    const emptyHrefRegex = /href=["'](#|javascript:void\(0\)|)["']/gi;
    if (emptyHrefRegex.test(htmlBody || '')) {
      warnings.push('Email contains empty or placeholder links (href="#" or empty).');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }
}
