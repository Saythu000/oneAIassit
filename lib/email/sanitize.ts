/**
 * Lightweight, zero-dependency HTML sanitizer for inbound email rendering.
 * Defends against XSS by removing executable scripts, object/iframe tags,
 * and malicious event handler attributes.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  let sanitized = rawHtml;

  // 1. Remove dangerous script, iframe, object, embed, and style tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 2. Strip inline event handlers (onerror=, onclick=, onload=, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(['\"]).*?\1/gi, '');
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, '');

  // 3. Neutralize javascript: and vbscript: URIs in href and src
  sanitized = sanitized.replace(/(href|src)\s*=\s*(['\"])\s*(javascript|vbscript):/gi, '$1=$2#blocked:');

  // 4. Ensure all links open safely in new window
  sanitized = sanitized.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  return sanitized.trim();
}
