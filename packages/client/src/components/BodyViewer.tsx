import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import type { BodyDisplay } from '../body-display';

function MonacoText({ text, language }: { text: string; language: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let instance: editor.IStandaloneCodeEditor | undefined;

    // Monaco is large, so it loads only when a body is shown for the first time.
    void import('../monaco-setup').then(({ monaco }) => {
      if (disposed || !container.current) return;
      instance = monaco.editor.create(container.current, {
        value: text,
        language,
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        renderLineHighlight: 'none',
      });
    });

    return () => {
      disposed = true;
      instance?.dispose();
    };
  }, [text, language]);

  return <div className="monaco-host" ref={container} data-testid="body-editor" />;
}

export function BodyViewer({ display }: { display: BodyDisplay }) {
  switch (display.kind) {
    case 'text':
      return <MonacoText text={display.text} language={display.language} />;
    case 'none':
      return <div className="body-message">No body.</div>;
    case 'empty':
      return <div className="body-message">The body is empty.</div>;
    case 'message':
      return <div className="body-message">{display.message}</div>;
  }
}
