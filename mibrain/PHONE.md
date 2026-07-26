# Running MIBrain on an Android phone (Termux)

MIBrain runs on-device with two substitutions: the vector index falls
back from FAISS to the built-in NumPy index automatically (FAISS has no
Android build), and the chat model should be a small GGUF (0.5B to 1.5B).

Nothing leaves the phone. Same code, same database, same commands.

## 1. Install Termux

Get Termux from F-Droid (the Play Store build is outdated):
https://f-droid.org/packages/com.termux/

## 2. Base packages

```
pkg update
pkg install python python-numpy clang cmake git zip
```

## 3. Copy MIBrain onto the phone

Copy `mibrain-v0.1.zip` into the phone's Download folder, then:

```
termux-setup-storage           # grant file access, one time
cd ~
unzip ~/storage/downloads/mibrain-v0.1.zip
cd mibrain
```

## 4. Python dependencies

```
pip install pyyaml pypdf python-docx sentence-transformers
pip install llama-cpp-python   # compiles with clang, takes a while
```

Skip faiss-cpu: the NumPy fallback engages automatically.
If sentence-transformers fails to build torch on your device, install a
prebuilt torch first: `pip install torch --index-url https://pypi.org/simple`.

## 5. Stage small models

On a computer (or in Termux while you still allow network), download:

* Embeddings: `BAAI/bge-small-en-v1.5` into `models/bge-small/`
* Chat: `Qwen2.5-0.5B-Instruct` GGUF Q4_K_M (about 400 MB) as
  `models/llm/model.gguf`

Then edit `config.yaml` if needed: `embedding.device: cpu`,
`llm.gpu_layers: 0`, and drop `llm.context_length` to `2048` to save RAM.

## 6. Run it

```
python cli.py status
echo "MIBrain lives on my phone now." > data/inbox/note.txt
python cli.py ingest
python cli.py ask "Where does MIBrain live?"
python cli.py chat
```

## What to expect

* A 0.5B Q4 model generates a few tokens per second on a mid-range phone;
  1.5B is usable on flagships with 8 GB+ RAM.
* Ingest and retrieval are fast; embedding a large PDF takes a minute or
  two the first time.
* Training does not run on the phone. Approve candidates on the phone if
  you like, then copy `data/mibrain.db` to the training machine and run
  `python cli.py train` there.
