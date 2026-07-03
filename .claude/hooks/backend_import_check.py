"""PostToolUse hook: after editing backend Python, verify the FastAPI app still imports.

Catches syntax errors, bad imports, and router registration mistakes immediately
instead of at the next server start. On failure, feeds the traceback back to Claude.
"""
import json
import os
import subprocess
import sys

data = json.load(sys.stdin)
path = ((data.get("tool_input") or {}).get("file_path") or "").replace("\\", "/")

if "/backend/" in path and path.endswith(".py"):
    backend_dir = os.path.join(os.getcwd(), "backend")
    result = subprocess.run(
        [sys.executable, "-c", "import main"],
        cwd=backend_dir, capture_output=True, text=True, timeout=90,
    )
    if result.returncode != 0:
        print(json.dumps({
            "decision": "block",
            "reason": "Backend no longer imports after this edit:\n" + result.stderr[-1500:],
        }))
