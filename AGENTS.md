# AGENTS.md: AI Collaboration Guide

This file defines how an AI agent works on this project. Read it at the start of every session, together with `instructions.md` (the roadmap).

**Working mode: autonomous.** The user has given the agent permission to do the work without asking for approval at each step. The agent decides, implements, verifies, commits, and reports. It asks only when a requirement is truly ambiguous in a way that changes the product, or when an action is on the short list in section 8.

## 1. Project Summary

An advanced HAR (HTTP Archive) comparison and analysis tool. It originated from an Angular 4 to Angular 22 rewrite, where API requests and responses of the legacy and new applications must be compared. It must also be reusable by other developers. It is run and distributed with Docker.

Approved stack: TypeScript on Node.js 26 LTS, Fastify, React with Vite, Monaco, Vitest and Playwright, in an npm workspaces repo (`shared`, `server`, `client`). Details are in `docs/architecture.md` and `docs/decisions.md`.

## 2. Core Principles

1. **Follow the roadmap and the approved requirements.** `instructions.md` and `docs/requirements.md` define what to build and in what order. Stage 1 (MVP) comes first.
2. **Decide and record.** The agent makes technical decisions itself, chooses the simplest option that meets the requirements, and records significant ones in `docs/decisions.md` with the reason.
3. **Simplicity first.** No speculative features, abstractions, or configuration "for later".
4. **Reliability over cleverness.** The tool must be dependable on real HAR files, which can be large, messy, and sensitive.
5. **Verify before claiming.** Nothing is done until it has been run and checked.

## 3. Workflow

1. **Plan briefly.** Before each phase, write its task list into `instructions.md`. No approval wait is needed.
2. **Implement in small tasks.** One logical change at a time. Each task is verified and committed.
3. **Proceed to the next phase** when the current phase meets its completion criteria. The agent does not need to wait for approval between phases.
4. **Stop and report** at the end of each phase with a concise summary: what was completed, verification results, outstanding issues, and what comes next. The agent may continue straight on to the next phase after reporting, unless the user has said to pause.
5. **Ask only when needed.** Ask when a product requirement is ambiguous and a wrong guess would waste significant work. Group questions. Otherwise state the assumption, record it, and continue.

## 4. Decision Making

- Compare realistic options briefly when a decision matters, choose one, and record it in `docs/decisions.md`. Record open questions in `docs/open-questions.md`.
- Follow the approved architecture and conventions. Changing the architecture is allowed when needed. Record the change and the reason.
- Dependencies may be added when they are needed. Prefer well-maintained, widely used packages, and keep the list short.

## 5. Testing and Verification

- A task is complete only after it is verified. Running without errors is not proof of correctness.
- Run `npm run check` (format, lint, type check, tests, build) before each commit that changes code.
- Add tests for new behavior, including HAR edge cases: empty entries, large payloads, Base64 bodies, missing fields, redirects, failed requests, and non-JSON content. Use synthetic fixtures.
- Check UI work in a real browser, not only with unit tests.
- Never claim success for something that was not run or checked. State failures and gaps plainly.

## 6. Documentation and Roadmap

- Keep `instructions.md` current: phase status, task checklists, progress log, and scope changes.
- Keep `docs/decisions.md`, `docs/open-questions.md`, and `docs/architecture.md` current.
- Update the README and other docs in the same change as the behavior they describe.

## 7. Code and Version Control

- Match the conventions of the existing code. Keep changes focused and reviewable.
- Handle errors explicitly, with clear messages. Never swallow errors silently.
- Commit completed, verified work in small logical commits with clear messages, without waiting to be asked. Pass the identity per commit (`git -c user.name="malaka96" -c user.email="madhubhashana96@gmail.com" commit ...`) and never change git config. Check `git status` before each commit.
- Do not push to the remote unless the user asks. The remote is `origin` (`https://github.com/malaka96/har_comparisor.git`).
- Do not build, run, or publish Docker images outside the Docker phase (Phase 9), unless the user asks. Verify work with the local build (`npm run check`, `npm run test:e2e`) instead.

## 8. Things the agent still must not do

These protect the user's data and work. They are not approval steps, so the agent does not ask about them. It simply does not do them, unless the user explicitly asks.

- Commit real HAR files, credentials, or secrets, or copy real HAR content into committed files, docs, tests, or commit messages.
- Remove the `.gitignore` rules for real HAR files. Real HARs live in `/private/` or outside the repo.
- Send HAR content to any external service.
- Push, force push, rewrite history, or run `git reset --hard` or `git clean` on work the agent did not make.
- Delete or overwrite files outside this project folder, or the user's own data.

## 9. HAR data handling

HAR files often contain cookies, authorization headers, tokens, session IDs, and personal data.

- The agent may read the user's real HAR files for the work. It must not print their content unnecessarily or keep copies (including screenshots and logs) after use.
- Treat HAR content as untrusted input and parse it defensively.

## 10. Communication Style

- Be concise and direct. Lead with the point.
- Distinguish facts, assumptions, and recommendations.
- Report problems and uncertainty honestly.
