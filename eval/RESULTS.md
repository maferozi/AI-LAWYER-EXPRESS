# Retrieval evaluation: AI Lawyer

This measures the **retrieval** step of the AI Lawyer RAG pipeline: for a question
about the Pakistan Penal Code (PPC), does the retriever put a chunk containing the
correct PPC section into the top-k results that would go to the LLM? Answers are
not generated or graded.

Every number below comes from `eval/run_eval.py` and is stored in
`eval/results.json`. The run is deterministic: two full runs gave identical
metrics and identical per-question ranks.

## Setup

| | |
|---|---|
| Corpus | `pakistanPenalCode.pdf` (164 pages) plus `handbookOfCriminalInvestigation.pdf` (316 pages) as a realistic distractor corpus. Both PDFs ship in the repo root. |
| Text extraction | `pypdf` page text joined with newlines. Production uses `pdf-parse`, so line breaks may differ slightly. |
| Chunking | A line-for-line Python port of `src/helper/chunkText.js`. It walks non-blank lines and closes a chunk once the running word count reaches `chunkSize`. `eval/check_chunker_parity.py` runs the repo's JS function and the port on the same text: the output is identical at every size. |
| Chunk sizes | 40, 100, 200, 300, 400 and 800 words. The code has no default: `chunkSize` is a request-body field of `POST /api/embedding/uploadPdf`. `test.http` uses 40 and the README example uses 300. |
| Questions | `eval/questions.jsonl`: 40 hand-written, layperson-style questions, each with one or two gold PPC sections. They cover 22 punishment, 7 definition, 6 exception and 5 procedural-sounding questions. Every gold section was located in the extracted text, and the script exits if any gold section is not found. |
| Retrievers | BM25 (`rank-bm25` Okapi, lowercase alphanumeric tokens); dense cosine similarity with `sentence-transformers/all-MiniLM-L6-v2` and with `BAAI/bge-small-en-v1.5` (using BGE's recommended query instruction); hybrid = BM25 + each dense model, fused with reciprocal rank fusion (k = 60). |
| Hit definition | A retrieved chunk counts as a hit if it contains text from any gold section. |
| Metrics | Hit@1, Hit@5, Hit@10 and MRR@10. Production retrieves the top 10 (`queryVector`, `topK = 10`), so **Hit@10 is the metric that matches what reaches the LLM**. |
| Hardware | Apple Silicon Mac, CPU only. Python 3.12. Full run takes about 3 minutes. |

### Mapping chunks to PPC sections

`parse_ppc_sections()` scans the extracted PPC text line by line for section
headings such as `379. Punishment for theft:`. It also handles the irregular
forms the PDF produces: a footnote marker before the number (`7[`), a suffixed
number split across two lines (`295-` followed by `A.`), `371A.` with no hyphen,
`332 Hurt:` with no period, a stray period (`152. .Assaulting`), and a heading
run into the previous line (`... Pakistan. 237. Import ...`).

A candidate heading is accepted only if its number is greater than the previous
accepted one and no more than 15 ahead. This rejects numbered list items and
cross-references. Every line belongs to the most recent accepted heading, and a
chunk's section set is the union over its lines.

Parsing stops at the `Source::` line. Everything after it is the footnote
appendix, which holds repealed or omitted historical text, so those chunks get
no section label. In total, 587 sections were parsed. The only numbers in 1–511
with no heading are ones the PDF itself lists as omitted or repealed (13, 15, 16,
18, 56, 58, 59, 61, 62, 226, 372, 373, 490, 492, 497, 498).

## Results (PPC + handbook index, 40 questions)

| Retriever | Chunk size (words) | Hit@1 | Hit@5 | Hit@10 | MRR@10 |
|---|---:|---:|---:|---:|---:|
| bm25 | 40 | 0.100 | 0.200 | 0.275 | 0.147 |
| bm25 | 100 | 0.075 | 0.250 | 0.350 | 0.155 |
| bm25 | 200 | 0.150 | 0.300 | 0.300 | 0.213 |
| bm25 | 300 | 0.175 | 0.350 | 0.375 | 0.243 |
| bm25 | 400 | 0.125 | 0.350 | 0.425 | 0.235 |
| bm25 | 800 | 0.225 | 0.375 | 0.500 | 0.293 |
| dense:minilm | 40 | 0.275 | 0.525 | 0.625 | 0.395 |
| dense:minilm | 100 | 0.300 | 0.650 | 0.725 | 0.433 |
| dense:minilm | 200 | 0.350 | 0.700 | 0.800 | 0.489 |
| dense:minilm | 300 | 0.375 | 0.600 | 0.625 | 0.465 |
| dense:minilm | 400 | 0.325 | 0.575 | 0.700 | 0.444 |
| dense:minilm | 800 | 0.275 | 0.500 | 0.525 | 0.362 |
| hybrid:minilm | 40 | 0.225 | 0.425 | 0.575 | 0.320 |
| hybrid:minilm | 100 | 0.225 | 0.525 | 0.650 | 0.347 |
| hybrid:minilm | 200 | 0.250 | 0.450 | 0.600 | 0.351 |
| hybrid:minilm | 300 | 0.350 | 0.475 | 0.550 | 0.398 |
| hybrid:minilm | 400 | 0.300 | 0.575 | 0.725 | 0.440 |
| hybrid:minilm | 800 | 0.300 | 0.500 | 0.650 | 0.383 |
| dense:bge-small | 40 | 0.225 | 0.600 | 0.625 | 0.366 |
| dense:bge-small | 100 | 0.250 | 0.475 | 0.625 | 0.346 |
| dense:bge-small | 200 | 0.300 | 0.675 | 0.775 | 0.446 |
| dense:bge-small | 300 | 0.325 | 0.575 | 0.625 | 0.426 |
| dense:bge-small | 400 | 0.325 | 0.600 | 0.675 | 0.444 |
| dense:bge-small | 800 | 0.375 | 0.500 | 0.600 | 0.438 |
| hybrid:bge-small | 40 | 0.225 | 0.425 | 0.500 | 0.308 |
| hybrid:bge-small | 100 | 0.225 | 0.500 | 0.625 | 0.342 |
| hybrid:bge-small | 200 | 0.225 | 0.525 | 0.675 | 0.353 |
| hybrid:bge-small | 300 | 0.275 | 0.450 | 0.600 | 0.365 |
| hybrid:bge-small | 400 | 0.350 | 0.550 | 0.725 | 0.451 |
| hybrid:bge-small | 800 | 0.300 | 0.525 | 0.675 | 0.402 |

### Chunk statistics

| Chunk size | Chunks (total / PPC) | Mean words | Mean PPC sections per PPC chunk | Chunks truncated, MiniLM (256 tokens) | Chunks truncated, BGE-small (512 tokens) |
|---:|---:|---:|---:|---:|---:|
| 40 | 4131 / 1496 | 46.7 | 1.27 | 2.2% | 1.3% |
| 100 | 1812 / 658 | 106.6 | 1.78 | 2.9% | 2.4% |
| 200 | 939 / 340 | 205.7 | 2.65 | 54.0% | 3.2% |
| 300 | 634 / 230 | 304.6 | 3.46 | 99.7% | 4.7% |
| 400 | 478 / 173 | 404.0 | 4.30 | 99.8% | 45.2% |
| 800 | 242 / 88 | 798.0 | 7.57 | 99.6% | 99.6% |

### Distractor ablation (Hit@10, with handbook / PPC only)

From `eval/results_ppc_only.json`, produced with `--no-handbook`.

| Retriever | 40 | 100 | 200 | 300 | 400 | 800 |
|---|---:|---:|---:|---:|---:|---:|
| bm25 | 0.275 / 0.425 | 0.350 / 0.450 | 0.300 / 0.425 | 0.375 / 0.525 | 0.425 / 0.600 | 0.500 / 0.675 |
| dense:minilm | 0.625 / 0.700 | 0.725 / 0.775 | 0.800 / 0.825 | 0.625 / 0.650 | 0.700 / 0.700 | 0.525 / 0.525 |
| hybrid:minilm | 0.575 / 0.575 | 0.650 / 0.675 | 0.600 / 0.700 | 0.550 / 0.650 | 0.725 / 0.700 | 0.650 / 0.725 |
| dense:bge-small | 0.625 / 0.725 | 0.625 / 0.675 | 0.775 / 0.775 | 0.625 / 0.625 | 0.675 / 0.700 | 0.600 / 0.625 |
| hybrid:bge-small | 0.500 / 0.575 | 0.625 / 0.650 | 0.675 / 0.650 | 0.600 / 0.600 | 0.725 / 0.700 | 0.675 / 0.725 |

## Findings

- **Best configuration: dense retrieval with MiniLM on 200-word chunks.** It
  scores Hit@10 0.800 (32 of 40; 95% Wilson interval 0.65–0.90) and MRR@10
  0.489. BGE-small at 200 words is close behind, with Hit@10 0.775.
- **Dense retrieval beats BM25 at every chunk size.** The gap is 0.25–0.50
  Hit@10 at 40–400 words and narrows to 0.03–0.10 at 800 words. Users and the statute use different words: "stealing" vs "theft",
  "trying to kill yourself" vs "attempt to commit suicide", "lying under oath"
  vs "false evidence". Keyword matching misses these; embeddings partly bridge them.
- **Hybrid RRF did not help on this data.** It scores at or below the matching
  dense model at 40–300 words; for example, MiniLM at 200 words drops from 0.800 to
  0.600 Hit@10. Equal-weight fusion with a weak BM25 ranking pushes good dense
  hits down. Hybrid is ahead only at 400 and 800 words, where the dense models
  see truncated text.
- **Chunk size matters, and 200 words is the best size for dense retrieval.**
  Very small chunks (40 words, the value in `test.http`) score lower: Hit@10
  0.625 for both models. Above 200 words, the encoders' input limits cut off
  much of each chunk: MiniLM truncates about 100% of chunks at 300 words or
  more, and BGE truncates 45% at 400 words and about 100% at 800. The README's
  example size of 300 words scores 0.625 Hit@10 with either model.
- **Shared failure mode: Islamic-law terminology.** At 200 words, both dense
  models miss q03, q04, q05, q31 and q40 (deliberate killing, accidental
  killing, death by careless driving, attempted murder, forgiveness by the
  victim's family). The PPC states these offences as *qatl-i-amd*,
  *qatl-i-khata* and *qisas*, and plain-English questions do not reach those
  terms. Both models also miss q30 (attempted suicide) and q38 (kinds of
  punishment). Fixes worth trying include query expansion or glossary injection
  for these terms, and adding section titles to chunk metadata.
- **The handbook distractor mainly hurts BM25** (Hit@10 at 800 words: 0.675 →
  0.500). Dense retrieval moves by 0.00–0.10.

## Limitations

- **Open models stand in for production.** Production embeds with OpenAI
  `text-embedding-ada-002`, which accepts 8,191 input tokens and so does not
  truncate any of these chunk sizes. MiniLM and BGE-small are small open models,
  and their truncation drives the drop above 200 words. The ranking of chunk
  sizes under ada-002 may differ.
- **Small, hand-written question set.** There are 40 questions, written by the
  evaluator from the PDF text, so one question moves a metric by 0.025. The 95%
  Wilson interval on the best Hit@10 (0.800) is 0.65–0.90. Most differences under about
  0.1 between configurations are within noise. The questions are not real user
  logs.
- **Matching is at section level.** A chunk counts as a hit if it holds *any*
  text from a gold section, even one line. Larger chunks contain more sections
  (7.6 on average at 800 words vs 1.3 at 40), which makes hits easier for big
  chunks. The section parser is heuristic, although every gold section was
  checked by hand.
- **Retrieval only.** No answers were generated, and nothing measures whether
  the LangChain stuff chain uses the retrieved text correctly.
- **The extractor differs from production.** Text comes from `pypdf`, not
  `pdf-parse`, so chunk boundaries can differ slightly from what was actually
  indexed in Pinecone.
- **Pinecone is not involved.** Search is exact cosine similarity in NumPy.
  Pinecone's serverless index is approximate, but at this scale it should
  return essentially the same top 10.

## Reproduce

```bash
python3 -m venv eval/.venv
eval/.venv/bin/pip install -r eval/requirements.txt
eval/.venv/bin/python eval/run_eval.py                                            # -> eval/results.json
eval/.venv/bin/python eval/run_eval.py --no-handbook --out results_ppc_only.json  # ablation
eval/.venv/bin/python eval/check_chunker_parity.py                                # needs node
```

Models download from Hugging Face on the first run. No API keys are needed.
