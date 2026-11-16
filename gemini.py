"""Server-side Gemini calls (standard library only).

The key is read from the GEMINI_API_KEY environment variable. Every caller has
a fallback, so the demo keeps working when no key is set or a call fails.
"""
import json
import os
import urllib.error
import urllib.request

# Fast, low-cost model. Override with GEMINI_MODEL if Google renames it.
DEFAULT_MODEL = "gemini-3.5-flash-lite"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

status = {"configured": False, "model": DEFAULT_MODEL, "calls": 0, "ok": 0, "lastError": None}


def model_name():
    return os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_MODEL


def api_key():
    return os.environ.get("GEMINI_API_KEY", "").strip()


def refresh_status():
    status["configured"] = bool(api_key())
    status["model"] = model_name()


def generate_json(prompt, timeout=10):
    """Send one prompt, return the parsed JSON object, or None on any failure."""
    key = api_key()
    refresh_status()
    if not key:
        return None
    status["calls"] += 1
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.4},
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT.format(model=model_name(), key=key),
        data=body, headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text[4:] if text.lower().startswith("json") else text
        result = json.loads(text)
        if not isinstance(result, dict):
            raise ValueError("Gemini did not return a JSON object")
        status["ok"] += 1
        status["lastError"] = None
        return result
    except urllib.error.HTTPError as err:
        detail = ""
        try:
            detail = json.loads(err.read().decode("utf-8")).get("error", {}).get("message", "")
        except Exception:
            pass
        status["lastError"] = ("HTTP %s %s" % (err.code, detail)).replace(key, "***")[:200]
    except Exception as err:  # network, timeout, malformed answer
        status["lastError"] = ("%s: %s" % (type(err).__name__, err)).replace(key, "***")[:200]
    return None
