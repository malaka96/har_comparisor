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

| # | Phase | Status |
|---|-------|--------|
| 0 | Project Setup and Working Agreements | [x] |
| 1 | Product Discovery and Requirements | [x] |
| 2 | Architecture and Technology Evaluation | [x] |
| 3 | Foundation: Project Skeleton and HAR Ingestion | [ ] |
| 4 | Core Comparison: Request Matching and Basic Diff | [ ] |
| 5 | Testing Strategy and Quality Baseline | [ ] |
| 6 | Advanced Comparison Capabilities | [ ] |
| 7 | Reporting | [ ] |
| 8 | User Interface and Usability | [ ] |
| 9 | Dockerization and Distribution | [ ] |
| 10 | Documentation | [ ] |
| 11 | Hardening and Release | [ ] |

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

**Scope (to be refined at kickoff):**
- Initialize the project structure with the approved tooling.
- Set up the baseline for linting, formatting, and tests, as agreed.
- HAR parsing and validation, with clear errors for malformed input.
- Normalized internal representation of entries.
- Handling of edge cases: missing fields, encoded or binary bodies, large files, empty entries.
- Basic filtering of entries (scope per requirements).

**Expected outcomes:**
- A runnable project that loads a HAR file and produces a normalized, inspectable result.
- Tests covering the ingestion behavior.

**Completion criteria:**
- Sample HAR files load correctly, and invalid ones fail with clear messages.
- Tests pass and the way to run them is documented.

**Dependencies:** Phase 2.

---

## Phase 4: Core Comparison: Request Matching and Basic Diff

**Objectives:** Match equivalent requests between two HARs and report basic differences.

**Scope (to be refined at kickoff):**
- Matching strategy for equivalent requests (method, normalized URL and path, query parameters, optional rules). Strategy to be agreed.
- Handling of duplicates and repeated calls to the same endpoint.
- Identifying missing and additional requests.
- Comparison of status codes, headers (with ignore options), request payloads, and response bodies.
- Structured, readable diff output (for example for JSON bodies).
- Minimal output sufficient to inspect results (final reports come in Phase 7).

**Expected outcomes:**
- Given two HARs, the tool lists matched, missing, and additional requests, and the differences within matched pairs.

**Completion criteria:**
- Results are correct on agreed sample pairs, including known edge cases.
- Matching decisions are explainable (the tool can show why two requests were matched).
- User reviews the output and confirms it is useful for the primary use case.

**Dependencies:** Phase 3.

---

## Phase 5: Testing Strategy and Quality Baseline

**Objectives:** Make the quality bar explicit and sustainable.

**Scope (to be refined at kickoff):**
- Review and formalize the test pyramid for the project: unit, integration, and end-to-end tests with sanitized or synthetic HAR fixtures.
- Fixture library covering the edge cases listed in `AGENTS.md`.
- Coverage expectations that are meaningful (not a number chase).
- Performance checks on large HAR files.
- Test automation approach (for example continuous integration), if approved.

**Expected outcomes:**
- A documented testing approach and a maintained fixture set.
- Gaps in coverage from earlier phases closed.

**Completion criteria:**
- Tests run with a single documented command.
- The user agrees the baseline gives sufficient confidence to build advanced features.

**Dependencies:** Phases 3 and 4. Ongoing in later phases.

---

## Phase 6: Advanced Comparison Capabilities

**Objectives:** Make comparisons meaningful by reducing noise and handling real-world variation.

**Scope (candidate items, each to be prioritized and approved separately):**
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

| Date | Phase | Summary |
|------|-------|---------|
| 2026-11-21 | Setup | Created `AGENTS.md` and `instructions.md`. No development started. |
| 2026-11-21 | 0 | Initialized git, added remote `origin`, added `.gitignore`, created `docs/`, recorded working agreements. Phase 0 confirmed complete by the user. |
| 2026-11-21 | 1 | Wrote and got approval for `docs/requirements.md` (requirements, 4 build stages, acceptance examples A1-A18). Studied the structure of the two sample HARs without copying content. Phase 1 complete. |
| 2026-11-21 | 2 | Approved stack recorded in `docs/decisions.md`. Ran and deleted the throwaway spike (server parsing, diff viewers, JSON diff, panels). Wrote `docs/architecture.md` with results and proposals. User approved all items. Phase 2 complete. Version control rule added: commit during development. |
