# Agent Instructions

This repo's canonical developer guide lives in [CLAUDE.md](CLAUDE.md). Read it first for architecture, commands, production warnings, and workflow rules.

Additional Codex-specific rules:

- Treat `tasks/lessons.md` as shared agent memory. If Jay corrects an agent behavior pattern, capture the lesson there.
- Do not treat "Claude" as interchangeable with a Codex subagent. If Jay asks for Claude, wait for Claude output or explicitly say Claude is outside this environment unless Jay approves using a Codex subagent instead.
- Keep production credentials, connection strings, keys, cookies, JWTs, and browser-session data out of logs, reports, commits, and tool output.
