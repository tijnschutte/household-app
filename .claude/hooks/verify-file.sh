#!/usr/bin/env bash
set -uo pipefail

input=$(cat)
file=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[[ -z "$file" ]] && exit 0
[[ "$file" =~ \.(ts|tsx|js|jsx)$ ]] || exit 0
[[ -f "$file" ]] || exit 0

cd "$(git rev-parse --show-toplevel)" || exit 0

messages=()

if ! out=$(bunx prettier --write "$file" 2>&1); then
  messages+=("prettier failed on $file:"$'\n'"$out")
fi

if ! out=$(bunx eslint --fix "$file" 2>&1); then
  messages+=("eslint errors in $file:"$'\n'"$out")
fi

if ! out=$(bunx tsc --noEmit --incremental 2>&1); then
  messages+=("typecheck errors:"$'\n'"$out")
fi

# Unit tests that import the edited file (or the file itself, if it is a test).
# React reports a missing key, bad nesting or an un-acted update through
# console.error, which tests/setup.ts turns into a failure, so this is where an
# agent sees a runtime React error without a dev server. The `dot` reporter
# keeps a green run to one line; a red run prints every failure in full.
if [[ "$file" =~ ^"$PWD"/(src|tests)/.*\.tsx?$ ]]; then
  if ! out=$(bunx vitest related --project unit --passWithNoTests --reporter dot "$file" 2>&1); then
    messages+=("related unit tests failed:"$'\n'"$out")
  fi
fi

if [[ ${#messages[@]} -gt 0 ]]; then
  reason=$(printf '%s\n\n' "${messages[@]}")
  jq -n --arg reason "$reason" '{decision: "block", reason: $reason, hookSpecificOutput: {hookEventName: "PostToolUse"}}'
fi
