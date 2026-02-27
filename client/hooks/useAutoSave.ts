import { useRef, useCallback, useState } from 'react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave(currentFile: string | null) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ elements: readonly ExcalidrawElement[]; appState: AppState; files: BinaryFiles } | null>(null);
  const isSaving = useRef(false);

  const save = useCallback(async (filePath: string, elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    if (isSaving.current) return;
    isSaving.current = true;
    setStatus('saving');

    try {
      const body = {
        type: 'excalidraw',
        version: 2,
        source: 'diagramming-studio',
        elements,
        appState: {
          gridSize: appState.gridSize ?? null,
          viewBackgroundColor: appState.viewBackgroundColor,
        },
        files,
      };

      const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setStatus('saved');
      // Reset to idle after 2s
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error('[AutoSave] Error saving:', err);
      setStatus('error');
    } finally {
      isSaving.current = false;

      // If there's a pending save, run it now
      if (pendingRef.current && currentFile) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        save(currentFile, pending.elements, pending.appState, pending.files);
      }
    }
  }, [currentFile]);

  const onChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    if (!currentFile) return;

    // Store latest pending data
    pendingRef.current = { elements, appState, files };

    // Debounce
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (pendingRef.current && currentFile) {
        const pending = pendingRef.current;
        pendingRef.current = null;
        save(currentFile, pending.elements, pending.appState, pending.files);
      }
    }, 500);
  }, [currentFile, save]);

  return { onChange, status };
}
