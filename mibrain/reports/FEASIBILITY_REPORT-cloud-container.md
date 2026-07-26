# MIBrain QLoRA Training Feasibility Report

Machine under test: the Claude Code cloud container running this session
(not the owner's desktop). Date: 2026-07-26. Test target: MIBrain v0.1
tree built in this session; mibrain-v0.2-agents.zip was never uploaded
to this environment, so v0.1 stands in for it (same training pipeline).

## 1. Hardware summary

| Component | Value |
|---|---|
| GPU | None. nvidia-smi and nvcc absent |
| CPU | Intel Xeon @ 2.80GHz, 4 cores, 1 thread/core, AVX-512 + VNNI |
| RAM | 15 GiB total, no swap |
| Disk | 17 GiB free at test start (252 GiB volume, session quota applies) |
| OS / Python | Linux 6.18.5, Python 3.11.15 |
| Stack | torch 2.13.0, transformers 5.14.1, peft 0.19.1, datasets 5.0.0, accelerate 1.14.0, bitsandbytes installed but unusable without CUDA |

No NVIDIA GPU means true QLoRA (4-bit NF4 via bitsandbytes) cannot run
here. The MIBrain train pipeline detected this and fell back to full
precision LoRA on CPU, which is the designed behavior. All measurements
below are the CPU LoRA path.

## 2. Measured: 0.5B run

Base model: randomly initialized clone of the exact Qwen2.5-0.5B
architecture (hidden 896, 24 layers, 14 heads / 2 KV, vocab 151936,
0.494B params). huggingface.co is blocked by this container's network
policy, so real weights could not be downloaded. Compute cost and memory
per step are identical to the real model; loss values are only pipeline
sanity checks (starting loss 11.98 matches ln(151936) = 11.93 for a
random model, confirming correct wiring).

| Metric | Value |
|---|---|
| Dataset | 30 synthetic construction terminology pairs, approved=1 |
| Epochs / optimizer steps | 2 epochs, 8 steps (batch 1, grad accum 8) |
| Wall clock | 57.2 s (run 1), 58.3 s (run 2) |
| Peak process RSS | 3.27 GB |
| Loss curve | 11.98 start, 9.87 end |
| Trainable params | 8,798,208 (1.75% of 502.8M) |
| Adapter output | models/adapters/adapter-2026-07-26_15-23-32, 34 MB |
| Throughput | ~1.06 samples/s, ~0.14 optimizer steps/s |

## 3. Extrapolation: 500 examples x 2 epochs on this hardware

CPU full precision LoRA, weights in fp32 (4 bytes/param) plus the ~1.3 GB
non-weight overhead measured on the 0.5B run. Time scales with parameter
count and token count from the measured baseline (58.3 s for 30 examples
at 0.494B). Peak VRAM column is what the same job would need in 4-bit
QLoRA on a hypothetical CUDA GPU, for shopping reference.

| Model | Est. peak RAM (CPU fp32) | Est. time 500x2 | 4-bit VRAM if GPU | Verdict on this machine |
|---|---|---|---|---|
| 0.5B | 3.3 GB (measured) | ~16 min | ~1.5 GB | FITS, proven |
| 1.5B | ~7.4 GB | ~50 min | ~3 GB | FITS, untested |
| 3B | ~13.7 GB | ~1.7 h | ~4.5 GB | DOES NOT FIT reliably. 15 GiB total, no swap, OOM kill risk |
| 8B | ~33 GB | ~4.5 h | ~9 GB | DOES NOT FIT |
| 14B | ~57 GB | ~8 h | ~14 GB | DOES NOT FIT |

## 4. Bottleneck identification

1. Compute: no GPU at all. This is the defining constraint; every step
   runs on 4 CPU cores.
2. RAM: 15 GiB with no swap caps CPU training at about 1.5B fp32.
3. Disk: adequate (model 1.9 GB, adapter 34 MB).
4. Thermal: not applicable, virtualized server CPU held steady pace
   across both runs.

## 5. Verdict

Largest model this machine can realistically fine tune tonight: 0.5B
proven, 1.5B probable, both CPU LoRA. Any NVIDIA GPU with 6+ GB VRAM
unlocks true 4-bit QLoRA up to 3B; a 12 GB card (RTX 3060 12GB class)
unlocks 8B; a 16 to 24 GB card (RTX 4060 Ti 16GB or used RTX 3090 24GB)
unlocks 14B comfortably.

## 6. Every error hit and the fix applied

1. mibrain-v0.2-agents.zip absent from this environment. Fix: ran the
   test against the MIBrain v0.1 tree built and verified earlier in this
   session. No core logic differences relevant to training.
2. huggingface.co blocked by container network policy (proxy CONNECT
   returned 403). Fix: staged a randomly initialized clone of the exact
   Qwen2.5-0.5B architecture locally. Timing and memory valid, loss
   values synthetic.
3. /usr/bin/time not installed (exit 127 on first training launch).
   Fix: replaced with a /proc VmRSS polling loop.
4. First RSS poll recorded 0.01 GB because pgrep matched the shell
   wrapper instead of the python process. Fix: tightened the pgrep
   pattern to the venv python binary and reran training.
5. bitsandbytes imports but has no CUDA backend here. No fix needed:
   train.py detected it and logged "CPU, full precision LoRA" fallback.
6. Environment issue from earlier in this session, for completeness:
   the container's system cryptography package was broken (missing
   _cffi_backend), crashing pypdf during ingest tests. Fix: pip install
   cffi. Not a MIBrain bug.

Core logic modifications: none. The only change for this test was
config.yaml training.max_seq_len set to 256, a config knob.

Transfer note: rerun this same test on the desktop after MIBrain_Setup.py
completes there. With any NVIDIA GPU present, cli.py train automatically
switches to real 4-bit QLoRA and the numbers above move to the VRAM
column. The jsonl and insertion procedure are already scripted in this
session's history.
