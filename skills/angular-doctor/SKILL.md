---
name: angular-doctor
description: Run after making Angular changes to catch issues early. Use when reviewing code, finishing a feature, or fixing bugs in an Angular project.
version: 1.0.0
---

# Angular Doctor

Scans your Angular codebase for performance, correctness, and architecture issues. Outputs a 0-100 score with actionable diagnostics.

## Usage

```bash
npx -y angular-doctor@latest . --verbose --diff
```

## Workflow

Run after making changes to catch issues early. Fix errors first, then re-run to verify the score improved.
