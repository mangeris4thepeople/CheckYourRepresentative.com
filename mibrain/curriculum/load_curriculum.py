#!/usr/bin/env python3
"""Load curriculum jsonl files into the MIBrain training queue.

Each line of a jsonl file is {"prompt": ..., "response": ...}. Pairs are
inserted into training_candidates as pending (approved=0) so the human
review gate stays intact. Pass --approve to insert them pre-approved,
which is appropriate for curriculum files you wrote or already read.

Run from the mibrain folder:
  python curriculum/load_curriculum.py curriculum/*.jsonl
  python curriculum/load_curriculum.py --approve curriculum/physics_pairs.jsonl
Then:
  python cli.py review       (if loaded pending)
  python cli.py train
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(ROOT)
sys.path.insert(0, ROOT)


def main():
    args = [a for a in sys.argv[1:] if a != "--approve"]
    approve = "--approve" in sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    import yaml
    from memory import MemoryStore, sha256_text

    store = MemoryStore(yaml.safe_load(open("config.yaml")))

    seen = {
        sha256_text(row["prompt"] + "\x00" + row["response"])
        for row in store.candidates()
    }

    total, dup, bad = 0, 0, 0
    for path in args:
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    pair = json.loads(line)
                    prompt = str(pair["prompt"]).strip()
                    response = str(pair["response"]).strip()
                    if not prompt or not response:
                        raise ValueError("empty prompt or response")
                except (ValueError, KeyError, json.JSONDecodeError) as exc:
                    print("  bad line %s:%d (%s)" % (name, lineno, exc))
                    bad += 1
                    continue
                digest = sha256_text(prompt + "\x00" + response)
                if digest in seen:
                    dup += 1
                    continue
                seen.add(digest)
                cid = store.add_candidate(prompt, response, source=name)
                if approve:
                    store.set_candidate_approval(cid, 1)
                total += 1
        print("loaded %s" % name)

    state = "approved (ready to train)" if approve else "pending review"
    print("\n%d pairs inserted as %s, %d duplicates skipped, %d bad lines."
          % (total, state, dup, bad))
    if not approve and total:
        print("Next: python cli.py review")
    if approve and total:
        print("Next: python cli.py train")


if __name__ == "__main__":
    main()
