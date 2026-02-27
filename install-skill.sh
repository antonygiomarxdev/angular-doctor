#!/usr/bin/env bash
# Installs the angular-doctor skill into your AI coding agent.
# Supports: Cursor, Claude Code, Windsurf, Amp Code, Codex, Gemini CLI, OpenCode
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/antonygiomarxdev/angular-doctor/main/install-skill.sh | bash

set -euo pipefail

SKILL_NAME="angular-doctor"
SKILL_DESCRIPTION="Run after making Angular changes to catch issues early. Use when reviewing code, finishing a feature, or fixing bugs in an Angular project."
SKILL_COMMAND="npx -y angular-doctor@latest . --verbose --diff"

SKILL_BODY="# Angular Doctor

Scans your Angular codebase for performance, correctness, and architecture issues. Outputs a 0-100 score with actionable diagnostics.

## Usage

\`\`\`bash
${SKILL_COMMAND}
\`\`\`

## Workflow

Run after making changes to catch issues early. Fix errors first, then re-run to verify the score improved."

installed=0

# ---------------------------------------------------------------------------
# Cursor — .cursor/rules/angular-doctor.mdc
# ---------------------------------------------------------------------------
if [ -d ".cursor" ] || command -v cursor &>/dev/null; then
  mkdir -p ".cursor/rules"
  cat > ".cursor/rules/${SKILL_NAME}.mdc" <<EOF
---
description: ${SKILL_DESCRIPTION}
globs:
alwaysApply: false
---

${SKILL_BODY}
EOF
  echo "✓ Installed for Cursor (.cursor/rules/${SKILL_NAME}.mdc)"
  installed=$((installed + 1))
fi

# ---------------------------------------------------------------------------
# Claude Code — .claude/SKILL.md
# ---------------------------------------------------------------------------
if command -v claude &>/dev/null || [ -d ".claude" ]; then
  mkdir -p ".claude"
  cat > ".claude/${SKILL_NAME}.md" <<EOF
---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---

${SKILL_BODY}
EOF
  echo "✓ Installed for Claude Code (.claude/${SKILL_NAME}.md)"
  installed=$((installed + 1))
fi

# ---------------------------------------------------------------------------
# Windsurf — .windsurf/rules/angular-doctor.md
# ---------------------------------------------------------------------------
if [ -d ".windsurf" ] || command -v windsurf &>/dev/null; then
  mkdir -p ".windsurf/rules"
  cat > ".windsurf/rules/${SKILL_NAME}.md" <<EOF
---
description: ${SKILL_DESCRIPTION}
---

${SKILL_BODY}
EOF
  echo "✓ Installed for Windsurf (.windsurf/rules/${SKILL_NAME}.md)"
  installed=$((installed + 1))
fi

# ---------------------------------------------------------------------------
# Amp Code — .amp/skills/angular-doctor.md
# ---------------------------------------------------------------------------
if command -v amp &>/dev/null || [ -d ".amp" ]; then
  mkdir -p ".amp/skills"
  cat > ".amp/skills/${SKILL_NAME}.md" <<EOF
---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---

${SKILL_BODY}
EOF
  echo "✓ Installed for Amp Code (.amp/skills/${SKILL_NAME}.md)"
  installed=$((installed + 1))
fi

# ---------------------------------------------------------------------------
# Codex (OpenAI) — appended to AGENTS.md
# ---------------------------------------------------------------------------
if command -v codex &>/dev/null || [ -f "AGENTS.md" ]; then
  AGENTS_ENTRY="
## ${SKILL_NAME}

${SKILL_DESCRIPTION}

Run \`${SKILL_COMMAND}\` after making Angular changes.
"
  if [ -f "AGENTS.md" ]; then
    if ! grep -q "${SKILL_NAME}" AGENTS.md 2>/dev/null; then
      printf '\n%s' "${AGENTS_ENTRY}" >> AGENTS.md
      echo "✓ Installed for Codex (appended to AGENTS.md)"
      installed=$((installed + 1))
    else
      echo "  Codex: ${SKILL_NAME} already present in AGENTS.md, skipping."
    fi
  else
    printf '%s' "${AGENTS_ENTRY}" > AGENTS.md
    echo "✓ Installed for Codex (created AGENTS.md)"
    installed=$((installed + 1))
  fi
fi

# ---------------------------------------------------------------------------
# Gemini CLI — appended to GEMINI.md
# ---------------------------------------------------------------------------
if command -v gemini &>/dev/null || [ -f "GEMINI.md" ]; then
  GEMINI_ENTRY="
## ${SKILL_NAME}

${SKILL_DESCRIPTION}

Run \`${SKILL_COMMAND}\` after making Angular changes.
"
  if [ -f "GEMINI.md" ]; then
    if ! grep -q "${SKILL_NAME}" GEMINI.md 2>/dev/null; then
      printf '\n%s' "${GEMINI_ENTRY}" >> GEMINI.md
      echo "✓ Installed for Gemini CLI (appended to GEMINI.md)"
      installed=$((installed + 1))
    else
      echo "  Gemini CLI: ${SKILL_NAME} already present in GEMINI.md, skipping."
    fi
  else
    printf '%s' "${GEMINI_ENTRY}" > GEMINI.md
    echo "✓ Installed for Gemini CLI (created GEMINI.md)"
    installed=$((installed + 1))
  fi
fi

# ---------------------------------------------------------------------------
# OpenCode — .opencode/skills/angular-doctor.md
# ---------------------------------------------------------------------------
if command -v opencode &>/dev/null || [ -d ".opencode" ]; then
  mkdir -p ".opencode/skills"
  cat > ".opencode/skills/${SKILL_NAME}.md" <<EOF
---
name: ${SKILL_NAME}
description: ${SKILL_DESCRIPTION}
---

${SKILL_BODY}
EOF
  echo "✓ Installed for OpenCode (.opencode/skills/${SKILL_NAME}.md)"
  installed=$((installed + 1))
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
if [ "${installed}" -eq 0 ]; then
  echo "No supported AI coding agent detected in this directory."
  echo ""
  echo "Supported agents: Cursor, Claude Code, Windsurf, Amp Code, Codex, Gemini CLI, OpenCode"
  echo ""
  echo "To install manually, copy skills/angular-doctor/SKILL.md into your agent's rules directory."
else
  echo "angular-doctor skill installed for ${installed} agent(s)."
  echo ""
  echo "Your coding agent will now run angular-doctor automatically after Angular changes."
fi
