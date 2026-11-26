import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import { currentTheme } from './theme';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    return label === 'json' ? new JsonWorker() : new EditorWorker();
  },
};

// Monaco's theme is global. Follow the page theme, now and whenever it changes.
const monacoTheme = () => (currentTheme() === 'dark' ? 'vs-dark' : 'vs');
monaco.editor.setTheme(monacoTheme());
new MutationObserver(() => monaco.editor.setTheme(monacoTheme())).observe(
  document.documentElement,
  { attributes: true, attributeFilter: ['data-theme'] },
);

export { monaco };
