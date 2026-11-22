# HAR Comparisor

A local web tool to compare two HAR (HTTP Archive) files, for example the API traffic of a legacy application and its rewrite.

Status: early development. Right now the tool loads one HAR on each side, lists the requests, and previews request and response bodies. Pairing and comparison are planned (see [instructions.md](instructions.md)).

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
