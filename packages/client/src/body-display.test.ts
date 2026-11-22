import { describe, expect, it } from 'vitest';
import { describeBody } from './body-display';

describe('describeBody', () => {
  it('reports no body', () => {
    expect(describeBody(undefined)).toEqual({ kind: 'none' });
  });

  it('pretty-prints JSON', () => {
    expect(describeBody({ mimeType: 'application/json', text: '{"a":[1,2]}' })).toEqual({
      kind: 'text',
      text: '{\n  "a": [\n    1,\n    2\n  ]\n}',
      language: 'json',
    });
  });

  it('detects JSON from the content when the MIME type does not say so', () => {
    const display = describeBody({ mimeType: 'text/plain', text: '[1]' });
    expect(display).toMatchObject({ kind: 'text', language: 'json' });
  });

  it('shows invalid JSON as plain text', () => {
    expect(describeBody({ mimeType: 'application/json', text: '{broken' })).toEqual({
      kind: 'text',
      text: '{broken',
      language: 'plaintext',
    });
  });

  it('keeps text and html as they are', () => {
    expect(describeBody({ mimeType: 'text/html', text: '<p>x</p>' })).toEqual({
      kind: 'text',
      text: '<p>x</p>',
      language: 'html',
    });
  });

  it('tells apart an empty body and an unrecorded body', () => {
    expect(describeBody({ mimeType: 'text/plain', text: '' })).toEqual({ kind: 'empty' });
    const unrecorded = describeBody({ mimeType: 'application/json', size: 2048 });
    expect(unrecorded).toMatchObject({ kind: 'message' });
    expect((unrecorded as { message: string }).message).toContain('2.0 KB');
  });

  it('does not show Base64 content', () => {
    const display = describeBody({
      mimeType: 'image/png',
      text: 'iVBORw0KGgo=',
      encoding: 'base64',
      size: 8,
    });
    expect(display).toMatchObject({ kind: 'message' });
  });

  it('lists form parameters', () => {
    expect(
      describeBody({
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          { name: 'a', value: '1' },
          { name: 'b', value: '2' },
        ],
      }),
    ).toEqual({ kind: 'text', text: 'a=1\nb=2', language: 'plaintext' });
  });
});
