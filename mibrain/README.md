# MIBrain v0.1

A self contained, offline, trainable memory system.

* SQLite + FAISS memory store (`data/mibrain.db`, `data/index.faiss`)
* Local GGUF or HF chat backends, no network calls anywhere in core logic
* Document ingestion (`.txt`, `.md`, `.pdf`, `.docx`) from `data/inbox/`
* RAG chat and one-shot ask over everything in memory
* Nightly consolidation: conversations become durable facts plus proposed
  training pairs
* QLoRA training pipeline gated on human-approved examples only

## Layout

```
mibrain/
  cli.py            command line entry point
  config.yaml       all knobs, paths relative to this folder
  memory.py         SQLite schema + FAISS (or NumPy fallback) index
  embeddings.py     sentence-transformers embedder, offline enforced
  llm.py            GGUF (llama-cpp-python) and HF (transformers) backends
  ingest.py         inbox -> chunks -> vectors -> archive
  chat.py           RAG ask/chat
  consolidate.py    conversations -> facts + training candidates
  review.py         human approval gate
  train.py          QLoRA on approved candidates, adapter output
  data/inbox/       drop documents here, then run ingest
  data/archive/     processed documents land here
  models/           staged models (never committed, never downloaded by core)
    bge-small/      embedding model (sentence-transformers format)
    llm/model.gguf  chat model (GGUF)
    llm-hf/         training base model (HF format)
    adapters/       training run outputs
```

## Quick start (dev machine, internet OK during dev phase)

```
bash deploy_mibrain.sh        # from the folder containing mibrain-v0.1.zip
```

or manually:

```
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# stage models into models/ (see deploy script for the dev downloads)
python cli.py status
```

## Daily loop

```
python cli.py ingest          # after dropping files in data/inbox
python cli.py chat            # talk; turns are logged
python cli.py consolidate     # nightly: distill turns into memory
python cli.py review          # approve/reject proposed training pairs
python cli.py train           # QLoRA on approved pairs only
```

## The training gate

`consolidate` only ever writes candidates with `approved=0`. Nothing is
trained on until a human runs `review` and approves it. `train` reads
`approved=1 AND trained=0`, saves a LoRA adapter under `models/adapters/`,
writes `run_summary.json` with measured wall clock and loss, and marks the
rows trained.

## Air gap posture

Core modules set `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` before
loading any model and contain no network calls. Model files reach the
production node by courier and are staged under `models/` by hand. The
only downloader in the project lives in the dev deploy script.

## Phone

See `PHONE.md` for running MIBrain on Android via Termux (NumPy index
fallback, small GGUF models).
