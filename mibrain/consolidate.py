"""Nightly consolidation.

Folds unconsolidated conversation turns into durable memory:
1. The LLM extracts stable facts worth remembering; each becomes an
   embedded note so future retrieval can find it.
2. The LLM proposes prompt/response training pairs; they land in
   training_candidates with approved=0 and NEVER reach training until a
   human approves them via cli.py review.
"""

import json


EXTRACT_PROMPT = """Below is a transcript of recent conversations with the user.

Produce a JSON object with exactly two keys:
  "facts": a list of short, self-contained statements worth remembering
           long term (preferences, biographical details, project facts,
           decisions). Only include things clearly supported by the
           transcript. Empty list if nothing qualifies.
  "pairs": a list of objects {"prompt": ..., "response": ...} that would
           make good supervised training examples teaching an assistant
           to answer the way this user wants. At most %d. Empty list if
           nothing qualifies.

Return ONLY the JSON object, no commentary.

Transcript:
%s"""


def _parse_json_block(text):
    """Best-effort extraction of a JSON object from an LLM reply."""
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object in reply")
    return json.loads(text[start : end + 1])


def run_consolidate(store, embedder, llm, config):
    cfg = config["consolidation"]
    turns = store.pending_turns(int(cfg["max_turns_per_run"]))
    if not turns:
        print("Nothing to consolidate: no unprocessed conversation turns.")
        return

    transcript = "\n".join("%s: %s" % (t["role"], t["text"]) for t in turns)
    max_pairs = int(cfg["max_candidates_per_run"])
    prompt = EXTRACT_PROMPT % (max_pairs, transcript)

    reply = llm.generate([{"role": "user", "content": prompt}])
    try:
        data = _parse_json_block(reply)
    except (ValueError, json.JSONDecodeError) as exc:
        print("Consolidation model reply was not valid JSON (%s)." % exc)
        print("Raw reply follows, turns left unconsolidated for a retry:\n")
        print(reply)
        return

    facts = [f for f in data.get("facts", []) if isinstance(f, str) and f.strip()]
    pairs = [
        p
        for p in data.get("pairs", [])[:max_pairs]
        if isinstance(p, dict) and p.get("prompt") and p.get("response")
    ]

    note_ids = []
    for fact in facts:
        note_ids.append(store.add_note(fact.strip(), kind="fact", source="consolidation"))
    if note_ids:
        embeddings = embedder.encode([f.strip() for f in facts])
        store.add_vectors(embeddings, "note", note_ids)

    for pair in pairs:
        store.add_candidate(
            str(pair["prompt"]).strip(),
            str(pair["response"]).strip(),
            source="consolidation",
        )

    store.mark_turns_consolidated([t["id"] for t in turns])
    print(
        "Consolidated %d turns: %d facts stored, %d training candidates "
        "queued for review." % (len(turns), len(facts), len(pairs))
    )
