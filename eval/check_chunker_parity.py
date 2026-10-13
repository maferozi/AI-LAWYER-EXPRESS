"""Check that eval/run_eval.py's chunk_text() matches src/helper/chunkText.js.

Runs the repo's JavaScript chunker (needs `node` on PATH) and the Python port on
the same extracted PPC text at every evaluated chunk size and reports whether
the chunk lists are identical.

Usage (from the repo root):
    eval/.venv/bin/python eval/check_chunker_parity.py
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import run_eval as r  # noqa: E402

JS = """
const {chunkText} = require(process.argv[1]);
const fs = require('fs');
const text = fs.readFileSync(process.argv[2], 'utf8');
const sizes = JSON.parse(process.argv[3]);
const out = {};
for (const s of sizes) out[s] = chunkText(text, s);
process.stdout.write(JSON.stringify(out));
"""


def main() -> None:
    text = r.extract_text(r.PPC_PDF)
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(text)
    js_out = json.loads(subprocess.run(
        ["node", "-e", JS, str(r.REPO_DIR / "src/helper/chunkText.js"), f.name, json.dumps(r.CHUNK_SIZES)],
        check=True, capture_output=True, text=True).stdout)
    ok = True
    for s in r.CHUNK_SIZES:
        py = [c["text"] for c in r.chunk_text(text, s)]
        same = py == js_out[str(s)]
        ok &= same
        print(f"chunk size {s}: js={len(js_out[str(s)])} py={len(py)} identical={same}")
    Path(f.name).unlink()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
