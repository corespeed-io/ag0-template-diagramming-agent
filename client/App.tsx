import { useState, useRef, useEffect } from "react";
import ChatPanel from "./components/ChatPanel";
import ExcalidrawPanel from "./components/ExcalidrawPanel";

const WS_URL = "ws://localhost:8080/ws";

export default function App() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [wsEvent, setWsEvent] = useState<MessageEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => console.log("[WS] Connected");
      ws.onmessage = (event) => setWsEvent(event);
      ws.onclose = () => {
        console.log("[WS] Disconnected, reconnecting in 2s...");
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = (err) => console.error("[WS] Error:", err);
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%" }}>
      {/* Left panel: Chat (40%) */}
      <div
        style={{
          width: "40%",
          minWidth: 320,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #333",
          background: "#111",
        }}
      >
        <ChatPanel currentFile={currentFile} />
      </div>

      {/* Right panel: Excalidraw (60%) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <ExcalidrawPanel
          currentFile={currentFile}
          setCurrentFile={setCurrentFile}
          wsEvent={wsEvent}
        />
      </div>
    </div>
  );
}
