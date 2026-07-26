#!/usr/bin/env python3
"""MIBrain command line.

Commands:
  status       counts, index size, model availability
  ingest       process files dropped in data/inbox
  ask "..."    one-shot RAG question
  chat         interactive RAG chat (turns feed consolidation)
  consolidate  fold recent conversations into facts + training candidates
  review       approve or reject training candidates (the human gate)
  train        QLoRA fine tune on approved candidates

Everything runs local and offline. Model files must be staged on disk.
"""

import argparse
import os
import sys

# Run from anywhere: paths in config.yaml are relative to this folder.
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
sys.path.insert(0, HERE)


def load_config():
    import yaml

    with open("config.yaml") as fh:
        return yaml.safe_load(fh)


def cmd_status(config):
    from memory import MemoryStore

    store = MemoryStore(config)
    counts = store.counts()
    index = store._load_index()

    print("MIBrain status")
    print("  database            %s" % config["paths"]["db"])
    print("  documents           %d" % counts["documents"])
    print("  chunks              %d" % counts["chunks"])
    print("  notes               %d" % counts["notes"])
    print("  conversation turns  %d" % counts["conversations"])
    print("  vectors indexed     %d (%s backend)" % (index.size(), type(index).__name__.strip("_")))
    print("  training candidates %d total, %d pending review, %d approved awaiting training"
          % (counts["training_candidates"], counts["candidates_pending"],
             counts["candidates_approved_untrained"]))

    emb = config["embedding"]["model_path"]
    gguf = config["llm"]["model_path"]
    hf = config["llm"]["hf_model_path"]
    print("  embedding model     %s (%s)" % (emb, "present" if os.path.isdir(emb) else "MISSING"))
    print("  chat model (gguf)   %s (%s)" % (gguf, "present" if os.path.isfile(gguf) else "MISSING"))
    print("  train model (hf)    %s (%s)" % (hf, "present" if os.path.isdir(hf) else "missing, only needed for train"))


def main():
    parser = argparse.ArgumentParser(prog="mibrain", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status")
    sub.add_parser("ingest")
    ask = sub.add_parser("ask")
    ask.add_argument("question", help="the question to ask over memory")
    sub.add_parser("chat")
    sub.add_parser("consolidate")
    review = sub.add_parser("review")
    review.add_argument("--list", action="store_true", help="list pending only")
    review.add_argument("--approve", type=int, metavar="ID")
    review.add_argument("--reject", type=int, metavar="ID")
    sub.add_parser("train")

    args = parser.parse_args()
    config = load_config()

    if args.command == "status":
        cmd_status(config)
        return

    from memory import MemoryStore

    store = MemoryStore(config)

    if args.command == "ingest":
        from embeddings import Embedder
        from ingest import run_ingest

        run_ingest(store, Embedder(config), config)

    elif args.command == "ask":
        from chat import run_ask
        from embeddings import Embedder
        from llm import LocalLLM

        run_ask(store, Embedder(config), LocalLLM(config), config, args.question)

    elif args.command == "chat":
        from chat import run_chat
        from embeddings import Embedder
        from llm import LocalLLM

        run_chat(store, Embedder(config), LocalLLM(config), config)

    elif args.command == "consolidate":
        from consolidate import run_consolidate
        from embeddings import Embedder
        from llm import LocalLLM

        run_consolidate(store, Embedder(config), LocalLLM(config), config)

    elif args.command == "review":
        from review import run_review

        run_review(store, list_only=args.list, approve_id=args.approve,
                   reject_id=args.reject)

    elif args.command == "train":
        from train import run_train

        run_train(store, config)


if __name__ == "__main__":
    main()
