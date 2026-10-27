"""Original background music (synthesized here, so there is no licensing question): warm pad + soft plucks + sub bass,
96 BPM, C major loop. Ducks under the voice. Writes remo/public/audio/music.wav (stereo, 48k)."""
import numpy as np, soundfile as sf
SR = 48000; DUR = 30.5; BPM = 96; beat = 60 / BPM
rng = np.random.default_rng(11)
N = int(DUR * SR); t = np.arange(N) / SR
def hz(m): return 440 * 2 ** ((m - 69) / 12)
chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 60]]   # Cmaj7, Am7, Fmaj7, G6(ish)
bass = [36, 33, 29, 31]
L = np.zeros(N); R = np.zeros(N)
def add(buf, x, a):
    n = min(len(x), N - a)
    if n > 0: buf[a:a + n] += x[:n]
barlen = 4 * beat
nbars = int(DUR / barlen) + 1
for b in range(nbars):
    ch = chords[b % 4]; t0 = b * barlen; a = int(t0 * SR); n = int((barlen + 0.6) * SR); tt = np.arange(n) / SR
    # pad: detuned triangles, slow attack/release
    env = np.minimum(1, tt / 0.6) * np.minimum(1, np.maximum(0, (barlen + 0.6 - tt) / 0.6))
    for k, m in enumerate(ch):
        for det, pan in [(-0.07, 0.3), (0.07, 0.7)]:
            f = hz(m + 12) * 2 ** (det / 12)
            x = (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * f * tt)) * env * 0.05
            add(L, x * (1 - pan), a); add(R, x * pan, a)
    # sub bass: soft sine on beats 1 and 3
    for bt in [0, 2]:
        tb = np.arange(int(1.4 * beat * SR)) / SR; f = hz(bass[b % 4] + 12)
        x = np.sin(2 * np.pi * f * tb) * np.exp(-tb * 2.2) * np.minimum(1, tb / 0.01) * 0.22
        add(L, x, int((t0 + bt * beat) * SR)); add(R, x, int((t0 + bt * beat) * SR))
    # plucks: 8th-note arpeggio, up the chord and back, gently panned
    seq = [0, 1, 2, 3, 2, 1, 2, 3]
    for i, s in enumerate(seq):
        tp = t0 + i * beat / 2; m = ch[s] + 24 + (12 if i == 7 else 0)
        tn = np.arange(int(0.9 * SR)) / SR; f = hz(m)
        x = (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(2 * np.pi * 2 * f * tn) + 0.1 * np.sin(2 * np.pi * 3 * f * tn)) * np.exp(-tn * 6.5) * np.minimum(1, tn / 0.004) * 0.075
        pan = 0.35 + 0.3 * ((i % 4) / 3)
        add(L, x * (1 - pan) * 1.4, int(tp * SR)); add(R, x * pan * 1.4, int(tp * SR))
    # soft off-beat hat
    for i in range(4):
        th = t0 + (i + 0.5) * beat; nh = int(0.06 * SR); tn = np.arange(nh) / SR
        x = np.diff(rng.standard_normal(nh + 1)) * np.exp(-tn * 70) * 0.02
        add(L, x, int(th * SR)); add(R, x, int(th * SR))
# reverb (synthetic impulse response)
def reverb(x, wet=0.28):
    n = int(1.6 * SR); tt = np.arange(n) / SR; ir = rng.standard_normal(n) * np.exp(-tt * 3.2); ir[:int(0.012 * SR)] = 0
    ir = np.convolve(ir, np.ones(6) / 6, "same"); ir /= np.abs(ir).sum() * 0.12
    from numpy.fft import rfft, irfft
    m = 1 << int(np.ceil(np.log2(len(x) + len(ir)))); y = irfft(rfft(x, m) * rfft(ir, m), m)[:len(x)]
    return x * (1 - wet) + y * wet
L = reverb(L); R = reverb(R)
# fades
fade_in = np.minimum(1, t / 1.5); fade_out = np.minimum(1, np.maximum(0, (DUR - t) / 2.5)); g = fade_in * fade_out
# duck under voice
v, _ = sf.read("remo/public/audio/voice.wav", dtype="float32"); v = np.abs(v[:N]); v = np.pad(v, (0, N - len(v)))
win = int(0.05 * SR); e = np.convolve(v, np.ones(win) / win, "same"); e = np.clip(e / 0.12, 0, 1)
sm = np.zeros(N); y = 0.0
for i in range(0, N):
    k = 0.0015 if e[i] > y else 0.00006; y += k * (e[i] - y); sm[i] = y
duck = 1 - 0.62 * np.clip(sm * 1.4, 0, 1)
out = np.stack([L, R], 1) * (g * duck)[:, None]
# set the level so that, while the voice is speaking, the music sits ~15 dB under it
va = np.abs(v) > 0.02; mono = out.mean(1)
cur = np.sqrt((mono[va] ** 2).mean()); vr = np.sqrt((v[va] ** 2).mean()) if False else 0.093
out *= (vr * 10 ** (-15 / 20)) / cur
out = np.clip(out, -0.9, 0.9)
sf.write("remo/public/audio/music.wav", out.astype("float32"), SR)
r = np.sqrt((out ** 2).mean()); print("music rms dBFS", round(20 * np.log10(r), 1), "peak", round(float(np.abs(out).max()), 2))
