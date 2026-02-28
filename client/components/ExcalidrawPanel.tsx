import { useEffect } from "react";
import { Editor } from "./Editor";
import { useAutoSave } from "../hooks/useAutoSave";

interface Props {
  currentFile: string | null;
  setCurrentFile: (f: string | null) => void;
  wsEvent: MessageEvent | null;
}

export default function ExcalidrawPanel({
  currentFile,
  setCurrentFile,
  wsEvent,
}: Props) {
  const { onChange: autoSaveOnChange } = useAutoSave(currentFile);

  // Watch WS events: when the agent writes a .excalidraw file, switch to it
  useEffect(() => {
    if (!wsEvent) return;
    try {
      const event = JSON.parse(wsEvent.data);
      if (
        (event.event === "change" || event.event === "add") &&
        typeof event.path === "string" &&
        event.path.endsWith(".excalidraw")
      ) {
        setCurrentFile(event.path);
      } else if (
        event.event === "unlink" &&
        event.path === currentFile
      ) {
        setCurrentFile(null);
      }
    } catch {
      // ignore parse errors
    }
  }, [wsEvent]);

  if (!currentFile) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          color: "#555",
          background: "#1e1e2e",
        }}
      >
        <div style={{ fontSize: 48, color: "#313244" }}>⬡</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#585b70" }}>
          No diagram open
        </div>
        <div
          style={{
            fontSize: 13,
            textAlign: "center",
            maxWidth: 320,
            lineHeight: 1.6,
            color: "#45475a",
          }}
        >
          Ask the agent to create a diagram and it will appear here automatically.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* File name bar */}
      <div
        style={{
          padding: "6px 16px",
          borderBottom: "1px solid #333",
          fontSize: 12,
          color: "#666",
          background: "#111",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {currentFile}
      </div>

      <Editor
        filePath={currentFile}
        wsEvent={wsEvent}
        onChange={autoSaveOnChange}
      />
    </div>
  );
}
