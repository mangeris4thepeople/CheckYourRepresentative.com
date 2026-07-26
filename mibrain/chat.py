"""RAG ask and chat over the local memory store."""

import uuid

from llm import SYSTEM_PROMPT


def build_context(store, embedder, config, question):
    top_k = int(config["retrieval"]["top_k"])
    min_score = float(config["retrieval"]["min_score"])
    hits = store.search(embedder.encode_one(question), top_k, min_score)
    if not hits:
        return "", []
    blocks = []
    for i, (score, kind, text, title) in enumerate(hits, 1):
        blocks.append("[%d] (%s, %s, score %.2f)\n%s" % (i, title, kind, score, text))
    return "\n\n".join(blocks), hits


def answer(store, embedder, llm, config, question, history=None):
    context, hits = build_context(store, embedder, config, question)
    if context:
        user_msg = (
            "Memory context:\n%s\n\nQuestion: %s\n\n"
            "Answer using the memory context above where relevant. "
            "If it does not cover the question, say so." % (context, question)
        )
    else:
        user_msg = (
            "No relevant memory was found for this question.\n\n"
            "Question: %s\n\nSay that your memory has nothing on this yet, "
            "then answer from general knowledge if you can, clearly labeled "
            "as such." % question
        )
    messages = list(history or []) + [{"role": "user", "content": user_msg}]
    return llm.generate(messages, system=SYSTEM_PROMPT), hits


def run_ask(store, embedder, llm, config, question):
    reply, hits = answer(store, embedder, llm, config, question)
    print(reply)
    if hits:
        print("\nsources: " + ", ".join(sorted({h[3] for h in hits})))


def run_chat(store, embedder, llm, config):
    session = uuid.uuid4().hex[:12]
    print("MIBrain chat. Type your message, or 'exit' to quit.")
    history = []
    while True:
        try:
            user = input("\nyou> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not user:
            continue
        if user.lower() in ("exit", "quit"):
            break
        store.log_turn(session, "user", user)
        reply, _ = answer(store, embedder, llm, config, user, history)
        # History keeps the raw exchange, not the injected context blocks.
        history.append({"role": "user", "content": user})
        history.append({"role": "assistant", "content": reply})
        history = history[-12:]
        store.log_turn(session, "assistant", reply)
        print("\nmibrain> " + reply)
    print("Chat ended. Turns were logged for the next consolidation run.")
