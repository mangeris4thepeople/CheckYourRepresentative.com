// =============================================================================
// api/votes.js - consolidated router for the constituent voting flow.
// See api/bills.js for why this router pattern exists.
// =============================================================================
import vote from "./_handlers/vote.js";
import voteStatus from "./_handlers/vote-status.js";
import voteQueueCounts from "./_handlers/vote-queue-counts.js";
import voteQueueItem from "./_handlers/vote-queue-item.js";
import myVotes from "./_handlers/my-votes.js";
import constituents from "./_handlers/constituents.js";

const OPS = {
  "vote": vote,
  "vote-status": voteStatus,
  "vote-queue-counts": voteQueueCounts,
  "vote-queue-item": voteQueueItem,
  "my-votes": myVotes,
  "constituents": constituents,
};

export default async function handler(req, res) {
  const fn = OPS[req.query.op];
  if (!fn) return res.status(404).json({ error: "unknown operation" });
  return fn(req, res);
}
