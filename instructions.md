# Project Roadmap: HAR Comparison and Analysis Tool

This is a living document. Update it as decisions, scope, and progress change. See `AGENTS.md` for how the AI agent must collaborate.

## How to Use This Roadmap

- Work on one phase (or one approved task) at a time.
- Before a phase starts, review its objectives, scope, approach, and open decisions with the user, and get approval.
- Tasks inside a phase are proposed at phase kickoff and recorded here once approved.
- Phases are ordered by dependency, but can be revisited. Later discoveries may change earlier decisions; record such changes in the Decision Log.
- No technology is chosen yet. Technology choices happen in Phase 2 after evaluation.

## Status Legend

`[ ]` not started, `[~]` in progress, `[x]` complete

## Phase Overview

| #   | Phase                                            | Status |
| --- | ------------------------------------------------ | ------ |
| 0   | Project Setup and Working Agreements             | [x]    |
| 1   | Product Discovery and Requirements               | [x]    |
| 2   | Architecture and Technology Evaluation           | [x]    |
| 3   | Foundation: Project Skeleton and HAR Ingestion   | [x]    |
| 4   | Core Comparison: Request Matching and Basic Diff | [x]    |
| 5   | Testing Strategy and Quality Baseline            | [x]    |
| 6   | Advanced Comparison Capabilities                 | [ ]    |
| 7   | Reporting                                        | [ ]    |
| 8   | User Interface and Usability                     | [ ]    |
| 9   | Dockerization and Distribution                   | [ ]    |
| 10  | Documentation                                    | [ ]    |
| 11  | Hardening and Release                            | [ ]    |

Notes on ordering:

- Phase 5 defines the testing strategy formally, but verification is expected in every phase from Phase 3 onward. Phase 2 should settle the testing approach early enough that Phase 3 can use it.
- Phase 8 (UI) is included as a placeholder. Whether the tool has a CLI, a web UI, or both is an open decision for Phases 1 and 2.

---

## Phase 0: Project Setup and Working Agreements

**Objectives:** Establish how the user and the agent work together and confirm the baseline for the project.

**Scope:**

- Review `AGENTS.md` and this roadmap with the user; adjust where needed.
- Decide the working conventions: version control usage, commit expectations, where decisions are recorded.
- Collect sample material (sanitized HAR files from the legacy and new applications) for later phases, and agree on how sensitive data is handled.

**Expected outcomes:**

- Agreed `AGENTS.md` and roadmap.
- A list of available sample inputs and any data-handling rules.

**Completion criteria:**

- User confirms the working agreements and the phase list.
- Sample data availability and sensitivity rules are noted in this file.

---

## Phase 1: Product Discovery and Requirements

**Objectives:** Understand the problem and define what the tool must do, for the primary Angular migration case and for general reuse.

**Scope:**

- Primary use case walkthrough: how HARs are captured, what is compared, what a "meaningful" difference is.
- Target users and usage modes (for example: one-off comparison, repeated runs, CI use). To be decided with the user.
- Functional requirements, grouped and prioritized (must / should / could / not now):
  - HAR input and validation
  - Request matching rules
  - Request and response comparison (URL, method, headers, query, payload, status, body)
  - Missing and additional API calls
  - Dynamic value handling (timestamps, IDs, tokens, ordering)
  - Filtering (static assets, third-party calls, non-API traffic)
  - Output and reports
- Non-functional requirements: file sizes, performance expectations, privacy, platforms, offline use, extensibility.
- Explicit non-goals for the first release.
- Draft acceptance examples using real or sanitized sample data.

**Expected outcomes:**

- A requirements document (location to be agreed) with priorities and non-goals.
- A list of open questions with owners.

**Completion criteria:**

- User approves the prioritized requirements and the first-release (MVP) scope.
- Each must-have requirement has at least one concrete example or acceptance condition.

**Dependencies:** Phase 0.

---

## Phase 2: Architecture and Technology Evaluation

**Objectives:** Choose an approach and technologies deliberately, based on the approved requirements.

**Scope:**

- Identify the decisions to make: implementation language and runtime, interface type (CLI, web, library, or a combination), processing model for large files, data model, storage (if any), report formats, testing tools, project structure.
- For each decision, compare realistic options against the requirements (including Docker distribution, ease of contribution, and maintainability).
- Define the high-level architecture and module boundaries (for example input parsing, normalization, matching, comparison, reporting), kept as simple as the requirements allow.
- Define conventions: structure, naming, formatting, linting, error handling, configuration.
- Define the testing approach and the approach to sample and test data.

**Expected outcomes:**

- Approved technology choices recorded in the Decision Log with rationale.
- A short architecture document.
- Agreed project conventions.

**Completion criteria:**

- User approves the architecture, technology choices, and conventions.
- Known risks are listed, with a way to check the riskiest ones early (a small spike, only if approved).

**Dependencies:** Phase 1.

---

## Phase 3: Foundation: Project Skeleton and HAR Ingestion

**Objectives:** Create the project baseline and reliably read and normalize HAR files.

**Scope (approved 2026-11-21):**

- Initialize the project structure with the approved tooling.
- Set up the baseline for linting, formatting, and tests, as agreed.
- HAR parsing and validation, with clear errors for malformed input.
- Normalized internal representation of entries.
- Handling of edge cases: missing fields, encoded or binary bodies, large files, empty entries.
- Upload API with in-memory storage and expiry.
- A minimal UI: load a HAR on each side (legacy and new), list its entries, show errors and warnings, and preview a response body in Monaco (this also checks Monaco's production build and JSON highlighting).
- Server port: 9096.
- Not in this phase: pairing, comparison, filtering (Stage 1 and 2 phases).

**Tasks (one commit each, or more):**

- [x] 3.1 Workspace skeleton: npm workspaces (`shared`, `server`, `client`), TypeScript strict, Prettier, ESLint, root scripts
- [x] 3.2 Shared types: HAR input and normalized entry
- [x] 3.3 HAR parsing, validation and normalization in `server`, with synthetic-fixture tests
- [x] 3.4 Edge cases: empty entries, missing bodies, Base64 bodies, failed requests, bad input
- [x] 3.5 Upload API (Fastify) with in-memory storage and expiry, serving the built client on port 9096
- [x] 3.6 Minimal UI: two resizable panes, load, list, errors, Monaco body preview
- [x] 3.7 Verify with the real sample HARs and in the browser; document how to run and test

**Expected outcomes:**

- A runnable project that loads a HAR file and produces a normalized, inspectable result.
- Tests covering the ingestion behavior.

**Completion criteria:**

- Sample HAR files load correctly, and invalid ones fail with clear messages.
- Both real sample HARs load and list their entries (covers A1 to A3, A18).
- Tests, lint and build pass from one command, and the way to run them is documented.

**Dependencies:** Phase 2.

---

## Phase 4: Core Comparison: Request Matching and Basic Diff

**Objectives:** Let the user pair equivalent requests by hand and show the differences within each pair (Stage 1: F2, F3, F4, F6, F7, F8).

**Scope:**

- Manual pairing in the UI: pair, unpair, re-pair (pairing a request that is already paired releases its old pair). Matching is manual by decision; automatic matching is Stage 4.
- Unpaired requests are shown as missing (only in legacy) or extra (only in new).
- Comparison of method, status, URL (host, path, query parameters) and request and response bodies. Headers come in Stage 2.
- Custom structural JSON diff in `shared` with typed changes (value, type, added, removed). Arrays compared by position.
- Side-by-side Monaco diff of bodies, diffchecker style, inside resizable panels.
- Identical pairs get a green marker and stay visible.
- Not in this phase: headers, filtering, order-only detection, saving, export.

**Tasks:**

- [x] 4.1 Structural JSON diff and entry comparison in `shared`, with tests
- [x] 4.2 Compare endpoint on the server, with tests
- [x] 4.3 Pairing logic (pure module) with tests
- [x] 4.4 UI: two lists side by side, pair and unpair, pair and missing/extra markers, summary counts
- [x] 4.5 UI: comparison view with change summary and Monaco side-by-side body diff
- [x] 4.6 Verify in the browser with the real sample HARs; update docs

**Expected outcomes:**

- Given two HARs, the user pairs requests and sees paired, missing and extra requests, and the differences within each pair.

**Completion criteria:**

- Acceptance examples A4 to A17 pass (checked in a real browser with the sample HARs).
- `npm run check` passes.

**Dependencies:** Phase 3.

---

## Phase 5: Testing Strategy and Quality Baseline

**Objectives:** Make the quality bar explicit and sustainable.

**Scope:**

- Test layers: unit tests (Vitest) next to the code in each package, API tests with Fastify `inject`, and end-to-end tests (Playwright) in a new `packages/e2e` package that drive the built app in a real browser.
- Synthetic fixtures generated in code (no real HAR content, and `*.har` stays git-ignored). One legacy/new scenario covers the Stage 1 acceptance examples and the edge cases: identical pairs, value and type changes, status 500 vs 200, path change, swapped call order, Base64 body, 204 without body, redirect, failed request, non-JSON text, missing and extra requests.
- Large-HAR check: a generated HAR with thousands of entries and large bodies, measured for upload, list rendering and comparison. Add virtual scrolling only if the measurement shows a need.
- Fill unit-test gaps for redirects, failed requests and non-JSON bodies.
- No coverage percentage target and no CI for now (the user runs the tool locally). Coverage is judged by the acceptance examples each test covers.

**Tasks:**

- [x] 5.1 `packages/e2e` with Playwright, the synthetic scenario builder, and an `npm run test:e2e` script
- [x] 5.2 End-to-end tests for loading, invalid files, pairing, comparison details, re-pairing, resizing and reload
- [x] 5.3 Large-HAR end-to-end check and measurement (fix performance if needed)
- [x] 5.4 Unit-test gaps: redirects, failed requests, text and XML bodies
- [x] 5.5 Document the testing approach in the README

**Acceptance example coverage (automated):**

| Example  | Test                                                                                          |
| -------- | --------------------------------------------------------------------------------------------- |
| A1, A18  | `loading.spec.ts`: loads a HAR and lists its requests                                         |
| A2       | `loading.spec.ts`: rejects bad files; `parse-har.test.ts`, `app.test.ts`                      |
| A3       | `large-har.spec.ts`                                                                           |
| A4       | `comparison.spec.ts`: unpairs and re-pairs; `pairing.test.ts`                                 |
| A5       | `repeated-calls.spec.ts`: same endpoint, different query strings, called in a different order |
| A6       | `comparison.spec.ts`: swapped calls 2↔3 pair and compare by content                           |
| A7, A8   | `loading.spec.ts` and `comparison.spec.ts`: missing and extra markers and counts              |
| A9, A13  | `comparison.spec.ts`: status and request payload differences                                  |
| A10, A11 | `comparison.spec.ts`: URL path differences (raw form; decoded view not built)                 |
| A12      | `comparison.spec.ts`: field changes listed and highlighted side by side                       |
| A14      | `comparison.spec.ts`: identical pairs                                                         |
| A15      | `comparison.spec.ts`: 204 without body                                                        |
| A16      | `comparison.spec.ts`: panels resize                                                           |
| A17      | every comparison test (results shown in the app, no export)                                   |

**Expected outcomes:**

- A documented testing approach and a maintained fixture set.
- Gaps in coverage from earlier phases closed.

**Completion criteria:**

- `npm run check` (unit tests) and `npm run test:e2e` (browser tests) both pass and are documented.
- Every Stage 1 acceptance example (A1 to A18) is covered by an automated test.
- A large HAR (well above 15 MB) loads, lists and compares without freezing the page.

**Dependencies:** Phases 3 and 4. Ongoing in later phases.

---

## Phase 6: Advanced Comparison Capabilities

**Objectives:** Make comparisons meaningful by reducing noise and handling real-world variation.

**Scope for this round (Stage 2: F5, F10, F13, F14):**

- F5: request and response headers compared by name (case-insensitive), all headers shown side by side. Headers that differ on every request (dates, trace IDs, cookies, content length, HTTP/2 pseudo-headers) are listed but ignored for the verdict, and the ignore list is visible.
- F10: filter and search in both request lists (text, method, status class, type, pair state).
- F13: order-only differences: arrays with the same items in another order are reported as one "order" change; pairs whose call order differs are flagged.
- F14: extra difference types (status class, content type, redirect target, body size, timing as information, decoded Base64 path segments, call count per endpoint).
- Not in this round: user-defined rules, dynamic value handling, automatic matching (Stage 4), saving and export (Stage 3, Phase 7).

**Tasks:**

- [x] 6.1 Header comparison with a default ignore list (shared, server, UI, tests)
- [x] 6.2 Filtering and search in the request lists
- [x] 6.3 Order-only differences (array order, call order)
- [ ] 6.4 Extra difference types
- [ ] 6.5 Verify with the real sample HARs and in the browser (local build, no Docker); update docs

**Candidate items for later rounds:**

- Dynamic value handling: timestamps, generated IDs, tokens, correlation IDs, random values.
- User-defined rules: ignore paths, tolerance, regex or pattern-based equivalence, field mapping between legacy and new schemas.
- Ordering rules: ignore array order where appropriate, key order.
- Type-aware and semantic comparison (for example number vs. string, null vs. missing).
- Improved matching: fuzzy URL matching, path parameter templating, request sequence awareness.
- Difference classification and severity (for example breaking, minor, informational).
- Reusable configuration or rule profiles, so other projects can adapt the tool.
- Support for non-JSON bodies (XML, form data, text), if required.

**Expected outcomes:**

- A configurable comparison that suppresses known noise and highlights meaningful differences.

**Completion criteria:**

- Each approved capability is verified with tests and with realistic sample data.
- The noise level on real sample pairs is acceptable to the user.

**Dependencies:** Phase 4, Phase 5 baseline.

---

## Phase 7: Reporting

**Objectives:** Present results in forms that people and tools can use.

**Scope (to be refined at kickoff):**

- Choose report formats based on requirements (for example human-readable and machine-readable).
- Summary view: counts of matched, missing, added, and differing requests.
- Detailed per-request views with clear diffs.
- Filtering and grouping of results.
- Exit codes or machine-readable outcomes if CI use is required.
- Redaction of sensitive data in reports.

**Expected outcomes:**

- Reports that let a developer quickly find and understand relevant differences.

**Completion criteria:**

- User reviews sample reports on real (sanitized) data and confirms they are clear and useful.
- Reports contain no unredacted sensitive data when redaction is enabled.

**Dependencies:** Phase 4. Benefits from Phase 6.

---

## Phase 8: User Interface and Usability

**Objectives:** Make the tool pleasant and clear to use, within the interface type chosen in Phase 2.

**Scope (to be defined at kickoff; may be small or merged into other phases):**

- Command-line ergonomics (arguments, help text, messages, progress) and/or a web interface, as decided.
- Error messages and guidance.
- Sensible defaults and configuration loading.

**Expected outcomes:**

- A new user can run a comparison without reading the source code.

**Completion criteria:**

- User walks through the main workflows and confirms they are usable.

**Dependencies:** Phase 4. Interacts with Phases 6 and 7.

---

## Phase 9: Dockerization and Distribution

**Objectives:** Make the tool easy to run and distribute using Docker.

**Scope (to be refined at kickoff):**

- Container image definition with a small, reproducible build.
- How input files and output reports are provided to and from the container (volumes, arguments).
- Running as a non-root user and minimal image contents.
- Image tagging and versioning approach, and where images are published (to be decided).
- Convenience for local usage (for example documented run commands or compose files, if needed).
- Verification on a clean machine or clean environment.

**Expected outcomes:**

- A documented, working way to run the tool with a single container command.

**Completion criteria:**

- The image builds from a clean checkout and produces the expected results on sample data.
- The user confirms the run experience.

**Dependencies:** A stable interface from Phases 3 to 8.

---

## Phase 10: Documentation

**Objectives:** Allow other developers to use and contribute to the tool.

**Scope (to be refined at kickoff):**

- README: purpose, quick start (Docker first), examples.
- User guide: configuration, matching rules, ignore rules, dynamic value handling, report reading.
- Worked example based on the Angular migration scenario (using sanitized data).
- Contributor guide: structure, how to run tests, conventions.
- Guidance on how to capture HAR files and handle sensitive data.
- Changelog approach.

**Expected outcomes:**

- Documentation sufficient for a new developer to get value without help.

**Completion criteria:**

- A person unfamiliar with the project follows the quick start successfully (or the user reviews it as if new).
- Docs match the actual behavior.

**Dependencies:** Phases 6 to 9. Documentation is also updated incrementally in earlier phases.

---

## Phase 11: Hardening and Release

**Objectives:** Prepare a reliable first release.

**Scope (to be refined at kickoff):**

- Review against Phase 1 requirements and non-goals.
- Robustness checks: large files, malformed input, unusual HAR exporters (browser variants).
- Security review of input handling, dependencies, and the container image.
- License selection and repository hygiene (no sensitive data).
- Versioning and release process, publishing decisions.
- Known issues list and a post-release backlog.

**Expected outcomes:**

- A tagged first release with release notes.

**Completion criteria:**

- Must-have requirements are met and verified.
- No known critical defects.
- The user approves the release.

**Dependencies:** All earlier phases.

---

## Decisions and Open Questions

- Approved decisions: [docs/decisions.md](docs/decisions.md)
- Open questions: [docs/open-questions.md](docs/open-questions.md)

## Sample Data and Data Handling (agreed in Phase 0)

- The user has real HAR files from the legacy and new applications. One is about 14 MB. They are **not sanitized**.
- Real HAR files are **never committed**. Keep them in `/private/` (git-ignored). `.gitignore` also excludes `*.har` and `*.har.json`.
- The agent may read these files for approved work, but must not copy their content into the repo, docs, tests or commit messages.

## Progress Log

| Date       | Phase     | Summary                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Setup     | Created `AGENTS.md` and `instructions.md`. No development started.                                                                                                                                                                                                                                                                                                                           |
| 2026-11-21 | 0         | Initialized git, added remote `origin`, added `.gitignore`, created `docs/`, recorded working agreements. Phase 0 confirmed complete by the user.                                                                                                                                                                                                                                            |
| 2026-11-21 | 1         | Wrote and got approval for `docs/requirements.md` (requirements, 4 build stages, acceptance examples A1-A18). Studied the structure of the two sample HARs without copying content. Phase 1 complete.                                                                                                                                                                                        |
| 2026-11-21 | 2         | Approved stack recorded in `docs/decisions.md`. Ran and deleted the throwaway spike (server parsing, diff viewers, JSON diff, panels). Wrote `docs/architecture.md` with results and proposals. User approved all items. Phase 2 complete. Version control rule added: commit during development.                                                                                            |
| 2026-11-21 | 3         | Built the workspace, shared types, HAR parser with tests, upload API, and a minimal UI with Monaco body preview. Verified with both real HARs and in Chrome (22 checks). Phase 3 complete (confirmed by the user).                                                                                                                                                                           |
| 2026-11-21 | 4         | Added structural JSON diff and entry comparison (shared), compare endpoint (server), manual pairing with missing/extra markers and a side-by-side Monaco comparison view (client). 76 unit tests pass. Verified A4 to A17 in Chrome with both real HARs (20 of 20 checks). Phase 4 complete.                                                                                                 |
| 2026-11-21 | 5         | Added `packages/e2e` (Playwright, installed Chrome) with a synthetic scenario covering A1 to A18 and a large-HAR test (2 x 4000 requests, about 40 MB each). Profiled the large case: row clicks about 0.3 s in the page, so no virtual scrolling yet; rows memoized. Filled unit-test gaps (redirects, failed and cancelled requests, XML and text bodies, scheme). Phase 5 complete.       |
| 2026-11-21 | 9 (early) | Published `malaka96/har-comparisor:0.1.0` and `:latest` to Docker Hub for `linux/amd64` and `linux/arm64` (Stage 1 feature set), at the user's request before Phase 6. Build stage runs on the build machine's platform, so the arm64 image no longer needs an emulated TypeScript and Vite build. Remaining Phase 9 work: compose file for development, image size review, release process. |
