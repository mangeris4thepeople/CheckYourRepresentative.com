"""Embedding backend. Local sentence-transformers model, strictly offline."""

import os


class Embedder:
    def __init__(self, config):
        cfg = config["embedding"]
        self.model_path = cfg["model_path"]
        self.device = cfg.get("device", "cpu")
        self.dim = int(cfg["dim"])
        self._model = None

    def _load(self):
        if self._model is not None:
            return self._model
        if not os.path.isdir(self.model_path):
            raise RuntimeError(
                "Embedding model not found at %s. Stage it first (dev: deploy "
                "script downloads it; production: courier)." % self.model_path
            )
        # Forbid any silent hub fallback. The model must already be on disk.
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(self.model_path, device=self.device)
        measured = self._model.get_sentence_embedding_dimension()
        if measured != self.dim:
            raise RuntimeError(
                "Model produces %d-dim embeddings but config says %d. "
                "Fix embedding.dim in config.yaml and delete the old index."
                % (measured, self.dim)
            )
        return self._model

    def encode(self, texts):
        """Return L2-normalized float32 embeddings, one row per text."""
        model = self._load()
        return model.encode(
            list(texts),
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        ).astype("float32")

    def encode_one(self, text):
        return self.encode([text])[0]
