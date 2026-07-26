#!/usr/bin/env bash
# MIBrain one-shot deploy. Dev machine version (internet OK during dev phase;
# the air gap applies to the final node, which stages everything via courier).
#
# Usage: put mibrain-v0.1.zip in the same folder as this script, then:
#   bash deploy_mibrain.sh
#
# What it does: unzip, venv, install deps, pull small dev models, set cpu
# config if no GPU is present, run a smoke test, print next steps.

set -euo pipefail

echo "=== MIBrain deploy ==="

# 1. Preflight
command -v python3 >/dev/null || { echo "python3 not found. Install Python 3.11+ first."; exit 1; }
PYVER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python $PYVER"

[ -f mibrain-v0.1.zip ] || { echo "mibrain-v0.1.zip not found in this folder."; exit 1; }

# 2. Unpack
[ -d mibrain ] || unzip -q mibrain-v0.1.zip
cd mibrain

# 3. Virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip --quiet

# 4. Core dependencies (skip heavy training stack for first light)
pip install --quiet pyyaml "numpy<2" faiss-cpu sentence-transformers pypdf python-docx huggingface_hub

# llama-cpp-python: CPU build works everywhere; CUDA build only if nvcc exists
if command -v nvcc >/dev/null; then
  echo "CUDA detected, building llama-cpp-python with GPU support (takes a few minutes)"
  CMAKE_ARGS="-DGGML_CUDA=on" pip install --quiet llama-cpp-python
  HAS_GPU=1
else
  echo "No CUDA toolchain found, installing CPU build"
  pip install --quiet llama-cpp-python
  HAS_GPU=0
fi

# 5. Dev models (small on purpose: prove the loop, then scale)
mkdir -p models/llm
if [ ! -d models/bge-small ]; then
  echo "Downloading embedding model (BAAI/bge-small-en-v1.5, ~130MB)"
  python3 - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download("BAAI/bge-small-en-v1.5", local_dir="models/bge-small")
PY
fi
if [ ! -f models/llm/model.gguf ]; then
  echo "Downloading chat model (Qwen2.5 3B Instruct Q4_K_M, ~2GB)"
  python3 - <<'PY'
from huggingface_hub import hf_hub_download
import shutil
p = hf_hub_download("Qwen/Qwen2.5-3B-Instruct-GGUF", "qwen2.5-3b-instruct-q4_k_m.gguf")
shutil.copy(p, "models/llm/model.gguf")
PY
fi

# 6. Point config at the dev models and hardware
python3 - <<PY
import yaml
cfg = yaml.safe_load(open("config.yaml"))
cfg["embedding"]["model_path"] = "models/bge-small"
cfg["embedding"]["dim"] = 384
cfg["embedding"]["device"] = "cuda" if ${HAS_GPU} else "cpu"
cfg["llm"]["gpu_layers"] = -1 if ${HAS_GPU} else 0
cfg["llm"]["context_length"] = 4096
yaml.safe_dump(cfg, open("config.yaml", "w"), sort_keys=False)
print("config.yaml updated for this machine")
PY

# 7. Smoke test
echo "hello from the deploy script. MIBrain was deployed on $(date)." > data/inbox/first_note.txt
python3 cli.py ingest
python3 cli.py status
python3 cli.py ask "What does your memory say about when you were deployed?"

echo ""
echo "=== Deploy complete ==="
echo "Next: python3 cli.py chat   (remember: source .venv/bin/activate first)"
