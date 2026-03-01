# AG0 Template: Diagramming Agent

AI diagramming agent with a split-panel UI: Zypher Agent chat on the left,
Excalidraw editor on the right.

- **Backend:** Deno + Hono with Zypher Agent (WebSocket + REST)
- **Frontend:** React + Vite + Tailwind CSS with streaming chat UI + Excalidraw
- **Deployment:** Dockerfile with multi-stage build

## Project Structure

```
api/            Deno backend
  agent.ts        Agent configuration (model, tools, system prompt)
  mod.ts          API router (mounts agent + file management routes)
ui/             React frontend (pnpm)
  src/lib/zypher-ui/   Agent UI hooks (useAgent, TaskApiClient, etc.)
  src/components/      Chat UI + Excalidraw components
main.ts         Hono server entry point
Dockerfile      Production build
```

## Getting Started

```sh
# Install frontend dependencies
cd ui && pnpm install && cd ..

# Start backend (in one terminal)
deno task dev

# Start frontend (in another terminal)
cd ui && pnpm dev
```

The app runs at `http://localhost:8080`.

### How it works

The Hono server (`main.ts`) handles everything on a single port:

- **`/api/*`** routes to the backend API (`api/mod.ts`), which mounts the Zypher
  Agent at `/api/agent` and file management routes.
- **All other requests** are proxied to the frontend.

In **development**, the server proxies non-API requests to the Vite dev server
(port 5173) for HMR. In **production**, it serves the pre-built static files
from `ui/dist` instead.

The UI features a split panel layout with the AI chat on the left and an
Excalidraw canvas on the right. When the agent writes `.excalidraw` files, the
canvas updates automatically via WebSocket file-change notifications.
