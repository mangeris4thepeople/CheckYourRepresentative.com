"""Human review gate for training candidates.

Nothing is ever trained on without approved=1, and only this command
(or a human editing the database directly) sets that flag.
"""


def run_review(store, list_only=False, approve_id=None, reject_id=None):
    if approve_id is not None:
        store.set_candidate_approval(approve_id, 1)
        print("Candidate %d approved." % approve_id)
        return
    if reject_id is not None:
        store.set_candidate_approval(reject_id, -1)
        print("Candidate %d rejected." % reject_id)
        return

    pending = store.candidates(approved=0)
    if not pending:
        print("No pending training candidates. Review queue is clean.")
        return

    if list_only:
        for cand in pending:
            print("[%d] prompt: %s" % (cand["id"], cand["prompt"]))
            print("     reply: %s" % cand["response"])
        print("%d pending. Approve with: python cli.py review --approve ID" % len(pending))
        return

    print("%d candidates pending. y approve, n reject, s skip, q quit." % len(pending))
    for cand in pending:
        print("\n[%d] prompt: %s" % (cand["id"], cand["prompt"]))
        print("     reply: %s" % cand["response"])
        while True:
            try:
                choice = input("approve? [y/n/s/q] ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                choice = "q"
            if choice in ("y", "n", "s", "q"):
                break
        if choice == "y":
            store.set_candidate_approval(cand["id"], 1)
        elif choice == "n":
            store.set_candidate_approval(cand["id"], -1)
        elif choice == "q":
            print("Stopping review, remaining candidates stay pending.")
            return
    print("Review pass complete.")
