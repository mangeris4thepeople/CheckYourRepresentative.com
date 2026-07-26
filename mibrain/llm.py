"""Local LLM backends: GGUF via llama-cpp-python, or HF via transformers.

Both are strictly offline. The model files must already be on disk.
"""

import os

SYSTEM_PROMPT = (
    "You are MIBrain, a private offline assistant with a persistent local "
    "memory. Answer from the provided memory context when it is relevant, "
    "say plainly when the memory does not cover the question, and never "
    "invent sources."
)


class LocalLLM:
    def __init__(self, config):
        self.cfg = config["llm"]
        self.backend = self.cfg.get("backend", "gguf")
        self._model = None
        self._tokenizer = None

    # ---------- loading ----------

    def _load_gguf(self):
        path = self.cfg["model_path"]
        if not os.path.isfile(path):
            raise RuntimeError(
                "GGUF model not found at %s. Stage it first (dev: deploy "
                "script downloads it; production: courier)." % path
            )
        from llama_cpp import Llama

        self._model = Llama(
            model_path=path,
            n_ctx=int(self.cfg.get("context_length", 4096)),
            n_gpu_layers=int(self.cfg.get("gpu_layers", 0)),
            verbose=False,
        )

    def _load_hf(self):
        path = self.cfg["hf_model_path"]
        if not os.path.isdir(path):
            raise RuntimeError("HF model not found at %s." % path)
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self._tokenizer = AutoTokenizer.from_pretrained(path)
        self._model = AutoModelForCausalLM.from_pretrained(
            path,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
        )

    def _ensure_loaded(self):
        if self._model is not None:
            return
        if self.backend == "gguf":
            self._load_gguf()
        elif self.backend == "hf":
            self._load_hf()
        else:
            raise RuntimeError("Unknown llm.backend %r, use gguf or hf." % self.backend)

    # ---------- generation ----------

    def generate(self, messages, system=SYSTEM_PROMPT):
        """messages: list of {role, content}. Returns the reply text."""
        self._ensure_loaded()
        full = [{"role": "system", "content": system}] + list(messages)
        max_tokens = int(self.cfg.get("max_tokens", 512))
        temperature = float(self.cfg.get("temperature", 0.2))

        if self.backend == "gguf":
            out = self._model.create_chat_completion(
                messages=full, max_tokens=max_tokens, temperature=temperature
            )
            return out["choices"][0]["message"]["content"].strip()

        import torch

        prompt = self._tokenizer.apply_chat_template(
            full, tokenize=False, add_generation_prompt=True
        )
        inputs = self._tokenizer(prompt, return_tensors="pt").to(self._model.device)
        with torch.no_grad():
            output = self._model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                do_sample=temperature > 0,
                temperature=max(temperature, 0.01),
                pad_token_id=self._tokenizer.eos_token_id,
            )
        reply = output[0][inputs["input_ids"].shape[1]:]
        return self._tokenizer.decode(reply, skip_special_tokens=True).strip()
