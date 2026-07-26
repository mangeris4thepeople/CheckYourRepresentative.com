#!/usr/bin/env python3
"""Physics curriculum fetcher for MIBrain.

Downloads a broad physics corpus as plain text into data/inbox so that
`python cli.py ingest` can consume every word into memory. This is a
dev-phase staging tool like the deploy script: it uses the network, the
MIBrain core never does. Standard library only, so it runs the same on
desktop and Termux.

Run from the mibrain folder:
  python learn/fetch_physics.py            # ~75 core Wikipedia articles
  python learn/fetch_physics.py --arxiv    # + latest research abstracts
  python learn/fetch_physics.py --nasa     # + NASA astronomy archive
                                           #   (needs NASA_API_KEY env var)
Then:
  python cli.py ingest
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

INBOX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "inbox")
USER_AGENT = "MIBrain-fetcher/0.1 (personal offline study corpus)"
PAUSE_SECONDS = 0.6

TOPICS = [
    # foundations
    "Physics", "History of physics", "Force", "Mass", "Gravity",
    "Conservation law", "Symmetry (physics)", "Measurement", "SI base unit",
    # classical mechanics
    "Classical mechanics", "Newton's laws of motion", "Momentum", "Energy",
    "Work (physics)", "Kinetic energy", "Potential energy", "Angular momentum",
    "Torque", "Friction", "Harmonic oscillator", "Pendulum",
    "Lagrangian mechanics", "Hamiltonian mechanics", "Chaos theory",
    # thermodynamics and statistical mechanics
    "Thermodynamics", "Laws of thermodynamics", "Entropy", "Heat",
    "Temperature", "Statistical mechanics", "Brownian motion",
    "Kinetic theory of gases",
    # electromagnetism
    "Electromagnetism", "Maxwell's equations", "Electric field",
    "Magnetic field", "Electric charge", "Coulomb's law",
    "Electromagnetic radiation", "Electromagnetic induction", "Capacitor",
    "Electric current",
    # waves, sound, optics
    "Wave", "Sound", "Doppler effect", "Optics", "Light", "Refraction",
    "Diffraction", "Wave interference", "Polarization (waves)", "Laser",
    # quantum mechanics and particles
    "Quantum mechanics", "Schrodinger equation", "Wave function",
    "Uncertainty principle", "Quantum entanglement", "Quantum field theory",
    "Photon", "Electron", "Atom", "Atomic orbital", "Standard Model",
    "Quark", "Lepton", "Particle physics", "Higgs boson",
    # nuclear
    "Nuclear physics", "Radioactive decay", "Nuclear fission",
    "Nuclear fusion",
    # relativity and gravitation
    "Special relativity", "General relativity", "Spacetime",
    "Speed of light", "Black hole", "Gravitational wave",
    # astrophysics and cosmology
    "Astrophysics", "Physical cosmology", "Big Bang", "Dark matter",
    "Dark energy", "Star", "Supernova", "Galaxy", "Neutron star",
    # condensed matter and fluids
    "Condensed matter physics", "Superconductivity", "Semiconductor",
    "Fluid dynamics", "Plasma (physics)",
    # constants and quanta of knowledge
    "Planck constant", "Fine-structure constant",
]

ARXIV_CATEGORIES = [
    "physics.class-ph", "quant-ph", "astro-ph.CO", "cond-mat.supr-con",
    "hep-ph", "gr-qc", "nucl-th",
]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def safe_name(title):
    return re.sub(r"[^A-Za-z0-9._-]+", "_", title).strip("_")


def fetch_wikipedia():
    print("Fetching %d Wikipedia physics articles (full text)..." % len(TOPICS))
    got, failed = 0, []
    for title in TOPICS:
        out = os.path.join(INBOX, "wikipedia_%s.txt" % safe_name(title))
        if os.path.exists(out):
            print("  have  %s" % title)
            got += 1
            continue
        params = urllib.parse.urlencode({
            "action": "query", "prop": "extracts", "explaintext": 1,
            "redirects": 1, "format": "json", "titles": title,
        })
        try:
            data = json.loads(fetch("https://en.wikipedia.org/w/api.php?" + params))
            pages = data["query"]["pages"]
            text = next(iter(pages.values())).get("extract", "")
            if len(text) < 200:
                raise ValueError("empty or stub extract")
            with open(out, "w", encoding="utf-8") as fh:
                fh.write("Wikipedia: %s\n\n%s" % (title, text))
            print("  saved %s (%d words)" % (title, len(text.split())))
            got += 1
        except Exception as exc:
            print("  FAILED %s: %s" % (title, exc))
            failed.append(title)
        time.sleep(PAUSE_SECONDS)
    print("Wikipedia done: %d saved, %d failed." % (got, len(failed)))
    if failed:
        print("Failed titles (rerun to retry): %s" % ", ".join(failed))


def fetch_arxiv(per_category=25):
    print("Fetching latest arXiv abstracts (%d per category)..." % per_category)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    for cat in ARXIV_CATEGORIES:
        params = urllib.parse.urlencode({
            "search_query": "cat:" + cat, "sortBy": "submittedDate",
            "sortOrder": "descending", "max_results": per_category,
        })
        try:
            root = ET.fromstring(fetch("https://export.arxiv.org/api/query?" + params))
            lines = ["arXiv latest abstracts, category %s\n" % cat]
            for entry in root.findall("a:entry", ns):
                title = " ".join((entry.findtext("a:title", "", ns) or "").split())
                summary = " ".join((entry.findtext("a:summary", "", ns) or "").split())
                lines.append("Title: %s\nAbstract: %s\n" % (title, summary))
            out = os.path.join(INBOX, "arxiv_%s.txt" % safe_name(cat))
            with open(out, "w", encoding="utf-8") as fh:
                fh.write("\n".join(lines))
            print("  saved %s (%d abstracts)" % (cat, len(lines) - 1))
        except Exception as exc:
            print("  FAILED %s: %s" % (cat, exc))
        time.sleep(PAUSE_SECONDS)


def fetch_nasa(days=180):
    key = os.environ.get("NASA_API_KEY")
    if not key:
        print("--nasa needs the NASA_API_KEY environment variable, for example:")
        print("  export NASA_API_KEY=your_key_here   (never paste keys into files)")
        return
    from datetime import date, timedelta
    end = date.today()
    start = end - timedelta(days=days)
    print("Fetching NASA astronomy picture explanations %s to %s..." % (start, end))
    params = urllib.parse.urlencode({
        "api_key": key, "start_date": start.isoformat(),
        "end_date": end.isoformat(), "thumbs": "false",
    })
    try:
        items = json.loads(fetch("https://api.nasa.gov/planetary/apod?" + params))
        lines = ["NASA Astronomy Picture of the Day, explanations\n"]
        for item in items:
            lines.append("%s: %s\n%s\n" % (
                item.get("date", ""), item.get("title", ""),
                item.get("explanation", ""),
            ))
        out = os.path.join(INBOX, "nasa_apod_%s_%s.txt" % (start, end))
        with open(out, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
        print("  saved %d entries" % (len(lines) - 1))
    except Exception as exc:
        print("  FAILED: %s" % exc)


def main():
    os.makedirs(INBOX, exist_ok=True)
    fetch_wikipedia()
    if "--arxiv" in sys.argv:
        fetch_arxiv()
    if "--nasa" in sys.argv:
        fetch_nasa()
    print("\nCurriculum staged in data/inbox. Now teach it:")
    print("  python cli.py ingest")
    print("Then quiz it:")
    print('  python cli.py ask "Explain the second law of thermodynamics."')


if __name__ == "__main__":
    main()
