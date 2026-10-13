---
name: codex
description: Ask OpenAI Codex (the codex CLI) for a second opinion, a code review, or to do a self-contained job in a separate worktree. Use when the user asks to "ask Codex", "check with Codex", "let Codex do it", or wants a second model to review a risky change. Not for routine work: every call spends the user's OpenAI credits on top of Claude's.
---

# Working with Codex

Codex is OpenAI's coding agent, run here as the `codex` command. Use it sparingly: each call costs the user's OpenAI credits.

## 1. Check it's ready
```bash
codex --version || npm i -g @openai/codex
codex login status
```
If it says not logged in, run `codex login --device-auth`, then show the user the link and the one-time code it prints, so they can sign in with their ChatGPT account on their phone. Never ask for or handle an API key or password in chat. If `auth.openai.com` or `api.openai.com` is blocked by the network, tell the user to allow those hosts (plus `chatgpt.com`) in the cloud environment's network settings, and stop.

## 2. Ask (read-only, most common)
Keep the prompt short and specific: say what to look at and what answer you want. Ask for a short reply.
```bash
codex exec --skip-git-repo-check -s read-only -o /tmp/codex-answer.md \
  "Review the diff of the last commit in this repo for bugs only. Reply with a numbered list: file:line, problem, fix. Max 10 items. No praise."
cat /tmp/codex-answer.md
```

## 3. Hand off a job (writes code)
Only when the user asks. Codex works in its own git worktree so it can't clash with your changes:
```bash
codex exec --worktree -s workspace-write -o /tmp/codex-answer.md "<the job, with the files to touch and how to test>"
```
Then read its result and diff, run the tests yourself (`npx playwright test`), and only bring in what passes.

## Rules
- Treat Codex's answer as a suggestion. Check it yourself; never paste it in unverified.
- Don't send secrets, personal or medical data, or the user's notes to Codex. Fake test data only.
- Tell the user in one line that you used Codex and what it found.
