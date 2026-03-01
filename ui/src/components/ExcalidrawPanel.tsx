import { useEffect, type Ref } from "react";
import {
  ExcalidrawEditor,
  type ExcalidrawEditorHandle,
} from "./ExcalidrawEditor.tsx";
import { useAutoSave } from "@/hooks/useAutoSave.ts";

interface Props {
  currentFile: string | null;
  setCurrentFile: (f: string | null) => void;
  wsEvent: MessageEvent | null;
  editorRef?: Ref<ExcalidrawEditorHandle>;
}

export default function ExcalidrawPanel({
  currentFile,
  setCurrentFile,
  wsEvent,
  editorRef,
}: Props) {
  const { onChange: autoSaveOnChange, lastSaveTimeRef } =
    useAutoSave(currentFile);

  // Watch WS events: when the agent writes a .excalidraw file, switch to it
  useEffect(() => {
    if (!wsEvent) return;
    try {
      const event = JSON.parse(wsEvent.data);
      if (
        event.event === "add" &&
        typeof event.path === "string" &&
        event.path.endsWith(".excalidraw") &&
        !currentFile
      ) {
        setCurrentFile(event.path);
      } else if (
        event.event === "change" &&
        typeof event.path === "string" &&
        event.path.endsWith(".excalidraw")
      ) {
        setCurrentFile(event.path);
      } else if (event.event === "unlink" && event.path === currentFile) {
        setCurrentFile(null);
      }
    } catch {
      // ignore parse errors
    }
  }, [wsEvent, currentFile, setCurrentFile]);

  if (!currentFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-muted/30">
        <div className="text-5xl text-muted-foreground/30">⬡</div>
        <div className="text-xl font-bold text-muted-foreground/60">
          No diagram open
        </div>
        <div className="text-sm text-center max-w-xs leading-relaxed text-muted-foreground/50">
          Ask the agent to create a diagram and it will appear here
          automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* File name bar */}
      <div className="px-4 py-1.5 border-b text-xs text-muted-foreground bg-muted/30 font-mono truncate">
        {currentFile}
      </div>

      <ExcalidrawEditor
        filePath={currentFile}
        wsEvent={wsEvent}
        onChange={autoSaveOnChange}
        lastSaveTimeRef={lastSaveTimeRef}
        editorRef={editorRef}
      />
    </div>
  );
}
