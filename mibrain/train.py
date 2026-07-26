"""QLoRA fine tuning on human-approved training candidates.

Reads approved=1, trained=0 rows from training_candidates, fine tunes the
HF base model with a LoRA adapter, saves the adapter with a run summary,
and marks the rows trained. On CUDA machines it uses 4-bit QLoRA when
config training.load_in_4bit is true; without CUDA it falls back to plain
LoRA in full precision so the pipeline can still be proven on CPU.

Heavy dependencies (torch, transformers, peft, datasets) are imported
lazily so the rest of MIBrain works without the training stack installed.
"""

import json
import os
import time

from memory import utcnow


def _require_training_stack():
    missing = []
    for module in ("torch", "transformers", "peft", "datasets"):
        try:
            __import__(module)
        except ImportError:
            missing.append(module)
    if missing:
        raise RuntimeError(
            "Training stack incomplete, missing: %s. Install with: "
            "pip install torch transformers peft datasets accelerate "
            "(plus bitsandbytes on a CUDA machine)." % ", ".join(missing)
        )


def run_train(store, config):
    _require_training_stack()
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )

    cfg = config["training"]
    base_model = cfg["base_model"]
    if not os.path.isdir(base_model):
        raise RuntimeError(
            "Training base model not found at %s. Stage an HF-format model "
            "there first." % base_model
        )

    rows = store.candidates(approved=1, trained=0)
    if not rows:
        print(
            "No approved untrained candidates. Approve some first with: "
            "python cli.py review"
        )
        return
    print("Training on %d approved examples." % len(rows))

    use_cuda = torch.cuda.is_available()
    use_4bit = bool(cfg.get("load_in_4bit", True)) and use_cuda
    if use_4bit:
        try:
            import bitsandbytes  # noqa: F401
        except ImportError:
            print("bitsandbytes not installed, falling back to full precision LoRA.")
            use_4bit = False
    device_note = (
        "CUDA %s, 4-bit QLoRA" % torch.cuda.get_device_name(0)
        if use_4bit
        else ("CUDA, full precision LoRA" if use_cuda else "CPU, full precision LoRA")
    )
    print("Hardware mode: %s" % device_note)

    tokenizer = AutoTokenizer.from_pretrained(base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    load_kwargs = {}
    if use_4bit:
        from transformers import BitsAndBytesConfig

        load_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
        )
        load_kwargs["device_map"] = "auto"
    elif use_cuda:
        load_kwargs["torch_dtype"] = torch.bfloat16
        load_kwargs["device_map"] = "auto"

    model = AutoModelForCausalLM.from_pretrained(base_model, **load_kwargs)
    if use_4bit:
        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=int(cfg["lora_r"]),
        lora_alpha=int(cfg["lora_alpha"]),
        lora_dropout=float(cfg["lora_dropout"]),
        bias="none",
        task_type="CAUSAL_LM",
        target_modules="all-linear",
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    max_len = int(cfg["max_seq_len"])

    def to_features(row):
        messages = [
            {"role": "user", "content": row["prompt"]},
            {"role": "assistant", "content": row["response"]},
        ]
        text = tokenizer.apply_chat_template(messages, tokenize=False)
        tokens = tokenizer(text, truncation=True, max_length=max_len)
        return tokens

    dataset = Dataset.from_list(
        [{"prompt": r["prompt"], "response": r["response"]} for r in rows]
    ).map(to_features, remove_columns=["prompt", "response"])

    run_dir = os.path.join(
        cfg["output_dir"], "adapter-" + utcnow().replace(" ", "_").replace(":", "-")
    )
    args = TrainingArguments(
        output_dir=run_dir,
        num_train_epochs=float(cfg["epochs"]),
        per_device_train_batch_size=int(cfg["batch_size"]),
        gradient_accumulation_steps=int(cfg["gradient_accumulation"]),
        learning_rate=float(cfg["learning_rate"]),
        logging_steps=1,
        save_strategy="no",
        report_to=[],
        bf16=use_cuda,
        use_cpu=not use_cuda,
    )
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    started = time.time()
    result = trainer.train()
    elapsed = time.time() - started

    model.save_pretrained(run_dir)
    tokenizer.save_pretrained(run_dir)

    losses = [
        entry["loss"] for entry in trainer.state.log_history if "loss" in entry
    ]
    summary = {
        "finished_at": utcnow(),
        "examples": len(rows),
        "epochs": cfg["epochs"],
        "hardware_mode": device_note,
        "wall_clock_seconds": round(elapsed, 1),
        "first_loss": losses[0] if losses else None,
        "final_loss": losses[-1] if losses else None,
        "train_loss_mean": round(result.training_loss, 4),
        "adapter_dir": run_dir,
    }
    with open(os.path.join(run_dir, "run_summary.json"), "w") as fh:
        json.dump(summary, fh, indent=2)

    store.mark_candidates_trained([r["id"] for r in rows])
    print("Training complete in %.1fs. Adapter saved to %s" % (elapsed, run_dir))
    print(json.dumps(summary, indent=2))
