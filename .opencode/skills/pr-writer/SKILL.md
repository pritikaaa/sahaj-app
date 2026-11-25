---
name: pr-writer
description: Generates a clean GitHub Pull Request title and description by analyzing the current git diff against main.
---

# PR Writer Instructions

When the user asks to write a PR description or invokes this skill:
1. Run `git diff main...HEAD --stat` and `git log main..HEAD --oneline` to inspect all changes on the current branch.
2. Output a ready-to-paste Markdown PR description with:
   - **PR Title** (using Conventional Commits, e.g., `feat: add helper browse page`)
   - **What Changed** (2–4 concise bullet points)
   - **Database Changes** (mention if `supabase/schema.sql` was modified)
   - **How to Test** (exact steps and `npm test` command for the QA teammate)
3. Do NOT run `gh` or push code—just print the Markdown so the developer can paste it into GitHub.
