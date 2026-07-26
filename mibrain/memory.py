"""MIBrain memory store.

SQLite holds the durable record: documents, chunks, consolidated notes,
conversation turns, and the human-gated training_candidates queue.
FAISS holds the vector index; the vectors table maps FAISS ids back to
their source row (chunk or note). On platforms without a FAISS build
(for example Termux on Android) a pure NumPy flat index is used instead,
same file layout, same behavior, just slower at large scale.
Everything lives under data/ and no function in this module ever
touches the network.
"""

import hashlib
import os
import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    source_path TEXT,
    sha256 TEXT UNIQUE,
    num_chunks INTEGER DEFAULT 0,
    ingested_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id),
    position INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'fact',
    text TEXT NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY,
    session TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    consolidated INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS training_candidates (
    id INTEGER PRIMARY KEY,
    prompt TEXT NOT NULL,
    response TEXT NOT NULL,
    source TEXT,
    approved INTEGER NOT NULL DEFAULT 0,  -- 0 pending, 1 approved, -1 rejected
    trained INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vectors (
    id INTEGER PRIMARY KEY,               -- FAISS id
    kind TEXT NOT NULL,                   -- 'chunk' or 'note'
    ref_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_conv_pending ON conversations(consolidated);
CREATE INDEX IF NOT EXISTS idx_cand_state ON training_candidates(approved, trained);
CREATE INDEX IF NOT EXISTS idx_vectors_ref ON vectors(kind, ref_id);
"""


def utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class MemoryStore:
    def __init__(self, config):
        self.config = config
        self.db_path = config["paths"]["db"]
        self.index_path = config["paths"]["faiss_index"]
        os.makedirs(os.path.dirname(self.db_path) or ".", exist_ok=True)
        self.db = sqlite3.connect(self.db_path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.commit()
        self._index = None

    # ---------- vector index (FAISS with NumPy fallback) ----------

    def _load_index(self):
        if self._index is not None:
            return self._index
        dim = int(self.config["embedding"]["dim"])
        try:
            import faiss  # noqa: F401
            self._index = _FaissIndex(dim, self.index_path)
        except ImportError:
            self._index = _NumpyIndex(dim, self.index_path)
        return self._index

    def _save_index(self):
        if self._index is not None:
            self._index.save()

    def add_vectors(self, embeddings, kind, ref_ids):
        """Add normalized embeddings for chunks or notes and persist."""
        index = self._load_index()
        vector_ids = []
        cur = self.db.cursor()
        for ref_id in ref_ids:
            cur.execute(
                "INSERT INTO vectors (kind, ref_id) VALUES (?, ?)", (kind, ref_id)
            )
            vector_ids.append(cur.lastrowid)
        index.add(embeddings, vector_ids)
        self.db.commit()
        self._save_index()

    def search(self, query_embedding, top_k, min_score=0.0):
        """Return [(score, kind, text, title)] for the closest stored vectors."""
        index = self._load_index()
        if index.size() == 0:
            return []
        results = []
        for score, vector_id in index.search(query_embedding, top_k):
            if vector_id < 0 or score < min_score:
                continue
            row = self.db.execute(
                "SELECT kind, ref_id FROM vectors WHERE id = ?", (int(vector_id),)
            ).fetchone()
            if row is None:
                continue
            if row["kind"] == "chunk":
                hit = self.db.execute(
                    "SELECT c.text AS text, d.title AS title FROM chunks c "
                    "JOIN documents d ON d.id = c.document_id WHERE c.id = ?",
                    (row["ref_id"],),
                ).fetchone()
            else:
                hit = self.db.execute(
                    "SELECT text, COALESCE(source, 'memory note') AS title "
                    "FROM notes WHERE id = ?",
                    (row["ref_id"],),
                ).fetchone()
            if hit is not None:
                results.append((float(score), row["kind"], hit["text"], hit["title"]))
        return results

    # ---------- documents and chunks ----------

    def document_exists(self, sha256):
        return (
            self.db.execute(
                "SELECT 1 FROM documents WHERE sha256 = ?", (sha256,)
            ).fetchone()
            is not None
        )

    def add_document(self, title, source_path, sha256, chunk_texts):
        cur = self.db.cursor()
        cur.execute(
            "INSERT INTO documents (title, source_path, sha256, num_chunks, ingested_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (title, source_path, sha256, len(chunk_texts), utcnow()),
        )
        doc_id = cur.lastrowid
        chunk_ids = []
        for pos, text in enumerate(chunk_texts):
            cur.execute(
                "INSERT INTO chunks (document_id, position, text, created_at) "
                "VALUES (?, ?, ?, ?)",
                (doc_id, pos, text, utcnow()),
            )
            chunk_ids.append(cur.lastrowid)
        self.db.commit()
        return doc_id, chunk_ids

    # ---------- notes ----------

    def add_note(self, text, kind="fact", source=None):
        cur = self.db.cursor()
        cur.execute(
            "INSERT INTO notes (kind, text, source, created_at) VALUES (?, ?, ?, ?)",
            (kind, text, source, utcnow()),
        )
        self.db.commit()
        return cur.lastrowid

    # ---------- conversations ----------

    def log_turn(self, session, role, text):
        self.db.execute(
            "INSERT INTO conversations (session, role, text, created_at) "
            "VALUES (?, ?, ?, ?)",
            (session, role, text, utcnow()),
        )
        self.db.commit()

    def pending_turns(self, limit):
        return self.db.execute(
            "SELECT * FROM conversations WHERE consolidated = 0 "
            "ORDER BY id LIMIT ?",
            (limit,),
        ).fetchall()

    def mark_turns_consolidated(self, ids):
        if not ids:
            return
        marks = ",".join("?" for _ in ids)
        self.db.execute(
            "UPDATE conversations SET consolidated = 1 WHERE id IN (%s)" % marks, ids
        )
        self.db.commit()

    # ---------- training candidates ----------

    def add_candidate(self, prompt, response, source=None):
        cur = self.db.cursor()
        cur.execute(
            "INSERT INTO training_candidates (prompt, response, source, created_at) "
            "VALUES (?, ?, ?, ?)",
            (prompt, response, source, utcnow()),
        )
        self.db.commit()
        return cur.lastrowid

    def candidates(self, approved=None, trained=None):
        query = "SELECT * FROM training_candidates WHERE 1=1"
        params = []
        if approved is not None:
            query += " AND approved = ?"
            params.append(approved)
        if trained is not None:
            query += " AND trained = ?"
            params.append(trained)
        return self.db.execute(query + " ORDER BY id", params).fetchall()

    def set_candidate_approval(self, candidate_id, approved):
        self.db.execute(
            "UPDATE training_candidates SET approved = ? WHERE id = ?",
            (approved, candidate_id),
        )
        self.db.commit()

    def mark_candidates_trained(self, ids):
        if not ids:
            return
        marks = ",".join("?" for _ in ids)
        self.db.execute(
            "UPDATE training_candidates SET trained = 1 WHERE id IN (%s)" % marks, ids
        )
        self.db.commit()

    # ---------- status ----------

    def counts(self):
        out = {}
        for table in (
            "documents",
            "chunks",
            "notes",
            "conversations",
            "training_candidates",
            "vectors",
        ):
            out[table] = self.db.execute(
                "SELECT COUNT(*) AS n FROM %s" % table
            ).fetchone()["n"]
        out["candidates_pending"] = self.db.execute(
            "SELECT COUNT(*) AS n FROM training_candidates WHERE approved = 0"
        ).fetchone()["n"]
        out["candidates_approved_untrained"] = self.db.execute(
            "SELECT COUNT(*) AS n FROM training_candidates "
            "WHERE approved = 1 AND trained = 0"
        ).fetchone()["n"]
        return out


class _FaissIndex:
    """Cosine similarity index backed by FAISS IndexFlatIP with id mapping."""

    def __init__(self, dim, path):
        import faiss
        self.path = path
        self.dim = dim
        if os.path.exists(path):
            self.index = faiss.read_index(path)
            if self.index.d != dim:
                raise RuntimeError(
                    "Index dim %d does not match config embedding.dim %d. "
                    "Delete %s to rebuild." % (self.index.d, dim, path)
                )
        else:
            self.index = faiss.IndexIDMap2(faiss.IndexFlatIP(dim))

    def size(self):
        return self.index.ntotal

    def add(self, embeddings, ids):
        import numpy as np
        self.index.add_with_ids(
            np.asarray(embeddings, dtype="float32"),
            np.asarray(ids, dtype="int64"),
        )

    def search(self, query, top_k):
        import numpy as np
        q = np.asarray([query], dtype="float32")
        scores, ids = self.index.search(q, min(top_k, self.index.ntotal))
        return [(float(s), int(i)) for s, i in zip(scores[0], ids[0])]

    def save(self):
        import faiss
        faiss.write_index(self.index, self.path)


class _NumpyIndex:
    """Flat cosine similarity index for platforms without FAISS (Termux etc)."""

    def __init__(self, dim, path):
        import numpy as np
        self.path = path + ".npz"
        self.dim = dim
        if os.path.exists(self.path):
            data = np.load(self.path)
            self.vectors = data["vectors"]
            self.ids = data["ids"]
            if self.vectors.shape[1] != dim:
                raise RuntimeError(
                    "Index dim %d does not match config embedding.dim %d. "
                    "Delete %s to rebuild." % (self.vectors.shape[1], dim, self.path)
                )
        else:
            self.vectors = np.zeros((0, dim), dtype="float32")
            self.ids = np.zeros((0,), dtype="int64")

    def size(self):
        return int(self.vectors.shape[0])

    def add(self, embeddings, ids):
        import numpy as np
        self.vectors = np.vstack(
            [self.vectors, np.asarray(embeddings, dtype="float32")]
        )
        self.ids = np.concatenate([self.ids, np.asarray(ids, dtype="int64")])

    def search(self, query, top_k):
        import numpy as np
        q = np.asarray(query, dtype="float32")
        scores = self.vectors @ q
        order = np.argsort(-scores)[: min(top_k, len(scores))]
        return [(float(scores[i]), int(self.ids[i])) for i in order]

    def save(self):
        import numpy as np
        np.savez(self.path, vectors=self.vectors, ids=self.ids)
