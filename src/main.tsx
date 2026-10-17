import { Component, StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = document.getElementById('root')!;

function ErrorBox({ message }: { message: string }) {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 640, margin: '48px auto', padding: 20, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 12, color: '#7f1d1d' }}>
      <h2 style={{ margin: '0 0 8px' }}>Something went wrong</h2>
      <p style={{ margin: '0 0 12px' }}>The page could not start. Please send this message to support:</p>
      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 13 }}>{message}</pre>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: String((e as any)?.message || e) };
  }
  render() {
    if (this.state.error) return <ErrorBox message={this.state.error} />;
    return this.props.children;
  }
}

const reactRoot = createRoot(root);

import('./App.tsx')
  .then(({ default: App }) => {
    reactRoot.render(
      <StrictMode>
        <Boundary>
          <App />
        </Boundary>
      </StrictMode>
    );
  })
  .catch((e) => {
    reactRoot.render(<ErrorBox message={String(e?.message || e)} />);
  });
