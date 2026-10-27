---
name: instagram-reel
description: Make a 25–35 s vertical (9:16) Instagram Reel for one of Sai's apps or games, the way the Stash Reel was made - real screen recordings with dummy data, a phone mockup with camera moves, a natural offline voiceover, captions that match the words, original music and soft UI sounds, then two MP4s (with and without music), the script and editable source. Use when Sai asks for a reel, promo video, short or product video.
---

# Instagram Reel

The recipe that produced the Stash Reel (Oct 2026). Templates in `scripts/` and `remotion-template/` are the real files from that Reel: copy them into a scratch folder and adapt, don't start from zero.

## Rules (from Sai)
- Dummy data only (Dr Asha Verma, City Clinic, Corner Tea House, My scooter). Never real notes, people, phone numbers or keys.
- Only claim what you verified in the code or README. No "100% private", no "free" or "secure" unless checked. CTA must match real availability (e.g. "Try it in your browser. Link in bio.").
- Never post or upload anywhere. Never use trending or unclear-licence audio (the music bundled with video-shotcraft is club-style and partly untraceable: skip it).
- Don't commit reel work files into the app repo; work in the scratchpad.
- Plain, short replies; Indian English spelling ("colour").

## Setup (cloud session)
- Prefix network installs with `NO_PROXY= no_proxy= npm_config_noproxy=` (pypi/npm fail otherwise).
- Skills (project level): `npx --yes skills add remotion-dev/skills -y` and optionally `npx --yes skills add Vincentwei1021/video-shotcraft -y`. Read `remotion-best-practices`; from video-shotcraft keep only its rules (real screenshots, one idea per shot, hold key moments ≥1 s, check stills before delivering).
- Blocked hosts: Hugging Face, ElevenLabs, Microsoft voices, jsDelivr. GitHub releases work.
- Voice + speech check: `pip install sherpa-onnx soundfile numpy`, then download from GitHub releases:
  - `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_0.tar.bz2` (voice)
  - `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2` (check)
- Browser: Playwright's Chromium is preinstalled. Remotion uses `/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell` (set in `remotion.config.ts`; check the folder name).

## Steps
1. **Understand the product.** Read README/CLAUDE.md, run the app (`python3 -m http.server 8810`), load its demo data, try the real flows. List features you can show and prove.
2. **Script (~75 words, 9 short lines, ≈23 s of speech).** Hook = a real problem as a question ("Where did you save that bill?"). Then: meet the product, 3–4 features each tied to a visible action, a short trust line, CTA. Write it to `lines.json`.
3. **Voice.** `python3 tts.py 3 1.04 "<line>" lines/NN.wav` per line (speaker 3 = af_heart, speed 1.04). Watch the log for `OOV word skipped`: that word is silently dropped, so rephrase (e.g. "suggests"/"belongs" were missing; check `grep -c "^word " lexicon-us-en.txt`).
4. **Check the voice.** `python3 whisper.py` must return every line word for word.
5. **Record the app** (`record.js`): 390×844 at 3x, CDP screencast frames → 30 fps MP4, a white tap ripple before each tap, `mark()` timestamps for each action (saved to `cap/marks.json`). Visit screens with one-time hints before recording so hints don't appear. Make sure the demo toast is gone. Review each clip as a contact sheet.
6. **Plan** (`plan.py`): line start times (leave 0.35–0.5 s gaps), caption chunks (≤6 words, timed by character weight), clip placements (src start, duration, rate; speed up typing, keep results on screen ≥1 s), sound events from the marks. Writes `remo/src/plan.json` and the audio tracks.
7. **Music** (`music.py`): original synth track, ducked to ≈15 dB under the voice. It is basic; say so and offer the no-music version for Instagram audio.
8. **Sound effects:** soft glassy taps, very soft key ticks, two bell notes on a success moment, one warm note at the end, a soft low pulse (58 Hz, no noise) at the 1–2 big transitions. **No noise whooshes**: Sai found the "vush" sounds bad. Keep effects in the gaps between spoken lines and peaks ≤ ~0.25.
9. **Build** (`remotion-template/`): 1080×1920, 30 fps, 900 frames. Scenes: hook (floating "mess" cards, big centred text) → phone rises in → feature scenes with camera keyframes (zoom to where the action is) → fact pills over a dimmed phone → logo, tagline, URL pill. Captions sit at the top (from y≈250, 84 px, bold, product accent on key words); the phone lives in a window starting at y=470 so camera moves never run under captions; keep the action above y≈1600 (Instagram covers the bottom).
10. **QA before delivering:** `npx remotion still` at key frames, a contact sheet of the whole render, Whisper per line on the final mix (with and without music), loudness via `ebur128`.
11. **Render + mix:** render once with `props-nomusic.json`, then `sh mix.sh` makes both versions at about -15 LUFS, peaks ≤ -2.8 dBFS. Also make a small copy (`-b:v 1800k`, ≈7 MB) because big files may not save on Sai's phone.
12. **Deliver:** with-music MP4, no-music MP4, small copies, `Voiceover-script.md` (time | line | on screen), a notes file (what's generated, what wasn't checked by ear, caption timing ±0.2 s), source zip without node_modules. Send with SendUserFile; a private artifact page can host both videos for playback. Say plainly that you cannot listen to the audio.

## Known numbers from the Stash Reel
Voice ≈ -20.7 dBFS RMS while speaking; music −15 dB under it; final −15 LUFS. Render ≈ 4 min for 900 frames at concurrency 3.
