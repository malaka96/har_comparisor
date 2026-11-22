import type { NormalizedBody } from '@har-comparisor/shared';
import { formatBytes } from './format';

export type BodyDisplay =
  | { kind: 'none' }
  | { kind: 'empty' }
  | { kind: 'message'; message: string }
  | { kind: 'text'; text: string; language: 'json' | 'xml' | 'html' | 'plaintext' };

function languageFor(mimeType: string, text: string): 'json' | 'xml' | 'html' | 'plaintext' {
  const mime = mimeType.toLowerCase();
  if (mime.includes('json')) return 'json';
  if (mime.includes('html')) return 'html';
  if (mime.includes('xml')) return 'xml';
  const start = text.trimStart()[0];
  return start === '{' || start === '[' ? 'json' : 'plaintext';
}

/** Decides how a body is shown: pretty-printed JSON, plain text, or a short message. */
export function describeBody(body: NormalizedBody | undefined): BodyDisplay {
  if (!body) return { kind: 'none' };

  if (body.text === undefined) {
    if (body.params && body.params.length > 0) {
      const text = body.params.map((p) => `${p.name}=${p.value}`).join('\n');
      return { kind: 'text', text, language: 'plaintext' };
    }
    return {
      kind: 'message',
      message: `The browser did not record the body text${
        body.size ? ` (${formatBytes(body.size)})` : ''
      }.`,
    };
  }

  if (body.encoding === 'base64') {
    return {
      kind: 'message',
      message: `Base64-encoded content (${formatBytes(body.size ?? body.text.length)}). Not shown.`,
    };
  }

  if (body.text === '') return { kind: 'empty' };

  const language = languageFor(body.mimeType, body.text);
  if (language === 'json') {
    try {
      return { kind: 'text', text: JSON.stringify(JSON.parse(body.text), null, 2), language };
    } catch {
      return { kind: 'text', text: body.text, language: 'plaintext' };
    }
  }
  return { kind: 'text', text: body.text, language };
}
