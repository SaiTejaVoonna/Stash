---
name: claude
description: Ask Claude Code (the claude CLI) for a second opinion, a review, or to do a job in this repository. Use when the user says "ask Claude", "check with Claude", or "let Claude do it". Each call spends the user's Claude credits.
---

# Working with Claude Code

Claude Code is Anthropic's coding agent, run as the `claude` command. It must be installed and signed in on this computer:
```bash
claude --version || npm i -g @anthropic-ai/claude-code
```
If it isn't signed in, tell the user to run `claude` once in a terminal and sign in. Never handle passwords or keys yourself.

## Ask (read-only)
```bash
claude -p --permission-mode plan "Review the last commit in this repo for bugs only. Reply with a numbered list: file:line, problem, fix. Max 10 items."
```

## Hand off a job
Only when the user asks:
```bash
claude -p --permission-mode acceptEdits "<the job, the files to touch, and how to test: npx playwright test>"
```
Then check the diff and run the tests yourself before keeping anything.

## Rules
- Keep prompts short and say exactly what answer you want.
- Treat the answer as a suggestion and verify it.
- No secrets, personal or medical data; fake test data only.
