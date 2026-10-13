"""Retrieval evaluation for the AI Lawyer RAG backend.

Reproduces the production ingestion step (PDF text -> word-count chunks, see
src/helper/chunkText.js) and measures how often the retriever puts a chunk that
contains the correct Pakistan Penal Code section into the top-k results.

Usage (from the repo root):
    eval/.venv/bin/python eval/run_eval.py

Outputs eval/results.json and prints a markdown table. Everything is
deterministic: no API keys, no sampling; models are open sentence-transformers
checkpoints run on CPU by default.
"""

from __future__ import annotations

import argparse
import json
import platform
import re
import sys
import time
from pathlib import Path

import numpy as np
from pypdf import PdfReader
from rank_bm25 import BM25Okapi

EVAL_DIR = Path(__file__).resolve().parent
REPO_DIR = EVAL_DIR.parent

PPC_PDF = REPO_DIR / "pakistanPenalCode.pdf"
HANDBOOK_PDF = REPO_DIR / "handbookOfCriminalInvestigation.pdf"

# chunkSize is a request-body parameter of POST /api/embedding/uploadPdf; the
# code has no default. 40 is the value in test.http, 300 the value in the README
# example; 100/200/400/800 give a sweep around them.
CHUNK_SIZES = [40, 100, 200, 300, 400, 800]

MODELS = {
    "minilm": {
        "name": "sentence-transformers/all-MiniLM-L6-v2",
        "query_prefix": "",
    },
    "bge-small": {
        "name": "BAAI/bge-small-en-v1.5",
        # Query instruction recommended by the BGE authors for retrieval.
        "query_prefix": "Represent this sentence for searching relevant passages: ",
    },
}

RRF_K = 60
KS = (1, 5, 10)


# --------------------------------------------------------------------------
# Text extraction
# --------------------------------------------------------------------------

def extract_text(pdf_path: Path) -> str:
    """Extract text page by page with pypdf (production uses pdf-parse)."""
    reader = PdfReader(str(pdf_path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


# --------------------------------------------------------------------------
# Chunking: line-for-line port of src/helper/chunkText.js
# --------------------------------------------------------------------------

def js_word_count(s: str) -> int:
    """`s.split(' ').length` in JavaScript (Python's str.split(' ') matches it,
    including '' -> [''] -> 1)."""
    return len(s.split(" "))


def chunk_text(text: str, min_words: int) -> list[dict]:
    """Port of chunkText(text, minWords).

    JS:  paragraphs = text.split(/\\n+/).map(trim).filter(nonEmpty)
         for each paragraph:
           if (currentChunk.join(' ').split(' ').length + paragraphWordCount >= minWords)
             push paragraph, emit chunk, reset
           else push paragraph
         emit leftover

    Splitting on /\\n+/ then dropping empty-after-trim items is the same as
    taking every non-blank line, so we iterate lines and keep their indices
    (used later to map chunks back to PPC sections). The emitted chunk text is
    identical to what the JS function produces for the same input text.
    """
    paragraphs = [(i, ln.strip()) for i, ln in enumerate(text.split("\n")) if ln.strip()]
    chunks: list[dict] = []
    cur: list[tuple[int, str]] = []
    for idx, para in paragraphs:
        para_wc = js_word_count(para)
        cur_wc = js_word_count(" ".join(p for _, p in cur))
        cur.append((idx, para))
        if cur_wc + para_wc >= min_words:
            chunks.append(_make_chunk(cur))
            cur = []
    if cur:
        chunks.append(_make_chunk(cur))
    return chunks


def _make_chunk(paras: list[tuple[int, str]]) -> dict:
    return {
        "text": " ".join(p for _, p in paras).strip(),
        "lines": [i for i, _ in paras],
    }


# --------------------------------------------------------------------------
# PPC section parsing
# --------------------------------------------------------------------------
# Headings in the extracted PPC text look like
#   "379. Punishment for theft:"            (standard)
#   " 7[  " / "5. Certain laws ..."          (footnote marker before heading)
#   "\"371A. Selling person ..."            (stray quote, suffix without hyphen)
#   "295-" newline "A. Deliberate ..."      (hyphenated suffix split over 2 lines)
#   "354- Assault ..." newline "A. Whoever" (suffix letter on the next line)
#   "152. .Assaulting ..."                  (stray period)
#   "332 Hurt:"                             (missing period)
#   "... Pakistan. 237. Import or ..."      (heading run into previous line)
# A candidate heading is accepted only if its section key is greater than the
# previous accepted key and at most 15 section numbers ahead; this rejects
# numbered list items inside a section ("1. Threatening a person ...") and
# cross-references. A repeat of a recent key (the PDF prints 457/458 twice) is
# accepted so the duplicated text is still labelled correctly.
# Parsing stops at the first "Source::" line: everything after it is the
# footnotes appendix (repealed/omitted historical text), which is left
# unlabelled.

_PFX = r"^\s*(?:\d+\[\s*)?\"?"
RE_STD = re.compile(_PFX + r"(\d{1,3})(?:-?([A-Z]{1,2}))?\.[\s.]*[A-Z\"'(]")
RE_HYPHEN_ONLY = re.compile(_PFX + r"(\d{1,3})-\s*$")
RE_HYPHEN_TITLE = re.compile(_PFX + r"(\d{1,3})-\s+[A-Z]")
RE_SUFFIX_LINE = re.compile(r"^\s*([A-Z]{1,2})(?:\.\s|\.?\s*$)")
RE_NO_PERIOD = re.compile(_PFX + r"(\d{1,3}) ([A-Z][A-Za-z ,'-]*):\s*$")
RE_MIDLINE = re.compile(r"\.\s+(\d{1,3})\.\s+[A-Z][a-z]")


def sec_label(key: tuple[int, str]) -> str:
    return f"{key[0]}-{key[1]}" if key[1] else str(key[0])


def parse_label(label: str) -> tuple[int, str]:
    m = re.fullmatch(r"(\d+)(?:-([A-Z]{1,2}))?", label)
    if not m:
        raise ValueError(f"bad section label {label!r}")
    return int(m.group(1)), m.group(2) or ""


def parse_ppc_sections(text: str) -> tuple[list[set[str]], dict[str, str]]:
    """Return (sections_per_line, heading_line_per_section)."""
    lines = text.split("\n")
    end = next((i for i, ln in enumerate(lines) if ln.startswith("Source::")), len(lines))
    line_secs: list[set[str]] = [set() for _ in lines]
    headings: dict[str, str] = {}
    prev: tuple[int, str] = (0, "")
    seen: set[tuple[int, str]] = set()
    current: str | None = None

    def accept(key: tuple[int, str]) -> bool:
        if key > prev and key[0] - prev[0] <= 15:
            return True
        return key in seen and 0 <= prev[0] - key[0] <= 2  # duplicated block

    for i in range(end):
        ln = lines[i]
        nxt = lines[i + 1] if i + 1 < end else ""
        cand = None
        m_suf = RE_SUFFIX_LINE.match(nxt)
        if (m := RE_HYPHEN_ONLY.match(ln)) and m_suf:
            cand = (int(m.group(1)), m_suf.group(1))
        elif (m := RE_HYPHEN_TITLE.match(ln)) and m_suf:
            cand = (int(m.group(1)), m_suf.group(1))
        elif m := RE_STD.match(ln):
            cand = (int(m.group(1)), m.group(2) or "")
        elif m := RE_NO_PERIOD.match(ln):
            cand = (int(m.group(1)), "")

        if cand and accept(cand):
            prev = max(prev, cand)
            seen.add(cand)
            current = sec_label(cand)
            headings.setdefault(current, " ".join(x.strip() for x in lines[i:i + 3]).strip())
        if current:
            line_secs[i].add(current)

        # Heading glued onto the end of the previous section's last line.
        for m in RE_MIDLINE.finditer(ln):
            key = (int(m.group(1)), "")
            if accept(key):
                prev = max(prev, key)
                seen.add(key)
                current = sec_label(key)
                headings.setdefault(current, ln[m.start() + 1 :].strip())
                line_secs[i].add(current)
    return line_secs, headings


# --------------------------------------------------------------------------
# Retrieval
# --------------------------------------------------------------------------

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(s: str) -> list[str]:
    return TOKEN_RE.findall(s.lower())


def ranks_from_scores(scores: np.ndarray) -> np.ndarray:
    """Return chunk indices ordered best-first (stable for ties)."""
    return np.argsort(-scores, kind="stable")


def rrf(*orders: np.ndarray, k: int = RRF_K) -> np.ndarray:
    n = len(orders[0])
    fused = np.zeros(n)
    for order in orders:
        rank = np.empty(n, dtype=np.int64)
        rank[order] = np.arange(1, n + 1)
        fused += 1.0 / (k + rank)
    return ranks_from_scores(fused)


def evaluate(orders: list[np.ndarray], chunk_secs: list[set[str]], golds: list[set[str]]):
    per_q = []
    for order, gold in zip(orders, golds):
        first = None
        for r, ci in enumerate(order[: max(KS)], start=1):
            if chunk_secs[ci] & gold:
                first = r
                break
        per_q.append(first)
    metrics = {f"hit@{k}": float(np.mean([f is not None and f <= k for f in per_q])) for k in KS}
    metrics["mrr@10"] = float(np.mean([1.0 / f if f else 0.0 for f in per_q]))
    return metrics, per_q


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="cpu", help="torch device for embeddings (default cpu)")
    ap.add_argument("--no-handbook", action="store_true", help="index the PPC only")
    ap.add_argument("--chunk-sizes", type=int, nargs="*", default=CHUNK_SIZES)
    ap.add_argument("--out", default="results.json", help="output file name inside eval/")
    args = ap.parse_args()

    t0 = time.time()
    from sentence_transformers import SentenceTransformer  # slow import

    questions = [json.loads(l) for l in (EVAL_DIR / "questions.jsonl").read_text().splitlines() if l.strip()]
    golds = [set(q["gold_sections"]) for q in questions]

    ppc_text = extract_text(PPC_PDF)
    line_secs, headings = parse_ppc_sections(ppc_text)
    missing = sorted({s for g in golds for s in g} - set(headings), key=parse_label)
    if missing:
        sys.exit(f"Gold sections not found in parsed PPC text: {missing}")

    docs = [("ppc", ppc_text)]
    use_handbook = HANDBOOK_PDF.exists() and not args.no_handbook
    if use_handbook:
        docs.append(("handbook", extract_text(HANDBOOK_PDF)))
    t_extract = time.time() - t0

    models = {}
    for key, cfg in MODELS.items():
        m = SentenceTransformer(cfg["name"], device=args.device)
        models[key] = m

    results = {
        "setup": {
            "ppc_pdf": PPC_PDF.name,
            "handbook_pdf": HANDBOOK_PDF.name if use_handbook else None,
            "num_questions": len(questions),
            "chunk_sizes": args.chunk_sizes,
            "models": {k: {"name": v["name"], "query_prefix": v["query_prefix"],
                           "max_seq_length": models[k].max_seq_length} for k, v in MODELS.items()},
            "rrf_k": RRF_K,
            "parsed_ppc_sections": len(headings),
            "python": platform.python_version(),
            "platform": platform.platform(),
            "device": args.device,
        },
        "chunking": {},
        "metrics": {},
        "per_question": {},
    }

    q_texts = [q["question"] for q in questions]
    q_embs = {k: models[k].encode([MODELS[k]["query_prefix"] + q for q in q_texts],
                                  normalize_embeddings=True, batch_size=64)
              for k in models}

    timings = {"extract_and_parse_s": round(t_extract, 1)}
    for size in args.chunk_sizes:
        ts = time.time()
        chunks, chunk_secs = [], []
        for doc_name, text in docs:
            for c in chunk_text(text, size):
                secs = set().union(*(line_secs[i] for i in c["lines"])) if doc_name == "ppc" else set()
                chunks.append({"doc": doc_name, "text": c["text"]})
                chunk_secs.append(secs)
        texts = [c["text"] for c in chunks]
        wc = np.array([len(t.split()) for t in texts])
        ppc_mask = np.array([c["doc"] == "ppc" for c in chunks])
        results["chunking"][size] = {
            "num_chunks": len(chunks),
            "num_ppc_chunks": int(ppc_mask.sum()),
            "mean_words_per_chunk": round(float(wc.mean()), 1),
            "mean_sections_per_ppc_chunk": round(float(np.mean([len(s) for s, p in zip(chunk_secs, ppc_mask) if p])), 2),
        }

        orders: dict[str, list[np.ndarray]] = {}
        bm25 = BM25Okapi([tokenize(t) for t in texts])
        orders["bm25"] = [ranks_from_scores(bm25.get_scores(tokenize(q))) for q in q_texts]

        for mk, model in models.items():
            tok = model.tokenizer
            n_tok = np.array([len(tok(t, add_special_tokens=True)["input_ids"]) for t in texts])
            results["chunking"][size][f"pct_chunks_truncated_{mk}"] = round(
                float((n_tok > model.max_seq_length).mean() * 100), 1)
            embs = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
            sims = q_embs[mk] @ embs.T
            orders[f"dense:{mk}"] = [ranks_from_scores(s) for s in sims]
            orders[f"hybrid:{mk}"] = [rrf(b, d) for b, d in zip(orders["bm25"], orders[f"dense:{mk}"])]

        for name, ords in orders.items():
            m, per_q = evaluate(ords, chunk_secs, golds)
            results["metrics"].setdefault(name, {})[size] = m
            results["per_question"].setdefault(name, {})[size] = per_q
        timings[f"chunk_{size}_s"] = round(time.time() - ts, 1)
        print(f"chunk size {size}: {len(chunks)} chunks, {timings[f'chunk_{size}_s']}s", flush=True)

    timings["total_s"] = round(time.time() - t0, 1)
    results["timings"] = timings
    results["questions"] = [{"id": q["id"], "question": q["question"], "gold_sections": q["gold_sections"],
                             "gold_headings": {s: headings[s] for s in q["gold_sections"]}} for q in questions]

    (EVAL_DIR / args.out).write_text(json.dumps(results, indent=2))
    print(markdown_table(results))
    print(f"\nTotal runtime: {timings['total_s']}s")


def markdown_table(results: dict) -> str:
    rows = ["| Retriever | Chunk size (words) | Hit@1 | Hit@5 | Hit@10 | MRR@10 |",
            "|---|---:|---:|---:|---:|---:|"]
    for name, by_size in results["metrics"].items():
        for size, m in by_size.items():
            rows.append(f"| {name} | {size} | {m['hit@1']:.3f} | {m['hit@5']:.3f} | "
                        f"{m['hit@10']:.3f} | {m['mrr@10']:.3f} |")
    return "\n".join(rows)


if __name__ == "__main__":
    main()
