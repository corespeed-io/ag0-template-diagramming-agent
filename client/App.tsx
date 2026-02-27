import React, { useEffect, useRef, useState } from 'react';
import { Topbar } from './components/Topbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Editor } from './components/Editor.tsx';
import { useFiles } from './hooks/useFiles.ts';
import { useAutoSave } from './hooks/useAutoSave.ts';

const WS_PORT = window.location.port || '3456';
const WS_URL = `ws://${window.location.hostname}:${WS_PORT}/ws`;

export default function App() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [latestWsEvent, setLatestWsEvent] = useState<MessageEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => console.log('[WS] Connected');
      ws.onmessage = (event) => setLatestWsEvent(event);
      ws.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 2s...');
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = (err) => console.error('[WS] Error:', err);
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Handle file unlink
  useEffect(() => {
    if (!latestWsEvent) return;
    try {
      const event = JSON.parse(latestWsEvent.data);
      if (event.event === 'unlink' && event.path === currentFile) {
        setCurrentFile(null);
      }
    } catch {
      // ignore
    }
  }, [latestWsEvent, currentFile]);

  const { files, loading, createFile } = useFiles(latestWsEvent);
  const { onChange, status: saveStatus } = useAutoSave(currentFile);

  return (
    <div style={styles.app}>
      <Topbar currentFile={currentFile} saveStatus={saveStatus} />
      <div style={styles.body}>
        <Sidebar
          files={files}
          currentFile={currentFile}
          onSelect={setCurrentFile}
          onCreateFile={createFile}
          loading={loading}
        />
        <div style={styles.main}>
          {currentFile ? (
            <Editor
              filePath={currentFile}
              wsEvent={latestWsEvent}
              onChange={onChange}
            />
          ) : (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>⬡</div>
              <div style={styles.emptyTitle}>Diagramming Studio</div>
              <div style={styles.emptyHint}>
                Select a file from the sidebar or create a new diagram to get started.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  app: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#1e1e2e',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    color: '#45475a',
  },
  emptyIcon: {
    fontSize: '48px',
    color: '#313244',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#585b70',
  },
  emptyHint: {
    fontSize: '13px',
    maxWidth: '320px',
    textAlign: 'center' as const,
    lineHeight: 1.6,
  },
};
