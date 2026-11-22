import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import type { NormalizedBody } from '@har-comparisor/shared';
import { describeBody, type BodyDisplay } from '../body-display';

function displayText(display: BodyDisplay): string {
  switch (display.kind) {
    case 'text':
      return display.text;
    case 'none':
      return '';
    case 'empty':
      return '';
    case 'message':
      return `(${display.message})`;
  }
}

function displayLanguage(a: BodyDisplay, b: BodyDisplay): string {
  const languages = [a, b].flatMap((d) => (d.kind === 'text' ? [d.language] : []));
  if (languages.length === 0) return 'plaintext';
  return languages.every((l) => l === languages[0]) ? (languages[0] as string) : 'plaintext';
}

interface Props {
  legacy: NormalizedBody | undefined;
  next: NormalizedBody | undefined;
}

/** Side-by-side Monaco diff of two bodies. JSON is pretty-printed on both sides. */
export function BodyDiff({ legacy, next }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const legacyDisplay = describeBody(legacy);
  const nextDisplay = describeBody(next);
  const original = displayText(legacyDisplay);
  const modified = displayText(nextDisplay);
  const language = displayLanguage(legacyDisplay, nextDisplay);

  useEffect(() => {
    let disposed = false;
    let instance: editor.IStandaloneDiffEditor | undefined;
    let models: editor.ITextModel[] = [];

    void import('../monaco-setup').then(({ monaco }) => {
      if (disposed || !container.current) return;
      instance = monaco.editor.createDiffEditor(container.current, {
        readOnly: true,
        originalEditable: false,
        renderSideBySide: true,
        automaticLayout: true,
        ignoreTrimWhitespace: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        renderOverviewRuler: true,
      });
      models = [
        monaco.editor.createModel(original, language),
        monaco.editor.createModel(modified, language),
      ];
      instance.setModel({ original: models[0]!, modified: models[1]! });
    });

    return () => {
      disposed = true;
      instance?.dispose();
      for (const model of models) model.dispose();
    };
  }, [original, modified, language]);

  return <div className="monaco-host" ref={container} data-testid="body-diff" />;
}
