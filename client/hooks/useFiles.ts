import { useState, useEffect, useCallback } from 'react';

export function useFiles(wsEvents: MessageEvent | null) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: string[] = await res.json();
      setFiles(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // React to websocket events
  useEffect(() => {
    if (!wsEvents) return;
    try {
      const event = JSON.parse(wsEvents.data);
      if (event.event === 'add' || event.event === 'unlink') {
        fetchFiles();
      }
    } catch {
      // ignore parse errors
    }
  }, [wsEvents, fetchFiles]);

  const createFile = useCallback(async (name: string): Promise<boolean> => {
    const fileName = name.endsWith('.excalidraw') ? name : `${name}.excalidraw`;
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(fileName)}`, {
        method: 'POST',
      });
      if (res.status === 409) {
        throw new Error('File already exists');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchFiles();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchFiles]);

  return { files, loading, error, refetch: fetchFiles, createFile };
}
