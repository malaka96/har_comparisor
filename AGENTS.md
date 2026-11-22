# AGENTS.md: AI Collaboration Guide

This file defines how an AI agent must work on this project. Read it at the start of every session, together with `instructions.md` (the roadmap).

## 1. Project Summary

An advanced HAR (HTTP Archive) comparison and analysis tool. It originated from an Angular 4 to Angular 22 rewrite, where API requests and responses of the legacy and new applications must be compared. It must also be reusable by other developers for other projects. It is intended to be easy to run and distribute with Docker.

The technology stack is **not yet decided**. Do not assume one.

## 2. Core Principles

1. **Collaborate, don't run ahead.** The user owns the product and its decisions. The agent proposes, explains trade-offs, and implements only what has been approved.
2. **One approved step at a time.** Work on a single phase or an explicitly approved task. Never move on to the next phase automatically.
3. **No silent decisions.** Any significant choice (language, framework, libraries, data model, storage, matching algorithm, report format, folder structure, Docker approach) must be raised with the user first.
4. **Simplicity first.** Prefer the smallest solution that meets the approved requirement. No speculative features, abstractions, or configuration "for later".
5. **Reliability and maintainability over cleverness.** The tool must be dependable on real HAR files, which can be large, messy, and sensitive.

## 3. Workflow for Every Phase or Task

1. **Review before starting.** Present the phase or task objectives, scope, proposed approach, and unresolved decisions. Wait for approval.
2. **Clarify.** Ask about ambiguous or missing requirements. Do not fill gaps with assumptions. If you must proceed on a minor assumption the user has allowed, state it explicitly and record it.
3. **Break down.** Split large phases into small tasks that can each be reviewed and verified on their own.
4. **Implement only the approved scope.** If you notice something outside scope (bug, improvement, refactor), report it and ask. Do not do it.
5. **Verify.** Validate the work before calling it done (see section 5).
6. **Update documentation and roadmap** (see section 6).
7. **Report and stop.** At the end of a phase, give a concise summary:
   - What was completed
   - Verification results
   - Outstanding issues and open questions
   - Proposed next step

   Then wait for the user's direction.

## 4. Decision Making

- When a decision is needed, present 2-3 realistic options with pros, cons, and a recommendation. Keep it short.
- Evaluate technologies against the project's needs (HAR size, Docker distribution, reuse by other developers, maintainability) before proposing them. Do not commit to a technology before it has been evaluated and approved.
- Record approved decisions in `docs/decisions.md` with date and rationale, and open questions in `docs/open-questions.md`.
- Follow the approved architecture and established conventions. If the architecture needs to change, propose the change and get approval first.
- Do not add dependencies without approval. Justify each one (purpose, maintenance status, license, size).

## 5. Testing and Verification

- A task is not complete until it has been verified. Running without errors is not proof of correctness.
- Verify against the task's stated completion criteria. Report what was checked and what could not be checked.
- Add tests that match the approved testing strategy for the approved scope. Do not add test infrastructure or broad test suites beyond what has been agreed.
- Use realistic data, including edge cases for HAR files: empty entries, large payloads, binary or base64 bodies, missing fields, redirects, failed requests, and non-JSON content.
- Never claim success for something that was not run or checked. State failures and gaps plainly.

## 6. Documentation and Roadmap Maintenance

- Keep `instructions.md` current: phase status, task checklists, progress, and scope changes. Keep `docs/decisions.md` and `docs/open-questions.md` current.
- Update the README and other docs in the same change as the behavior they describe, once those documents exist.
- Document the reasoning for non-obvious decisions, not only the outcome.
- Do not create documentation files beyond those that are approved.

## 7. Code and Change Standards

(Applies once implementation is approved.)

- Match the conventions of the existing code. Where conventions are not yet established, propose them and get approval.
- Keep changes small, focused, and reviewable. Do not mix unrelated changes.
- Do not refactor or reformat code outside the current task.
- Handle errors explicitly, with clear messages. Never swallow errors silently.
- Do not make destructive operations (deleting files, resetting version control, overwriting user data) without explicit approval.
- Use version control throughout development. Commit completed, verified work in small logical commits with clear messages, without waiting to be asked. Pass the identity per commit (`git -c user.name="malaka96" -c user.email="madhubhashana96@gmail.com" commit ...`) and never change git config. Never commit real HAR files or secrets, and check `git status` before each commit.
- Do not push or publish unless asked. The repository's remote is `origin` (`https://github.com/malaka96/har_comparisor.git`). No destructive git commands (reset --hard, force push, clean, branch deletion) unless asked.
- Small, low-risk tasks (typos, formatting in files you are already changing, updating docs to match approved work) may be done without asking. Anything that changes scope, structure, dependencies, or behavior still needs approval.

## 8. Security and Data Handling

HAR files often contain sensitive data: cookies, authorization headers, tokens, session IDs, personal data, and internal URLs.

- Treat all HAR content as sensitive. Never send it to external services, and never log or print it unnecessarily.
- Do not put real HAR files, credentials, or secrets in the repository, in examples, or in tests. Use sanitized or synthetic samples.
- Real HAR files live in `/private/` (git-ignored). You may read them for approved work, but never copy their content into committed files, docs, tests, or commit messages. Never remove the `.gitignore` rules for them.
- Raise redaction, masking, and privacy questions during requirements and design instead of deciding alone.
- Treat HAR content as untrusted input. Parse it defensively.

## 9. Communication Style

- Be concise and direct. Lead with the point.
- Ask focused questions, grouped together, rather than many interruptions.
- Distinguish clearly between facts, assumptions, and recommendations.
- Report problems and uncertainty honestly.

## 10. Hard Rules (Do Not)

- Do not implement anything before the relevant scope is discussed and approved.
- Do not begin the next phase without explicit approval.
- Do not make significant technical decisions silently.
- Do not add features, abstractions, or dependencies that were not requested.
- Do not build large portions of the application autonomously.
- Do not mark work complete without verification.
- Do not leave `instructions.md` out of date.
