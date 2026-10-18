# Models, effort and backup agents

Every task names a **tier**, a Claude **model** and an **effort** level. Pick them before you send the kickoff line.

| Tier | Claude model | Use it for | If you're using another agent |
|---|---|---|---|
| **A** | Opus | Core logic that must be right, security rules, final review | that vendor's top reasoning model |
| **B** | Sonnet | Most screens and features | that vendor's standard coding model |
| **C** | Haiku | Wording, config, small well-specified changes | that vendor's small, fast model |

**Effort** is how hard the model thinks before answering. Set it where you choose the model.

| Effort | When |
|---|---|
| low | Mechanical changes spelled out step by step |
| medium | A normal feature with a clear task file |
| high | New screens, tricky logic, anything touching sign-in or data rules |

Rules of thumb
- A stronger model or higher effort always works; it just uses more of your limit.
- If a task fails its checks twice, say "Revert the last commit", then rerun it one tier up in a fresh session.
- Always clear the context between tasks. The repo files carry all the memory needed.

## When you hit a session limit

The repo is written so any coding agent can pick up the next task. `AGENTS.md` is the shared rule file; `CLAUDE.md` and `GEMINI.md` only point to it.

| Agent | Reads | Notes |
|---|---|---|
| Claude Code | `CLAUDE.md` → `AGENTS.md` | Preferred. All tasks were sized for it |
| OpenAI Codex | `AGENTS.md` | Good backup for tier A and B tasks |
| Gemini CLI | `GEMINI.md` → `AGENTS.md` | Good backup for tier B and C tasks |
| GitHub Copilot coding agent | `AGENTS.md` | Works from a GitHub issue; paste the kickoff line as the issue text |
| Cursor | `AGENTS.md` | Use agent mode with the repo open |

**Codex on ChatGPT Plus (as of 2026-10-18)** offers GPT-5.6 Terra, GPT-5.6 Sol and GPT-6 Astra:

| Tier | Codex model | Note |
|---|---|---|
| A | GPT-5.6 Sol | GPT-6 Astra only if Sol fails twice — it's the strongest and uses the most of your limit |
| B | GPT-5.6 Terra | Sol if it fails twice |
| C | GPT-5.6 Terra, low effort | |

Model names change often, so this table lists tiers, not model versions. Before using a backup agent for the first time, confirm it has a free or already-paid plan. Never add payment details for this project.

Kickoff line (the same for every agent):

```
Read AGENTS.md, then do task T14. Model: Sonnet. Effort: medium. You may push to master when tests pass.
```

Safest order when switching agents: finish or revert the current task first, so the next agent starts from a clean `master`.
