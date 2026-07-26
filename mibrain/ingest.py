"""Document ingestion: data/inbox -> chunks -> embeddings -> data/archive.

Supported types: .txt, .md, .pdf, .docx. Files are deduplicated by content
hash; a re-dropped copy of an already ingested file is archived untouched.
"""

import os
import shutil

from memory import sha256_text


def extract_text(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in (".txt", ".md"):
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    if ext == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(path)
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    if ext == ".docx":
        import docx

        document = docx.Document(path)
        return "\n\n".join(p.text for p in document.paragraphs)
    return None


def chunk_text(text, chunk_chars, overlap):
    """Paragraph-aware sliding window chunker."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_chars:
            current = (current + "\n\n" + para).strip()
            continue
        if current:
            chunks.append(current)
            tail = current[-overlap:] if overlap > 0 else ""
            current = (tail + "\n\n" + para).strip()
        else:
            current = para
        # A single paragraph longer than the window gets hard-split.
        while len(current) > chunk_chars:
            chunks.append(current[:chunk_chars])
            current = current[chunk_chars - overlap:] if overlap > 0 else current[chunk_chars:]
    if current:
        chunks.append(current)
    return chunks


def run_ingest(store, embedder, config):
    inbox = config["paths"]["inbox"]
    archive = config["paths"]["archive"]
    os.makedirs(inbox, exist_ok=True)
    os.makedirs(archive, exist_ok=True)

    chunk_chars = int(config["ingest"]["chunk_chars"])
    overlap = int(config["ingest"]["chunk_overlap"])

    ingested, skipped, failed = 0, 0, 0
    for name in sorted(os.listdir(inbox)):
        path = os.path.join(inbox, name)
        if not os.path.isfile(path):
            continue
        try:
            text = extract_text(path)
        except Exception as exc:
            print("  FAILED %s: %s" % (name, exc))
            failed += 1
            continue
        if text is None:
            print("  skip %s (unsupported type)" % name)
            skipped += 1
            continue
        text = text.strip()
        if not text:
            print("  skip %s (no extractable text)" % name)
            shutil.move(path, os.path.join(archive, name))
            skipped += 1
            continue

        digest = sha256_text(text)
        if store.document_exists(digest):
            print("  skip %s (already in memory)" % name)
            shutil.move(path, os.path.join(archive, name))
            skipped += 1
            continue

        chunks = chunk_text(text, chunk_chars, overlap)
        doc_id, chunk_ids = store.add_document(name, path, digest, chunks)
        embeddings = embedder.encode(chunks)
        store.add_vectors(embeddings, "chunk", chunk_ids)
        shutil.move(path, os.path.join(archive, name))
        print("  ingested %s (%d chunks)" % (name, len(chunks)))
        ingested += 1

    print(
        "Ingest done: %d ingested, %d skipped, %d failed." % (ingested, skipped, failed)
    )
    return ingested
