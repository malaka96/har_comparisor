# HAR Comparisor

A local web tool to compare two HAR (HTTP Archive) files, for example the API traffic of a legacy application and its rewrite.

Status: early development (Stage 1). You can load one HAR on each side, pair equivalent requests by hand, and compare them side by side. Headers, filtering, saving and export come later (see [instructions.md](instructions.md)).

## How to use

1. Load the legacy HAR on the left and the new HAR on the right (button or drag and drop).
2. Click a request on each side. The bottom panel shows their comparison straight away.
3. Click **Pair selected** to keep them as a pair. Clicking a paired request selects its partner. **Unpair** releases the pair, and pairing a request again moves it to the new partner.
4. Markers in the **Pair** column show the state of each request:
   - `#n` green: paired and identical
   - `#n` orange: paired, with differences
   - `missing`: not paired, only in legacy
   - `extra`: not paired, only in new
5. The comparison compares method, status, host, path, query parameters and the request and response bodies. JSON bodies are compared field by field (key order is ignored, arrays are compared by position) and shown side by side. Headers are not compared yet.

Reloading the page or loading another file clears the pairs.

## Requirements

- Node.js 26 (LTS) and npm
- A modern browser

## Run it

```bash
npm install
npm run build
npm start
```

Open <http://localhost:9096>.

Nothing is stored on disk. Loaded HAR files live in the server's memory and expire after 2 hours without use. Restarting the server or reloading the page starts fresh.

## Develop

Run the server and the client in two terminals:

```bash
npm run dev:server   # API on http://localhost:9096
npm run dev:client   # UI on http://localhost:5173 (proxies /api to the server)
```

Build the shared package once first (`npm run build -w @har-comparisor/shared`), because the server and the client use its compiled output.

## Check the code

```bash
npm run check   # format check, lint, type check, tests and build
```

Single steps: `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

On Windows PowerShell, if `npm` is blocked by the script execution policy, use `npm.cmd`.

## Settings

The server reads these environment variables. All are optional.

| Variable              | Default | Meaning                                         |
| --------------------- | ------- | ----------------------------------------------- |
| `PORT`                | `9096`  | Port to listen on                               |
| `HOST`                | 0.0.0.0 | Address to listen on                            |
| `MAX_UPLOAD_MB`       | `1024`  | Largest HAR file accepted                       |
| `SESSION_TTL_MINUTES` | `120`   | Time a loaded HAR stays in memory after its use |
| `MAX_SESSIONS`        | `10`    | HAR files kept in memory at once                |
| `CLIENT_DIST_DIR`     | built   | Folder with the built client to serve           |

## Project layout

| Folder            | Contents                                                 |
| ----------------- | -------------------------------------------------------- |
| `packages/shared` | Types shared by the server and the client                |
| `packages/server` | Fastify API: HAR parsing, normalization, in-memory store |
| `packages/client` | React UI                                                 |
| `docs/`           | Requirements, architecture, decisions, open questions    |

## Privacy

HAR files often contain tokens, cookies and personal data. This tool runs on your machine and sends nothing elsewhere. Keep real HAR files out of git: `*.har`, `*.har.json` and `/private/` are ignored.
