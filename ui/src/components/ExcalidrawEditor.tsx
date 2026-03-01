import { useEffect, useState, type MutableRefObject } from "react";
import "@excalidraw/excalidraw/index.css";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { Spinner } from "@/components/ui/spinner.tsx";

interface ExcalidrawFile {
  type: string;
  version: number;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

interface ExcalidrawEditorProps {
  filePath: string;
  wsEvent: MessageEvent | null;
  onChange: (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
  lastSaveTimeRef: MutableRefObject<number>;
}

export function ExcalidrawEditor({
  filePath,
  wsEvent,
  onChange,
  lastSaveTimeRef,
}: ExcalidrawEditorProps) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Load when filePath changes
  useEffect(() => {
    loadFile(filePath);
  }, [filePath]);

  // React to external file changes (but ignore self-triggered saves)
  useEffect(() => {
    if (!wsEvent) return;
    try {
      const event = JSON.parse(wsEvent.data);
      if (event.event === "change" && event.path === filePath) {
        // If we saved recently (within 5 seconds), this is our own save echoing
        // back through the file watcher — skip reload to avoid an infinite loop.
        const timeSinceLastSave = Date.now() - lastSaveTimeRef.current;
        if (timeSinceLastSave < 5000) {
          return;
        }
        loadFile(filePath);
      }
    } catch {
      // ignore
    }
  }, [wsEvent, filePath, lastSaveTimeRef]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="size-6" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading {filePath.split("/").pop()}...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <div className="text-sm text-destructive">
          Error loading file: {error}
        </div>
        <button
          className="px-4 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md border hover:bg-accent"
          onClick={() => loadFile(filePath)}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden">
      <Excalidraw
        key={key}
        initialData={{
          elements: initialData?.elements ?? [],
          appState: {
            ...initialData?.appState,
            theme: "light",
          },
          files: initialData?.files ?? {},
        }}
        onChange={onChange}
        theme="light"
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
