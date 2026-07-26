"""Build tiny random-weight local models for offline pipeline testing.

This container's network policy blocks huggingface.co, so real dev models
cannot be staged here. These stand-ins exercise every MIBrain code path
(tokenization, generation, embedding, LoRA training) with real libraries
and real tensors, just useless weights. Not part of the shipped product.
"""

import os

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

from tokenizers import Tokenizer, models, pre_tokenizers, trainers
from transformers import LlamaConfig, LlamaForCausalLM, PreTrainedTokenizerFast

SAMPLE = [
    "MIBrain is a private offline memory system with a training gate.",
    "The quick brown fox jumps over the lazy dog near the river bank.",
    "SQLite and FAISS hold the memory while local models answer questions.",
    "Construction terminology includes joist, lintel, footing and rebar.",
    "Hello world, this sample text trains a tiny byte pair tokenizer.",
]

CHAT_TEMPLATE = (
    "{% for message in messages %}"
    "<|{{ message['role'] }}|>{{ message['content'] }}</s>"
    "{% endfor %}"
    "{% if add_generation_prompt %}<|assistant|>{% endif %}"
)


def build_tokenizer():
    tok = Tokenizer(models.BPE(unk_token="<unk>"))
    tok.pre_tokenizer = pre_tokenizers.Whitespace()
    trainer = trainers.BpeTrainer(
        vocab_size=512, special_tokens=["<unk>", "<s>", "</s>", "<pad>"]
    )
    tok.train_from_iterator(SAMPLE * 50, trainer)
    fast = PreTrainedTokenizerFast(
        tokenizer_object=tok,
        unk_token="<unk>",
        bos_token="<s>",
        eos_token="</s>",
        pad_token="<pad>",
    )
    fast.chat_template = CHAT_TEMPLATE
    return fast


def main():
    tokenizer = build_tokenizer()

    config = LlamaConfig(
        vocab_size=len(tokenizer),
        hidden_size=64,
        intermediate_size=128,
        num_hidden_layers=2,
        num_attention_heads=4,
        num_key_value_heads=4,
        max_position_embeddings=2048,
    )
    model = LlamaForCausalLM(config)
    os.makedirs("models/llm-hf", exist_ok=True)
    model.save_pretrained("models/llm-hf")
    tokenizer.save_pretrained("models/llm-hf")
    print("tiny chat/train model saved to models/llm-hf (%d params)"
          % sum(p.numel() for p in model.parameters()))

    from sentence_transformers import SentenceTransformer
    from sentence_transformers import models as st_models

    word = st_models.Transformer("models/llm-hf")
    pool = st_models.Pooling(word.get_word_embedding_dimension())
    st = SentenceTransformer(modules=[word, pool])
    st.save("models/bge-tiny")
    print("tiny embedding model saved to models/bge-tiny (dim %d)"
          % st.get_sentence_embedding_dimension())


if __name__ == "__main__":
    main()
