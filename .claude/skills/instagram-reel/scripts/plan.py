"""TEMPLATE (from the Stash Reel): adapt the line start times, clip list, events and caption chunks to the new script and recordings.
Single source of truth for timing: voice offsets, scene windows, clip placements, SFX and caption chunks.
Writes remo/src/plan.json, remo/public/audio/voice.wav (voice only), voice_sfx.wav, music.wav."""
import json, numpy as np, soundfile as sf, re
SR = 48000
L = json.load(open("tts/lines.json"))
marks = json.load(open("cap/marks.json"))
# ---- voice placement (seconds) ----
start = [0.35, 2.05, 4.75, 7.85, 11.15, 14.95, 17.45, 20.85, 24.45]
voice = np.zeros(int(31 * SR), dtype=np.float32)
lines = []
for i, t in enumerate(L):
    d, sr = sf.read(f"tts/lines/{i:02d}.wav", dtype="float32")
    x = np.interp(np.linspace(0, len(d), int(len(d) * SR / sr), endpoint=False), np.arange(len(d)), d).astype("float32")
    # trim leading/trailing near-silence so offsets are the true speech start/end
    thr = 0.01; nz = np.where(np.abs(x) > thr)[0]; x = x[max(0, nz[0] - int(0.02 * SR)): nz[-1] + int(0.03 * SR)]
    a = int(start[i] * SR); voice[a:a + len(x)] += x
    lines.append({"text": t, "start": start[i], "end": round(start[i] + len(x) / SR, 3)})
chunks_src = [["Where did you save that bill?"], ["That clinic note?", "That idea from last week?"], ["Meet Stash.", "One place for everything", "you want to keep."], ["Drop it in your Inbox.", "Text, photos, files, scans."], ["Stash can suggest a home for it,", "so filing takes one tap."], ["Need it later?", "Search finds it fast."], ["Lock private things in the Vault,", "with your own password."], ["Your notes stay on your device.", "No account.", "Works offline."], ["Try Stash in your browser.", "Link in bio."]]
caps = []
for ln, ch in zip(lines, chunks_src):
    w = [len(c) + (4 if c[-1] in ".?," else 0) for c in ch]; tot = sum(w); t0 = ln["start"]; dur = ln["end"] - ln["start"]; acc = 0
    for c, wi in zip(ch, w):
        s = t0 + dur * acc / tot; acc += wi; e = t0 + dur * acc / tot
        caps.append({"text": c, "start": round(s, 3), "end": round(e, 3)})
# make each caption linger until the next chunk starts (but not across sentences > 0.5s)
for i, c in enumerate(caps):
    nxt = caps[i + 1]["start"] if i + 1 < len(caps) else 30.0
    c["end"] = round(min(nxt, c["end"] + 0.45), 3)
sf.write("remo/public/audio/voice.wav", voice, SR)

# ---- clips (timeline sec) ----
m2, m3, m4, m5 = marks["r2_plus"], marks["r3_suggest"], marks["r4_search"], marks["r5_vault"]
clips = [
  {"id": "r1", "file": "clips/r1_inbox.mp4", "t": 4.75, "src": 0.5, "dur": 3.1, "rate": 1.0},
  {"id": "r2", "file": "clips/r2_plus.mp4", "t": 7.9, "src": 0.5, "dur": 3.1, "rate": 0.8},
  {"id": "r3a", "file": "clips/r3_suggest.mp4", "t": 11.1, "src": 0.7, "dur": 1.3, "rate": 2.0},
  {"id": "r3b", "file": "clips/r3_suggest.mp4", "t": 12.4, "src": 3.3, "dur": 3.0, "rate": 1.0},
  {"id": "r4a", "file": "clips/r4_search.mp4", "t": 15.0, "src": 0.55, "dur": 0.61, "rate": 2.2},
  {"id": "r4b", "file": "clips/r4_search.mp4", "t": 15.61, "src": 1.9, "dur": 1.9, "rate": 1.0},
  {"id": "r5", "file": "clips/r5_vault.mp4", "t": 17.6, "src": 0.5, "dur": 2.5, "rate": 1.0},
  {"id": "r6", "file": "clips/r6_collections.mp4", "t": 21.0, "src": 0.5, "dur": 1.3, "rate": 1.0},
]
def T(clip, srcmark):  # timeline time of a source mark
    c = next(c for c in clips if c["id"] == clip); return round(c["t"] + (srcmark - c["src"]) / c["rate"], 3)
events = {
  "tap_plus": T("r2", m2["tap_plus"]), "close_menu": T("r2", m2["close_menu"]),
  "type3": (T("r3a", m3["type_start"]), T("r3a", m3["type_end"])), "send": T("r3b", m3["tap_send"]), "chip": T("r3b", m3["tap_chip"]),
  "tap_search": T("r4a", m4["tap_search"]), "type4": (round(15.61 + (m4["type_start"] - 1.9), 3), round(15.61 + (m4["type_end"] - 1.9), 3)),
  "tap_more": T("r5", m5["tap_more"]), "tap_vault": T("r5", m5["tap_vault"]),
}
print(json.dumps(events))

# ---- SFX (original, synthesized): soft, tonal and sparse, in the spirit of system UI sounds ----
from numpy.fft import rfft, irfft
rng = np.random.default_rng(7)
def lp(x, fc):  # one-pole low-pass
    a = 1 - np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc); y[i] = acc
    return y
def tap(f=2400, g=0.30):  # glassy tap: short pitched click with a soft low body
    n = int(0.09 * SR); t = np.arange(n) / SR
    top = np.sin(2 * np.pi * f * t) * np.exp(-t * 120) * np.minimum(1, t / 0.0015)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 55) * 0.6
    return ((top + body) * g).astype("float32")
def key(g=0.07):  # very soft key tick
    n = int(0.035 * SR); t = np.arange(n) / SR
    x = lp(rng.standard_normal(n), 3500) * np.exp(-t * 170) * np.minimum(1, t / 0.001)
    return (x * g * 3).astype("float32")
def bell(f=1318, g=0.3, d=1.4):  # soft FM bell, slow decay
    n = int(d * SR); t = np.arange(n) / SR
    m = np.sin(2 * np.pi * f * 1.4 * t) * 1.6 * np.exp(-t * 5)
    x = np.sin(2 * np.pi * f * t + m) * np.exp(-t * 3.2) * np.minimum(1, t / 0.004)
    return (x * g).astype("float32")
sfx = np.zeros_like(voice)
def put(x, t, g=1.0):
    a = int(t * SR); sfx[a:a + len(x)] += x[: len(sfx) - a] * g
# two transitions only: the mess pulled into the phone, and the phone leaving for the sign-off
def thump(g=0.34):  # no noise at all: one soft low pulse, like a finger landing on glass
    n = int(0.45 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 58 * t) * np.exp(-t * 9) * np.minimum(1, t / 0.008) * g).astype("float32")
put(thump(), 4.55); put(thump(0.28), 24.2)
for k in ["tap_plus", "send", "chip", "tap_search", "tap_more", "tap_vault"]: put(tap(2400), events[k] - 0.015)
put(tap(1800, 0.22), events["close_menu"] - 0.015)
for a_, b_ in [events["type3"], events["type4"]]:
    t = a_
    while t < b_: put(key(), t); t += 0.08 + 0.025 * rng.random()
# "filed" success: two soft notes
put(bell(1175, 0.30), events["chip"] + 0.16); put(bell(1760, 0.22), events["chip"] + 0.34)
# sign-off: one warm note when the voice has finished
put(bell(880, 0.26, 1.8), 27.0); put(bell(1318, 0.18, 1.8), 27.14)
# a little shared room so nothing sounds dry
n_ir = int(0.9 * SR); tt_ = np.arange(n_ir) / SR; ir = rng.standard_normal(n_ir) * np.exp(-tt_ * 6.5); ir[: int(0.006 * SR)] = 0; ir = lp(ir, 5500); ir /= np.abs(ir).sum() * 0.08
m_ = 1 << int(np.ceil(np.log2(len(sfx) + n_ir))); wet = irfft(rfft(sfx, m_) * rfft(ir, m_), m_)[: len(sfx)]
sfx = (sfx * 0.8 + wet * 0.5).astype("float32")
sf.write("remo/public/audio/voice_sfx.wav", np.clip(voice + sfx * 0.55, -1, 1), SR)
sf.write("remo/public/audio/sfx_only.wav", sfx * 0.7, SR)

json.dump({"fps": 30, "duration": 30.0, "lines": lines, "caps": caps, "clips": clips, "events": events}, open("remo/src/plan.json", "w"), indent=1)
print("voice end", lines[-1]["end"], "caps", len(caps))
