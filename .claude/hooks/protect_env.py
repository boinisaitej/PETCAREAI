"""PreToolUse hook: block Write/Edit to .env files (secrets) — .env.example stays editable."""
import json
import os
import sys

data = json.load(sys.stdin)
path = (data.get("tool_input") or {}).get("file_path") or ""
base = os.path.basename(path)

is_env = base == ".env" or (base.startswith(".env.") and not base.endswith(".example"))
if is_env:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"{base} contains secrets and is protected by a project hook. "
                "Edit it manually, or update the matching .env.example instead."
            ),
        }
    }))
