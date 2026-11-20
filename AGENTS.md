<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Workflow
- Always stage, commit, and push changes to `main` after completing changes.

# Handoffs between coding agents
- Assign one agent to edit a task. Reviewers report findings without editing, committing, or pushing. When editing in parallel, use separate branches and worktrees. The agent responsible for integration applies approved changes and pushes to `main` after the requested review and checks.
- For a handoff, include the task, the commit or diff, which checks passed or failed, and what still needs checking. Ask reviewers for file and line references. The editing agent verifies the findings and reruns relevant checks after making fixes.
- When the user requests a cross-agent review, run `node scripts/review-with-agents.mjs` for the latest commit, pass a commit SHA for an older change, or use `--staged` for staged changes. Claude Code and Antigravity review in parallel and Codex consolidates their findings. The command sends the selected diff to all three providers through their local CLIs and uses their configured sign-ins. Use `--check` to locate the three executables without sending a review.
- For an implementation that uses all three agents, have Codex make the change and run the cross-agent review on that change. Codex should verify and address the findings before handing the result back to the user.
- If Claude Code reports that it is signed out during a cross-agent review, sign in with `claude --restricted auth login --claudeai`. The review uses restricted mode to avoid inheriting a custom Claude gateway from user settings.
