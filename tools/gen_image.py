"""Generate or edit one image through OpenRouter, with a hard spending cap.

Usage:
  python tools/gen_image.py --batch hero --cap 2.00 --prompt-file p1.txt \
      --input prototype/assets/mock/hero-tired.webp --out prototype/assets/hero/p1-master.png

Every call is appended to prototype/assets/costs.json (the real cost OpenRouter reports).
Before calling, the script refuses if this batch's spend + the estimate would pass --cap.
The API key is read from .env.local and never printed.
"""
import argparse
import base64
import json
import mimetypes
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "prototype" / "assets" / "costs.json"


def read_key():
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENROUTER_API_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("OPENROUTER_API_KEY missing from .env.local")


def load_ledger():
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else []


def data_url(path):
    mime = mimetypes.guess_type(path)[0] or "image/png"
    if path.endswith(".webp"):
        mime = "image/webp"
    return f"data:{mime};base64,{base64.b64encode(Path(path).read_bytes()).decode()}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", required=True)
    ap.add_argument("--cap", type=float, required=True, help="max USD for this batch")
    ap.add_argument("--estimate", type=float, default=0.16, help="expected USD per call")
    ap.add_argument("--model", default="google/gemini-3-pro-image")
    ap.add_argument("--size", default="2K")
    ap.add_argument("--aspect", default="16:9")
    ap.add_argument("--prompt-file", required=True)
    ap.add_argument("--input", action="append", default=[])
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    ledger = load_ledger()
    spent = sum(e["cost"] for e in ledger if e["batch"] == args.batch)
    if spent + args.estimate > args.cap:
        sys.exit(f"STOP: batch '{args.batch}' has spent ${spent:.4f}; another call (~${args.estimate}) would pass the ${args.cap} cap.")

    prompt = Path(args.prompt_file).read_text(encoding="utf-8").strip()
    content = [{"type": "text", "text": prompt}]
    content += [{"type": "image_url", "image_url": {"url": data_url(p)}} for p in args.input]
    body = {
        "model": args.model,
        "messages": [{"role": "user", "content": content}],
        "modalities": ["image", "text"],
        "image_config": {"aspect_ratio": args.aspect, "image_size": args.size},
        "usage": {"include": True},
    }
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {read_key()}", "Content-Type": "application/json"},
    )
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:600]}")

    usage = res.get("usage", {})
    cost = float(usage.get("cost") or 0)
    msg = res["choices"][0]["message"]
    images = msg.get("images") or []

    ledger.append({
        "time": time.strftime("%Y-%m-%d %H:%M:%S"),
        "batch": args.batch,
        "model": args.model,
        "out": args.out if images else None,
        "cost": cost,
        "usage": {k: usage.get(k) for k in ("prompt_tokens", "completion_tokens", "completion_tokens_details")},
    })
    LEDGER.write_text(json.dumps(ledger, indent=2), encoding="utf-8")

    if not images:
        sys.exit(f"No image returned (cost ${cost:.4f}). Model said: {(msg.get('content') or '')[:400]}")
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    header, b64 = images[0]["image_url"]["url"].split(",", 1)
    out.write_bytes(base64.b64decode(b64))
    # Keep the prompt next to the asset, as the brief asks.
    out.with_suffix(".prompt.txt").write_text(prompt + "\n\ninputs: " + ", ".join(args.input), encoding="utf-8")

    total = sum(e["cost"] for e in ledger)
    print(f"saved {args.out} ({header.split(';')[0][5:]}) in {time.time() - started:.0f}s")
    print(f"cost ${cost:.4f} | batch '{args.batch}' ${spent + cost:.4f} of ${args.cap} | all batches ${total:.4f}")
    if msg.get("content"):
        print("model note:", msg["content"][:300])


if __name__ == "__main__":
    main()
