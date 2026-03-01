/**
 * API Router
 *
 * This module defines the backend API. All routes defined
 * here are mounted under `/api` by `main.ts`.
 *
 * Includes:
 *   /api/agent/*    — Zypher Agent (chat, streaming, message history)
 *   /api/files      — List / delete .excalidraw files
 *   /api/file       — Read / write / create .excalidraw files
 *   /api/ws         — WebSocket for file-change notifications
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { dirname, relative, resolve } from "@std/path";
import { walk } from "@std/fs/walk";
import { createZypherAgentRouter } from "./agent.ts";

const PROJECT_ROOT = Deno.cwd();

// ── WebSocket file-change broadcaster ──────────────────────────────────────

const wsClients = new Set<WebSocket>();

function broadcast(data: object) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// Start file watcher in background
(async () => {
  const debounce = new Map<string, ReturnType<typeof setTimeout>>();
  try {
    const watcher = Deno.watchFs(PROJECT_ROOT, { recursive: true });
    for await (const event of watcher) {
      for (const p of event.paths) {
        if (!p.endsWith(".excalidraw")) continue;
        if (p.includes("node_modules") || p.includes(".git")) continue;

        clearTimeout(debounce.get(p));
        debounce.set(
          p,
          setTimeout(() => {
            const eventType = event.kind === "create"
              ? "add"
              : event.kind === "remove"
              ? "unlink"
              : "change";
            broadcast({ event: eventType, path: relative(PROJECT_ROOT, p) });
          }, 300),
        );
      }
    }
  } catch (err) {
    console.error("[Watcher] Error:", err);
  }
})();

// ── Build router ───────────────────────────────────────────────────────────

const app = new Hono()
  .use(cors())
  // Zypher Agent API — exposes the agent over HTTP and WebSocket.
  // On the frontend, hooks in lib/zypher-ui (e.g., useAgent) consume this API.
  .route("/agent", await createZypherAgentRouter())
  // ── WebSocket for file-change events ─────────────────────────────────────

  .get("/ws", (c) => {
    if (c.req.header("upgrade") !== "websocket") {
      return c.text("Expected WebSocket upgrade", 426);
    }
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
    socket.onopen = async () => {
      wsClients.add(socket);
      // Replay existing .excalidraw files so reconnecting clients see current state
      try {
        for await (
          const entry of walk(PROJECT_ROOT, {
            exts: [".excalidraw"],
            skip: [/node_modules/, /\.git/, /dist/],
            includeDirs: false,
          })
        ) {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                event: "add",
                path: relative(PROJECT_ROOT, entry.path),
              }),
            );
          }
        }
      } catch (err) {
        console.error("[WS] Error replaying files:", err);
      }
    };
    socket.onclose = () => wsClients.delete(socket);
    socket.onerror = (e) => console.error("[WS] Error:", e);
    return response;
  })
  // ── File listing ─────────────────────────────────────────────────────────

  .get("/files", async (c) => {
    const files: string[] = [];
    try {
      for await (
        const entry of walk(PROJECT_ROOT, {
          exts: [".excalidraw"],
          skip: [/node_modules/, /\.git/, /dist/],
          includeDirs: false,
        })
      ) {
        files.push(relative(PROJECT_ROOT, entry.path));
      }
      files.sort();
      return c.json(files);
    } catch (err) {
      console.error("[API] Error listing files:", err);
      return c.json({ error: "Failed to list files" }, 500);
    }
  })
  // ── Delete all .excalidraw files ─────────────────────────────────────────

  .delete("/files", async (c) => {
    try {
      for await (
        const entry of walk(PROJECT_ROOT, {
          exts: [".excalidraw"],
          skip: [/node_modules/, /\.git/, /dist/],
          includeDirs: false,
        })
      ) {
        await Deno.remove(entry.path);
      }
      return c.json({ ok: true });
    } catch (err) {
      console.error("[API] Error deleting files:", err);
      return c.json({ error: "Failed to delete files" }, 500);
    }
  })
  // ── File read ────────────────────────────────────────────────────────────

  .get("/file", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path query param required" }, 400);

    const absPath = resolve(PROJECT_ROOT, filePath);
    if (!absPath.startsWith(PROJECT_ROOT)) {
      return c.json({ error: "Path traversal not allowed" }, 403);
    }

    try {
      const content = await Deno.readTextFile(absPath);
      return c.json(JSON.parse(content));
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return c.json({ error: "File not found" }, 404);
      }
      return c.json({ error: "Failed to read file" }, 500);
    }
  })
  // ── File write (user edits in Excalidraw UI) ────────────────────────────

  .put("/file", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path query param required" }, 400);

    const absPath = resolve(PROJECT_ROOT, filePath);
    if (!absPath.startsWith(PROJECT_ROOT)) {
      return c.json({ error: "Path traversal not allowed" }, 403);
    }

    try {
      const body = await c.req.json();
      await Deno.mkdir(dirname(absPath), { recursive: true });
      await Deno.writeTextFile(absPath, JSON.stringify(body, null, 2));
      return c.json({ ok: true });
    } catch (err) {
      console.error("[API] Error writing file:", err);
      return c.json({ error: "Failed to write file" }, 500);
    }
  })
  // ── File create ──────────────────────────────────────────────────────────

  .post("/file", async (c) => {
    const filePath = c.req.query("path");
    if (!filePath) return c.json({ error: "path query param required" }, 400);

    const absPath = resolve(PROJECT_ROOT, filePath);
    if (!absPath.startsWith(PROJECT_ROOT)) {
      return c.json({ error: "Path traversal not allowed" }, 403);
    }

    try {
      await Deno.stat(absPath);
      return c.json({ error: "File already exists" }, 409);
    } catch {
      // File doesn't exist, continue
    }

    const emptyDiagram = {
      type: "excalidraw",
      version: 2,
      source: "diagramming-agent",
      elements: [],
      appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
      files: {},
    };

    try {
      await Deno.mkdir(dirname(absPath), { recursive: true });
      await Deno.writeTextFile(absPath, JSON.stringify(emptyDiagram, null, 2));
      return c.json({ ok: true }, 201);
    } catch {
      return c.json({ error: "Failed to create file" }, 500);
    }
  });

export default app;
