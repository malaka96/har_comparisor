import { Group, Panel, Separator } from 'react-resizable-panels';
import { HarPane } from './components/HarPane';

export function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>HAR Comparisor</h1>
        <span className="subtitle">Load the legacy and the new HAR file</span>
      </header>
      <main className="app-main">
        <Group orientation="horizontal">
          <Panel id="legacy" minSize="20%">
            <HarPane side="legacy" title="Legacy" />
          </Panel>
          <Separator className="separator vertical" />
          <Panel id="new" minSize="20%">
            <HarPane side="new" title="New" />
          </Panel>
        </Group>
      </main>
    </div>
  );
}
