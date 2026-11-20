<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Workflow
- Always stage, commit, and push changes to `main` after completing changes.

# Handoffs between coding agents
- Assign one agent to edit a task. Ask other agents to review the diff without editing, committing, or pushing it. Use separate Git worktrees when agents need to edit in parallel.
- For a handoff, give the next agent the task, the commit or diff to inspect, the checks already run, and any open questions. For a review, ask for findings with file and line references and give them back to the agent making the changes.
