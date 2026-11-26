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

6. Headers are compared too, in the **Response headers** and **Request headers** tabs. Headers that change on every request (dates, cookies, trace IDs, `Content-Length`, HTTP/2 pseudo-headers) are shown greyed out and do not make a pair different.
7. The filter bar above the lists narrows both lists at once: search the URL, or filter by method, status class, type (for example only XHR and fetch API calls) and pair state (for example only requests that are not paired yet). Filtering never changes the pairs or the counts.

Reloading the page or loading another file clears the pairs.

## Run with Docker (easiest)

The image is on Docker Hub: [malaka96/har-comparisor](https://hub.docker.com/r/malaka96/har-comparisor) (`linux/amd64` and `linux/arm64`, so it runs on Windows, Linux and Apple-silicon Macs).

```bash
docker run -d --name har-comparisor -p 9096:9096 malaka96/har-comparisor:latest
```

Open <http://localhost:9096>. Stop it with `docker stop har-comparisor`, start it again with `docker start har-comparisor`.

- Use another port on your machine with `-p 8080:9096` (then open <http://localhost:8080>).
- Settings from the table below can be passed with `-e`, for example `-e MAX_UPLOAD_MB=2048`.
- Nothing is written to disk. Loaded HAR files stay in the container's memory and are gone when it stops.

Get a newer version with `docker pull malaka96/har-comparisor:latest`, then remove and start the container again. A specific version can be pinned, for example `malaka96/har-comparisor:0.1.0`.

Build the image yourself from this repository:

```bash
docker build -t har-comparisor .
docker run -d -p 9096:9096 har-comparisor
```

Publish a new version (maintainers, after `docker login`):

```bash
docker buildx build --platform linux/amd64,linux/arm64 --build-arg VERSION=X.Y.Z \
  -t malaka96/har-comparisor:X.Y.Z -t malaka96/har-comparisor:latest --push .
```

## Requirements (without Docker)

- Node.js 26 (LTS) and npm
- A modern browser

## Run it (without Docker)

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
npm run check      # format check, lint, type check, unit tests and build
npm run test:e2e   # build, then browser tests with Playwright
npm run check:all  # both
```

Single steps: `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Testing approach

| Layer       | Tool                    | Where                                  | What it covers                                                                       |
| ----------- | ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------ |
| Unit        | Vitest                  | `*.test.ts` next to the code           | HAR parsing and edge cases, JSON diff, entry comparison, pairing logic, body display |
| API         | Vitest + Fastify inject | `packages/server/src/app.test.ts`      | Upload, entry and compare endpoints, error codes, size limit                         |
| End-to-end  | Playwright              | `packages/e2e/tests`                   | The acceptance examples A1 to A18 in a real browser, against the built app           |
| Large files | Playwright              | `packages/e2e/tests/large-har.spec.ts` | Two generated HARs of about 40 MB each: load, list, compare, scroll                  |

- All test data is synthetic and built in code (`packages/e2e/fixtures/har-fixtures.ts` and `packages/server/src/har/har-builder.test-util.ts`). Real HAR files are never committed.
- The browser tests use your installed Google Chrome. To use Playwright's own Chromium instead, run `npx playwright install chromium` once and set `PW_CHANNEL=chromium`.
- `E2E_BASE_URL` runs the browser tests against an app that is already running, for example a Docker container: `docker run -d -p 9198:9096 har-comparisor`, then `E2E_BASE_URL=http://127.0.0.1:9198 npm run e2e -w @har-comparisor/e2e`.
- `E2E_PORT` (default `9197`) sets the port of the test server. `E2E_LARGE_COUNT` (default `4000`) sets the number of requests in the large-file test.
- There is no coverage percentage target. New behavior gets a unit test, and user-visible behavior gets an end-to-end test.

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
