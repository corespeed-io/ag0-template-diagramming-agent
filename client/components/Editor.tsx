import React, { useEffect, useState, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

interface ExcalidrawFile {
  type: string;
  version: number;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

interface EditorProps {
  filePath: string;
  wsEvent: MessageEvent | null;
  onChange: (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => void;
}

export function Editor({ filePath, wsEvent, onChange }: EditorProps) {
  const [initialData, setInitialData] = useState<ExcalidrawFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // force remount on reload

  const loadFile = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ExcalidrawFile = await res.json();
      setInitialData(data);
      setKey((k) => k + 1); // remount Excalidraw with fresh data
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load when filePath changes
  useEffect(() => {
    loadFile(filePath);
  }, [filePath]);

  // React to external file changes
  useEffect(() => {
    if (!wsEvent) return;
    try {
      const event = JSON.parse(wsEvent.data);
      if (event.event === 'change' && event.path === filePath) {
        console.log('[Editor] External change detected, reloading...');
        loadFile(filePath);
      }
    } catch {
      // ignore
    }
  }, [wsEvent, filePath]);

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.loadingText}>Loading {filePath.split('/').pop()}...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <div style={styles.errorText}>Error loading file: {error}</div>
        <button style={styles.retryBtn} onClick={() => loadFile(filePath)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.editorContainer}>
      <Excalidraw
        key={key}
        initialData={{
          elements: initialData?.elements ?? [],
          appState: {
            ...initialData?.appState,
            theme: 'dark',
          },
          files: initialData?.files ?? {},
        }}
        onChange={onChange}
        theme="dark"
        UIOptions={{
          canvasActions: {
            export: false,
            loadScene: false,
          },
        }}
      />
    </div>
  );
}

const styles = {
  editorContainer: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  } as React.CSSProperties,
  centered: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#6c7086',
  },
  loadingText: {
    fontSize: '14px',
  },
  errorText: {
    fontSize: '14px',
    color: '#f38ba8',
  },
  retryBtn: {
    background: '#313244',
    color: '#cdd6f4',
    border: '1px solid #45475a',
    borderRadius: '6px',
    padding: '6px 16px',
    cursor: 'pointer',
    fontSize: '13px',
  },
};
