import React from "react";
import { AbsoluteFill, Audio, Easing, Freeze, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame } from "remotion";
import plan from "./plan.json";
import { C, FONT, FPS } from "./theme";
import { Phone, SCREEN_W, STATUS_H, VIEW_H } from "./Phone";

const S = (sec: number) => Math.round(sec * FPS);
const soft = Easing.bezier(0.45, 0, 0.2, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------- background: near-black with two slow violet/blue glows ----------
const Background: React.FC = () => {
  const f = useCurrentFrame();
  const a = Math.sin(f / 90) * 60, b = Math.cos(f / 110) * 70;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <div style={{ position: "absolute", left: -260 + a, top: -120 + b, width: 1000, height: 1000, borderRadius: "50%", background: "radial-gradient(circle, rgba(108,81,245,.34), rgba(108,81,245,0) 65%)" }} />
      <div style={{ position: "absolute", right: -320 - a, bottom: 120 - b, width: 1100, height: 1100, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,141,255,.22), rgba(76,141,255,0) 65%)" }} />
    </AbsoluteFill>
  );
};

// ---------- app recordings, placed from plan.json ----------
type ClipT = { id: string; file: string; t: number; src: number; dur: number; rate: number };
const Clips: React.FC = () => {
  const clips = plan.clips as ClipT[];
  return (
    <>
      {clips.map((c, i) => {
        const next = clips[i + 1];
        const end = c.t + c.dur;
        const hold = c.id === "r6" ? 4.0 : next ? Math.max(0, next.t - end) : 0;
        const lastSrcFrame = S(c.src + c.dur * c.rate) - 1;
        const common = { src: staticFile(c.file), muted: true, style: { width: "100%", height: "100%", objectFit: "cover" as const } };
        return (
          <React.Fragment key={c.id}>
            <Sequence from={S(c.t)} durationInFrames={S(c.dur)} layout="none">
              <OffthreadVideo {...common} startFrom={S(c.src)} playbackRate={c.rate} />
            </Sequence>
            {hold > 0.01 && (
              <Sequence from={S(end)} durationInFrames={S(hold)} layout="none">
                <Freeze frame={0}><OffthreadVideo {...common} startFrom={lastSrcFrame} /></Freeze>
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------- camera: keyframes for the phone (time in s, offsets in px, scale, tilt in deg) ----------
type K = { t: number; x: number; y: number; s: number; rx: number; ry: number };
const KEYS: K[] = [
  { t: 4.25, x: 0, y: 1250, s: 0.92, rx: 14, ry: -10 },
  { t: 5.45, x: 0, y: 0, s: 1.0, rx: 3, ry: -5 },
  { t: 7.75, x: 0, y: -20, s: 1.03, rx: 2, ry: 3 },
  { t: 8.5, x: 0, y: -620, s: 1.2, rx: 4, ry: 6 },
  { t: 10.9, x: 0, y: -640, s: 1.24, rx: 3, ry: 4 },
  { t: 12.2, x: 0, y: -660, s: 1.26, rx: 3, ry: -4 },
  { t: 14.6, x: 0, y: -650, s: 1.24, rx: 3, ry: -5 },
  { t: 15.4, x: 0, y: -620, s: 1.16, rx: 3, ry: 4 },
  { t: 17.3, x: 0, y: -600, s: 1.14, rx: 3, ry: 5 },
  { t: 18.3, x: 0, y: -90, s: 1.06, rx: 2, ry: -3 },
  { t: 20.6, x: 0, y: -60, s: 1.04, rx: 2, ry: 0 },
  { t: 21.4, x: 0, y: 40, s: 0.94, rx: 2, ry: 0 },
  { t: 24.2, x: 0, y: 60, s: 0.94, rx: 2, ry: 0 },
  { t: 25.2, x: 0, y: 1200, s: 0.8, rx: 10, ry: 0 },
];
function cam(t: number): K {
  if (t <= KEYS[0].t) return KEYS[0];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t <= b.t) {
      const p = soft(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))));
      const m = (k: keyof K) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * p;
      return { t, x: m("x"), y: m("y"), s: m("s"), rx: m("rx"), ry: m("ry") };
    }
  }
  return KEYS[KEYS.length - 1];
}

const PHONE_TOP = 560;
const WIN_TOP = 470; // the phone lives in a window below the captions, so camera moves never run under the text
const PhoneStage: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const k = cam(t);
  const dim = interpolate(t, [20.9, 21.5, 24.1, 24.6], [0, 1, 1, 0], clamp);
  const bodyH = STATUS_H + VIEW_H + 28;
  const mask = "linear-gradient(to bottom, transparent 0px, #000 56px)";
  return (
    <div style={{ position: "absolute", left: 0, top: WIN_TOP, width: 1080, height: 1920 - WIN_TOP, overflow: "hidden", WebkitMaskImage: mask, maskImage: mask }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2600, perspectiveOrigin: "50% 40%" }}>
        <div style={{ position: "absolute", left: 540 - (SCREEN_W + 28) / 2, top: PHONE_TOP - WIN_TOP, transform: `translate(${k.x}px, ${k.y}px) rotateX(${k.rx}deg) rotateY(${k.ry}deg) scale(${k.s})`, transformOrigin: `50% ${bodyH * 0.38}px`, filter: `brightness(${1 - dim * 0.55}) blur(${dim * 6}px)` }}>
          <Phone glow={1 - dim * 0.6}><Clips /></Phone>
        </div>
      </div>
    </div>
  );
};

// ---------- hook (0 - 4.6 s): the mess, then it all gets pulled in ----------
const CARDS = [
  { label: "IMG_2041.jpg", x: 150, y: 420, r: -9, c: "#e9a24a", w: 400 },
  { label: "Screenshot 2026-10-12", x: 560, y: 330, r: 6, c: "#4c8dff", w: 470 },
  { label: "bill_final_v2.pdf", x: 90, y: 1130, r: 8, c: "#e5645c", w: 420 },
  { label: "Notes (3)", x: 640, y: 1020, r: -6, c: "#e0b341", w: 330 },
  { label: "Chat with Dad", x: 330, y: 1400, r: -4, c: "#4cc38a", w: 400 },
  { label: "Untitled", x: 700, y: 1340, r: 10, c: "#a595ff", w: 280 },
  { label: "Voice note 07", x: 40, y: 760, r: 5, c: "#7aa7ff", w: 380 },
  { label: "Download (1)", x: 690, y: 690, r: -8, c: "#c4c7d1", w: 340 },
];
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const pull = interpolate(t, [3.75, 4.5], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.9, 0.4) });
  return (
    <AbsoluteFill>
      {CARDS.map((c, i) => {
        const inP = spring({ frame: f - 3 - i * 3, fps: FPS, config: { damping: 16, stiffness: 120 } });
        const dx = Math.sin(f / (40 + i * 7) + i) * 16, dy = Math.cos(f / (46 + i * 5) + i * 2) * 18;
        const px = 540 - (c.x + c.w / 2), py = 960 - (c.y + 60);
        return (
          <div key={i} style={{ position: "absolute", left: c.x + dx + px * pull, top: c.y + dy + py * pull, width: c.w, height: 120, borderRadius: 28, background: "rgba(28,30,36,.92)", border: "2px solid rgba(255,255,255,.08)", boxShadow: "0 30px 60px -20px rgba(0,0,0,.7)", display: "flex", alignItems: "center", gap: 22, padding: "0 28px", boxSizing: "border-box", transform: `rotate(${c.r * (1 - pull)}deg) scale(${inP * (1 - pull * 0.85)})`, opacity: 0.55 * (1 - pull) * Math.min(1, inP) }}>
            <div style={{ width: 54, height: 54, borderRadius: 14, background: c.c, opacity: 0.9, flex: "none" }} />
            <div style={{ fontFamily: FONT, fontSize: 34, fontWeight: 600, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- captions (match the spoken words; hero size in the hook, top of frame afterwards) ----------
const HILITE = new Set(["stash", "inbox", "vault", "search", "bill?", "offline.", "bio.", "tap."]);
const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const cur = (plan.caps as { text: string; start: number; end: number }[]).find((c) => t >= c.start - 0.02 && t < c.end);
  if (!cur) return null;
  const hero = cur.start < 4.4;
  const p = spring({ frame: f - S(cur.start), fps: FPS, config: { damping: 18, stiffness: 190 } });
  const out = interpolate(t, [cur.end - 0.1, cur.end], [1, 0], clamp);
  const words = cur.text.split(" ");
  return (
    <AbsoluteFill style={{ justifyContent: hero ? "center" : "flex-start", alignItems: "center", paddingTop: hero ? 0 : 250, pointerEvents: "none" }}>
      <div style={{ width: 920, textAlign: "center", fontFamily: FONT, fontWeight: 800, letterSpacing: -2, lineHeight: 1.08, fontSize: hero ? 112 : 84, color: C.text, transform: `translateY(${(1 - p) * 26}px) scale(${0.96 + 0.04 * p})`, opacity: Math.min(1, p * 1.4) * out, textShadow: "0 6px 30px rgba(0,0,0,.65)" }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: HILITE.has(w.toLowerCase().replace(/[,]/g, "")) ? C.accentSoft : C.text }}>{w}{i < words.length - 1 ? " " : ""}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ---------- privacy facts (21 - 24.4 s) ----------
const Icon: React.FC<{ kind: "device" | "user" | "wifi" }> = ({ kind }) => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {kind === "device" && (<><rect x="7" y="2.5" width="10" height="19" rx="2.6" /><path d="M11 18.5h2" /></>)}
    {kind === "user" && (<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" /><path d="M3.5 3.5l17 17" /></>)}
    {kind === "wifi" && (<><path d="M2.5 9a15 15 0 0 1 19 0" /><path d="M5.5 12.6a10.5 10.5 0 0 1 13 0" /><path d="M8.7 16a5.8 5.8 0 0 1 6.6 0" /><circle cx="12" cy="19.2" r=".6" fill="#fff" /><path d="M3.5 3.5l17 17" /></>)}
  </svg>
);
const Facts: React.FC = () => {
  const f = useCurrentFrame();
  const items: { t: number; text: string; kind: "device" | "user" | "wifi" }[] = [
    { t: 21.15, text: "On your device", kind: "device" },
    { t: 22.7, text: "No account", kind: "user" },
    { t: 23.35, text: "Works offline", kind: "wifi" },
  ];
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 44, flexDirection: "column", paddingTop: 140 }}>
      {items.map((it, i) => {
        const p = spring({ frame: f - S(it.t), fps: FPS, config: { damping: 15, stiffness: 150 } });
        const out = interpolate(f / FPS, [24.0, 24.35], [1, 0], clamp);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, padding: "30px 54px 30px 40px", borderRadius: 999, background: "rgba(22,23,28,.9)", border: "2px solid rgba(165,149,255,.35)", boxShadow: "0 40px 90px -30px rgba(108,81,245,.6)", transform: `translateY(${(1 - p) * 60}px) scale(${0.85 + 0.15 * p})`, opacity: Math.min(1, p * 1.5) * out }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: C.grad, display: "grid", placeItems: "center" }}><Icon kind={it.kind} /></div>
            <div style={{ fontFamily: FONT, fontWeight: 750, fontSize: 70, color: C.text, letterSpacing: -1.5 }}>{it.text}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- call to action (24.4 s to the end) ----------
const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const p = spring({ frame: f - S(24.55), fps: FPS, config: { damping: 14, stiffness: 120 } });
  const q = spring({ frame: f - S(25.35), fps: FPS, config: { damping: 18, stiffness: 140 } });
  const r = spring({ frame: f - S(26.0), fps: FPS, config: { damping: 18, stiffness: 140 } });
  const glow = 0.8 + 0.2 * Math.sin(f / 18);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", paddingTop: 80 }}>
      <div style={{ transform: `scale(${p}) rotate(${(1 - p) * -12}deg)`, opacity: Math.min(1, p * 1.5), width: 270, height: 270, borderRadius: 64, overflow: "hidden", boxShadow: `0 40px 120px -20px rgba(108,81,245,${0.8 * glow})` }}>
        <img src={staticFile("icon.png")} style={{ width: "100%", height: "100%" }} />
      </div>
      <div style={{ marginTop: 44, fontFamily: FONT, fontWeight: 800, fontSize: 168, letterSpacing: -6, color: C.text, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 30}px)` }}>Stash</div>
      <div style={{ marginTop: 8, fontFamily: FONT, fontWeight: 500, fontSize: 52, color: C.muted, opacity: q, transform: `translateY(${(1 - q) * 20}px)` }}>Capture today. Find it tomorrow.</div>
      <div style={{ marginTop: 70, padding: "30px 56px", borderRadius: 999, background: C.grad, fontFamily: FONT, fontWeight: 700, fontSize: 50, color: "#fff", letterSpacing: -0.5, opacity: r, transform: `translateY(${(1 - r) * 30}px) scale(${0.94 + 0.06 * r})`, boxShadow: "0 30px 80px -20px rgba(108,81,245,.8)" }}>stash.stvoonna.workers.dev</div>
      <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 500, fontSize: 44, color: C.muted, opacity: r, textAlign: "center", lineHeight: 1.3 }}>Opens in your browser.<br />Add it to your Home Screen.</div>
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ music: boolean }> = ({ music }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Background />
      {t < 4.6 && <Hook />}
      {t >= 4.2 && t < 25.6 && <PhoneStage />}
      {t >= 20.9 && t < 24.4 && <Facts />}
      {t >= 24.3 && <Cta />}
      <Captions />
      <Audio src={staticFile("audio/voice_sfx.wav")} />
      {music && <Audio src={staticFile("audio/music.wav")} />}
    </AbsoluteFill>
  );
};
