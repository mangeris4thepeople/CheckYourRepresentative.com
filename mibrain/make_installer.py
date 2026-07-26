"""Generate MIBrain_Setup.py, a single-file desktop installer.

Embeds mibrain-v0.1.zip as base64 inside a self-contained bootstrap
script. The result is one file a user can run on Windows, macOS, or
Linux (Python 3.10+) to extract MIBrain, build a venv, install the chat
and training stacks, download models, smoke test, and print the
teach-and-train loop.

Usage: python make_installer.py path/to/mibrain-v0.1.zip [output.py]
"""

import base64
import sys

TEMPLATE = '''#!/usr/bin/env python3
"""MIBrain desktop setup. One file, everything included.

Run me from a folder where you want MIBrain to live:
  Windows: double-click me, or: py MIBrain_Setup.py
  macOS/Linux: python3 MIBrain_Setup.py

I will: extract MIBrain next to this file, create a private virtual
environment, install dependencies (chat + training), download two small
models (about 1.2 GB total), run a smoke test, and show you how to
teach and train your brain. Re-running me is safe; finished steps are
skipped.

Options: --skip-models (no downloads), --skip-deps (no pip installs)
"""

import base64
import io
import os
import subprocess
import sys
import zipfile

MIN_PY = (3, 10)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "mibrain")
SKIP_MODELS = "--skip-models" in sys.argv
SKIP_DEPS = "--skip-deps" in sys.argv

PAYLOAD = "{payload}"  # mibrain-v0.1.zip, base64


def say(msg):
    print("\\n=== " + msg)


def pause_and_exit(code):
    if os.name == "nt" and sys.stdin.isatty():
        try:
            input("\\nPress Enter to close this window...")
        except EOFError:
            pass
    sys.exit(code)


def venv_python():
    if os.name == "nt":
        return os.path.join(ROOT, ".venv", "Scripts", "python.exe")
    return os.path.join(ROOT, ".venv", "bin", "python")


def run(args, **kw):
    print("+ " + " ".join(args))
    return subprocess.call(args, **kw)


def main():
    if sys.version_info < MIN_PY:
        print("Python %d.%d+ required, you have %s. Install from python.org."
              % (MIN_PY[0], MIN_PY[1], sys.version.split()[0]))
        pause_and_exit(1)

    say("Step 1/6: unpack MIBrain")
    if os.path.isdir(ROOT) and os.path.isfile(os.path.join(ROOT, "cli.py")):
        print("mibrain/ already present, keeping it (your data is safe).")
    else:
        zipfile.ZipFile(io.BytesIO(base64.b64decode(PAYLOAD))).extractall(HERE)
        print("extracted to %s" % ROOT)
    for sub in ("data/inbox", "data/archive", "models/llm", "models/adapters"):
        os.makedirs(os.path.join(ROOT, sub), exist_ok=True)

    say("Step 2/6: private virtual environment")
    vp = venv_python()
    if os.path.isfile(vp):
        print(".venv already present, reusing.")
    else:
        if run([sys.executable, "-m", "venv", os.path.join(ROOT, ".venv")]) != 0:
            print("venv creation failed."); pause_and_exit(1)

    say("Step 3/6: install dependencies (chat + training). This is the")
    print("long step: several GB the first time. Grab a coffee.")
    if SKIP_DEPS:
        print("skipped (--skip-deps)")
    else:
        run([vp, "-m", "pip", "install", "--upgrade", "pip", "--quiet"])
        core = ["pyyaml", "numpy<2", "faiss-cpu", "sentence-transformers",
                "pypdf", "python-docx", "huggingface_hub",
                "transformers", "peft", "datasets", "accelerate"]
        if run([vp, "-m", "pip", "install", "--quiet"] + core) != 0:
            print("dependency install failed, see errors above.")
            pause_and_exit(1)
        # Optional GGUF backend. Needs a C++ toolchain; MIBrain works
        # without it because the desktop config uses the HF backend.
        print("optional: llama-cpp-python (ok if this fails)")
        run([vp, "-m", "pip", "install", "--quiet", "llama-cpp-python"])

    say("Step 4/6: download models (~1.2 GB, first run only)")
    if SKIP_MODELS:
        print("skipped (--skip-models)")
    else:
        script = (
            "from huggingface_hub import snapshot_download\\n"
            "import os\\n"
            "if not os.path.isdir('models/bge-small'):\\n"
            "    snapshot_download('BAAI/bge-small-en-v1.5', local_dir='models/bge-small')\\n"
            "    print('embedding model staged')\\n"
            "if not os.path.isdir('models/llm-hf'):\\n"
            "    snapshot_download('Qwen/Qwen2.5-0.5B-Instruct', local_dir='models/llm-hf')\\n"
            "    print('chat/training model staged')\\n"
        )
        if run([vp, "-c", script], cwd=ROOT) != 0:
            print("model download failed. Check your internet connection and")
            print("re-run me; everything else is already done.")
            pause_and_exit(1)

    say("Step 5/6: configure for this machine")
    script = (
        "import yaml\\n"
        "cfg = yaml.safe_load(open('config.yaml'))\\n"
        "cfg['embedding'].update(model_path='models/bge-small', dim=384, device='cpu')\\n"
        "cfg['llm']['backend'] = 'hf'\\n"
        "cfg['training']['base_model'] = 'models/llm-hf'\\n"
        "try:\\n"
        "    import torch\\n"
        "    if torch.cuda.is_available():\\n"
        "        cfg['embedding']['device'] = 'cuda'\\n"
        "        print('NVIDIA GPU detected:', torch.cuda.get_device_name(0))\\n"
        "except Exception:\\n"
        "    pass\\n"
        "yaml.safe_dump(cfg, open('config.yaml', 'w'), sort_keys=False)\\n"
        "print('config.yaml written')\\n"
    )
    run([vp, "-c", script], cwd=ROOT)

    say("Step 6/6: smoke test")
    run([vp, "cli.py", "status"], cwd=ROOT)
    if not SKIP_MODELS:
        note = os.path.join(ROOT, "data", "inbox", "first_note.txt")
        if not os.path.isfile(note):
            with open(note, "w") as fh:
                fh.write("MIBrain was set up on this desktop and is ready to learn.")
        run([vp, "cli.py", "ingest"], cwd=ROOT)
        run([vp, "cli.py", "ask", "Are you ready to learn?"], cwd=ROOT)

    say("Done. Your daily loop, from inside the mibrain folder:")
    py = vp if os.name == "nt" else "./.venv/bin/python"
    print("""
  TEACH ITS MEMORY
    drop files into mibrain/data/inbox, then: %(py)s cli.py ingest
    or just talk to it:                       %(py)s cli.py chat

  TRAIN ITS WEIGHTS
    1. %(py)s cli.py consolidate   (distill conversations)
    2. %(py)s cli.py review        (approve what it may learn)
    3. %(py)s cli.py train         (QLoRA fine tune, adapter saved
                                    under models/adapters)

  Check anytime: %(py)s cli.py status
""" % {"py": py})
    pause_and_exit(0)


if __name__ == "__main__":
    main()
'''


def main():
    zip_path = sys.argv[1] if len(sys.argv) > 1 else "mibrain-v0.1.zip"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "MIBrain_Setup.py"
    with open(zip_path, "rb") as fh:
        payload = base64.b64encode(fh.read()).decode("ascii")
    with open(out_path, "w") as fh:
        fh.write(TEMPLATE.replace("{payload}", payload))
    print("wrote %s (%.1f KB)" % (out_path, len(payload) / 1024 + 6))


if __name__ == "__main__":
    main()
