import { Hono } from "hono";
// Zypher Agent SDK
// Documentation: https://docs.corespeed.io/zypher
// API reference:
//   @zypher/agent — https://jsr.io/@zypher/agent/doc
//   @zypher/http  — https://jsr.io/@zypher/http/doc
//   Or run: `deno doc jsr:@zypher/agent` / `deno doc jsr:@zypher/http`
import {
  cloudflareGateway,
  createZypherAgent,
  getSystemPrompt,
} from "@zypher/agent";
import { getRequiredEnv } from "@zypher/utils/env";
import { createZypherHandler } from "@zypher/http";
import { buildAgentInfo } from "@ag0/agent-info";

// =============================================================================
// TOOL IMPORTS
// =============================================================================
// Built-in tools: Zypher provides common tools for file system and terminal access
// - createFileSystemTools(): Returns tools for read_file, list_dir, edit_file,
//   undo_file, grep_search, file_search, copy_file, delete_file
// - RunTerminalCmdTool: Execute shell commands
import { createFileSystemTools, RunTerminalCmdTool } from "@zypher/agent/tools";

// =============================================================================
// EXCALIDRAW SYSTEM PROMPT
// =============================================================================

const EXCALIDRAW_INSTRUCTIONS = `
# Excalidraw Diagramming Skills

You are a diagramming agent that helps users create and edit Excalidraw diagrams. You can read files, write files, and list directories.

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
When the user asks to edit the current diagram, first read it with read_file, then write the updated version back.
The right panel will automatically reload when you write a .excalidraw file.
`.trim();

export async function createZypherAgentRouter(): Promise<Hono> {
  const agent = await createZypherAgent({
    // Base directory for file operations (e.g., ReadTool, WriteTool)
    workingDirectory: "./",

    // Model provider — uses Cloudflare AI Gateway (supports OpenAI, Anthropic,
    // and other providers via a unified compatibility API).
    // Environment variables provided automatically in the sandbox:
    //   AI_GATEWAY_BASE_URL – Cloudflare AI Gateway endpoint
    //   AI_GATEWAY_API_TOKEN – Authentication token for the gateway
    // Model ID must be in "provider/model-name" format, e.g.:
    //   "anthropic/claude-sonnet-4-5-20250929"
    //   "openai/gpt-4o"
    model: cloudflareGateway("anthropic/claude-sonnet-4-5-20250929", {
      gatewayBaseUrl: getRequiredEnv("AI_GATEWAY_BASE_URL"),
      apiToken: getRequiredEnv("AI_GATEWAY_API_TOKEN"),
      headers: {
        "User-Agent": "AG0-ZypherAgent/1.0",
      },
    }),

    // Initial messages to restore conversation context
    // initialMessages: [],

    // Agent configuration
    config: {
      skills: {
        projectSkillsDir: "skills",
      },
    },

    // Override default behaviors with custom implementations
    overrides: {
      // Load Excalidraw diagramming instructions as custom system prompt.
      // IMPORTANT: Always use getSystemPrompt() from @zypher/agent — it
      // includes the base Zypher system prompt required for advanced agent
      // capabilities (e.g., agent skills, programmatic tool calling).
      systemPromptLoader: async () => {
        return await getSystemPrompt(Deno.cwd(), {
          customInstructions: EXCALIDRAW_INSTRUCTIONS,
        });
      },
    },

    // Tools give the agent capabilities to perform actions
    tools: [
      // Built-in file system tools (read, write, edit, search files)
      ...createFileSystemTools(),

      // Built-in terminal command execution
      RunTerminalCmdTool,
    ],

    // MCP (Model Context Protocol) servers provide external integrations
    mcpServers: [
      // Example: Command-based MCP server (spawns a local process)
      // {
      //   id: "sequential-thinking",
      //   type: "command",
      //   command: {
      //     command: "npx",
      //     args: [
      //       "-y",
      //       "@modelcontextprotocol/server-sequential-thinking",
      //     ],
      //   },
      // },
    ],
  });

  return createZypherHandler({
    agent,
  })
    // AG0 Dashboard contract: the dashboard shows the agent canvas tab
    // only when GET /api/agent/info returns an AgentInfo object.
    // Update the name and description to match your agent.
    .get("/info", async (c) => {
      const info = await buildAgentInfo(agent, {
        name: "Diagramming Agent",
        description: "AI agent for creating and editing Excalidraw diagrams",
      });
      return c.json(info);
    });
}
