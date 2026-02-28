/**
 * Deno + Hono agent server for the diagramming AI agent.
 * Run with: deno run --allow-all --env-file server/main.ts
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import Anthropic from "@anthropic-ai/sdk";
import { resolve, dirname, isAbsolute, relative } from "@std/path";
import { ensureDir } from "@std/fs";
import { walk } from "@std/fs/walk";
import { Database } from "@db/sqlite";

const PORT = 8080;
// server/main.ts lives one level below project root
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;

// ── Tool implementations ──────────────────────────────────────────────────────

async function readFile(filePath: string): Promise<string> {
  const absPath = isAbsolute(filePath)
    ? filePath
    : resolve(PROJECT_ROOT, filePath);
  return await Deno.readTextFile(absPath);
}

async function writeFile(filePath: string, content: string): Promise<string> {
  const absPath = isAbsolute(filePath)
    ? filePath
    : resolve(PROJECT_ROOT, filePath);
  await ensureDir(dirname(absPath));
  await Deno.writeTextFile(absPath, content);
  return `File written successfully: ${filePath}`;
}

async function listDirectory(dirPath: string): Promise<string> {
  const absPath = isAbsolute(dirPath)
    ? dirPath
    : resolve(PROJECT_ROOT, dirPath);
  const lines: string[] = [];

  async function walkDir(dir: string, indent: string): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist" ||
          entry.name === "data"
        ) continue;
        lines.push(
          `${indent}${entry.isDirectory ? "📁" : "📄"} ${entry.name}`,
        );
        if (entry.isDirectory) {
          await walkDir(resolve(dir, entry.name), indent + "  ");
        }
      }
    } catch (e) {
      lines.push(`${indent}[Error: ${e}]`);
    }
  }

  await walkDir(absPath, "");
  return lines.join("\n") || "(empty directory)";
}

// ── Tool definitions for Claude ───────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "Read the contents of a file. Path can be relative to the project root or absolute.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to project root or absolute path",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file. Creates directories as needed. Use this to create or update .excalidraw files with valid JSON.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to project root or absolute path",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description:
      "List the contents of a directory as a file tree. Path can be relative to project root.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Directory path relative to project root or absolute path",
        },
      },
      required: ["path"],
    },
  },
];

async function executeTool(
  name: string,
  input: Record<string, string>,
): Promise<string> {
  switch (name) {
    case "read_file":
      return await readFile(input.path!);
    case "write_file":
      return await writeFile(input.path!, input.content!);
    case "list_directory":
      return await listDirectory(input.path!);
    default:
      return `Unknown tool: ${name}`;
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a diagramming agent that helps users create and edit Excalidraw diagrams. You can read files, write files, and list directories.

When a user asks you to create or edit a diagram, write valid .excalidraw JSON files. An Excalidraw file has this structure:
{
  "type": "excalidraw",
  "version": 2,
  "source": "diagramming-agent",
  "elements": [...],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}

Excalidraw element types include: rectangle, ellipse, diamond, arrow, line, text, freedraw.
Each element requires these fields:
- id: unique string (use crypto.randomUUID() style hex strings)
- type: element type string
- x, y: position numbers
- width, height: dimension numbers
- angle: 0
- strokeColor: hex color (e.g. "#1e1e1e")
- backgroundColor: "transparent" or hex
- fillStyle: "solid", "hachure", "cross-hatch", or "dots"
- strokeWidth: number (1, 2, or 4)
- strokeStyle: "solid", "dashed", or "dotted"
- roughness: 0, 1, or 2
- opacity: 0-100
- roundness: null or { "type": 3 } for rounded corners
- isDeleted: false
- groupIds: []
- frameId: null
- boundElements: []
- updated: unix timestamp (ms)
- link: null
- locked: false

For text elements, also include:
- text: the string content
- fontSize: number (e.g. 20)
- fontFamily: 1 (Virgil), 2 (Helvetica), or 3 (Cascadia)
- textAlign: "left", "center", or "right"
- verticalAlign: "top" or "middle"
- containerId: null
- originalText: same as text
- lineHeight: 1.25

For arrow/line elements, also include:
- points: [[x1, y1], [x2, y2], ...]
- lastCommittedPoint: null
- startBinding: null
- endBinding: null
- startArrowhead: null or "arrow"
- endArrowhead: null or "arrow"

Store diagrams in the project root as .excalidraw files (e.g., "diagram.excalidraw").
When the user asks to edit the current diagram, first read it with read_file, then write the updated version back with write_file.
The right panel will automatically reload when you write a .excalidraw file.`.trim();

// ── Main server ───────────────────────────────────────────────────────────────

async function main() {
  const DATA_DIR = resolve(PROJECT_ROOT, "data");
  await ensureDir(DATA_DIR);

  const db = new Database(resolve(DATA_DIR, "chat.db"));
  db.exec(`PRAGMA journal_mode = WAL;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      data TEXT NOT NULL
    );
  `);

  function saveMessage(msg: Record<string, unknown>) {
    db.prepare("INSERT INTO messages (id, data, created_at) VALUES (?, ?, ?)")
      .run(crypto.randomUUID(), JSON.stringify(msg), new Date().toISOString());
  }

  function saveHistory(history: Anthropic.MessageParam[]) {
    db.prepare("INSERT OR REPLACE INTO history (id, data) VALUES (1, ?)")
      .run(JSON.stringify(history));
  }

  const client = new Anthropic();
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  // ── WebSocket for file-change events ───────────────────────────────────────

  const wsClients = new Set<WebSocket>();

  function broadcast(data: object) {
    const msg = JSON.stringify(data);
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  app.get("/ws", (c) => {
    if (c.req.header("upgrade") !== "websocket") {
      return c.text("Expected WebSocket upgrade", 426);
    }
    const { socket, response } = Deno.upgradeWebSocket(c.req.raw);
    socket.onopen = () => {
      wsClients.add(socket);
      console.log("[WS] Client connected");
    };
    socket.onclose = () => {
      wsClients.delete(socket);
      console.log("[WS] Client disconnected");
    };
    socket.onerror = (e) => console.error("[WS] Error:", e);
    return response;
  });

  // ── Health check ───────────────────────────────────────────────────────────

  app.get("/health", (c) => c.json({ status: "ok" }));

  // ── File listing ───────────────────────────────────────────────────────────

  app.get("/files", async (c) => {
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
  });

  // ── File read ──────────────────────────────────────────────────────────────

  app.get("/file", async (c) => {
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
  });

  // ── File write (user edits in Excalidraw UI) ───────────────────────────────

  app.put("/file", async (c) => {
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
  });

  // ── File create ────────────────────────────────────────────────────────────

  app.post("/file", async (c) => {
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
      await Deno.writeTextFile(
        absPath,
        JSON.stringify(emptyDiagram, null, 2),
      );
      return c.json({ ok: true }, 201);
    } catch {
      return c.json({ error: "Failed to create file" }, 500);
    }
  });

  // ── Persisted messages ─────────────────────────────────────────────────────

  app.get("/messages", (c) => {
    const msgs = db.prepare(
      "SELECT data FROM messages ORDER BY created_at",
    ).all<{ data: string }>();
    const histRow = db.prepare("SELECT data FROM history WHERE id = 1")
      .get<{ data: string }>();
    return c.json({
      messages: msgs.map((r) => JSON.parse(r.data)),
      history: histRow ? JSON.parse(histRow.data) : [],
    });
  });

  app.delete("/messages", (c) => {
    db.exec("DELETE FROM messages; DELETE FROM history;");
    return c.json({ ok: true });
  });

  // ── Chat SSE endpoint ──────────────────────────────────────────────────────

  app.post("/chat", async (c) => {
    const body = await c.req.json<{
      messages: Anthropic.MessageParam[];
      currentFile?: string;
    }>();
    const { messages, currentFile } = body;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function send(data: Record<string, unknown>) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        }

        try {
          const lastMsg = messages[messages.length - 1];
          if (
            lastMsg?.role === "user" &&
            typeof lastMsg.content === "string"
          ) {
            saveMessage({
              role: "user",
              type: "text",
              text: lastMsg.content,
            });
          }

          const systemPrompt = currentFile
            ? `${SYSTEM_PROMPT}\n\nThe user is currently viewing: ${currentFile}`
            : SYSTEM_PROMPT;

          const conversationMessages: Anthropic.MessageParam[] = [...messages];

          while (true) {
            const response = await client.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 8096,
              system: systemPrompt,
              messages: conversationMessages,
              tools: TOOLS,
            });

            let hasText = false;

            for (const block of response.content) {
              if (block.type === "text") {
                hasText = true;
                send({ type: "text", text: block.text });
                saveMessage({
                  role: "assistant",
                  type: "text",
                  text: block.text,
                });
              } else if (block.type === "tool_use") {
                send({
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: block.input,
                });
                saveMessage({
                  role: "assistant",
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: block.input,
                });
              }
            }

            if (
              response.stop_reason === "end_turn" &&
              !response.content.some((b) => b.type === "tool_use")
            ) {
              break;
            }

            if (response.stop_reason === "tool_use") {
              conversationMessages.push({
                role: "assistant",
                content: response.content,
              });

              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const block of response.content) {
                if (block.type === "tool_use") {
                  let output: string;
                  try {
                    output = await executeTool(
                      block.name,
                      block.input as Record<string, string>,
                    );
                  } catch (err) {
                    output = `Error: ${
                      err instanceof Error ? err.message : String(err)
                    }`;
                  }

                  send({
                    type: "tool_result",
                    id: block.id,
                    name: block.name,
                    output,
                  });
                  saveMessage({
                    role: "assistant",
                    type: "tool_result",
                    id: block.id,
                    name: block.name,
                    output,
                  });
                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: output,
                  });
                }
              }

              conversationMessages.push({
                role: "user",
                content: toolResults,
              });

              continue;
            }

            if (!hasText) break;
            break;
          }

          saveHistory(conversationMessages);
          send({ type: "done" });
        } catch (err) {
          console.error("Agent error:", err);
          send({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  // ── File watcher ───────────────────────────────────────────────────────────

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

  console.log(`\nDiagramming agent server → http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  POST http://localhost:${PORT}/chat`);
  console.log(`  GET  http://localhost:${PORT}/messages\n`);

  Deno.serve({ port: PORT }, app.fetch);
}

main().catch(console.error);
