import React from "react";
import { C, FONT } from "./theme";

export const SCREEN_W = 680;
const K = SCREEN_W / 390; // app CSS px -> reel px
export const STATUS_H = 44 * K;
export const VIEW_H = 844 * K;

const Status: React.FC = () => (
  <div style={{ height: STATUS_H, background: "#0d0e11", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${34 * K}px`, color: "#fff", fontFamily: FONT, fontWeight: 600, fontSize: 15 * K }}>
    <span>9:41</span>
    <span style={{ display: "flex", gap: 7 * K, alignItems: "center" }}>
      <svg width={18 * K} height={12 * K} viewBox="0 0 18 12" fill="#fff"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width={26 * K} height={13 * K} viewBox="0 0 26 13" fill="none"><rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="#fff" opacity=".5"/><rect x="2" y="2" width="19" height="9" rx="2.2" fill="#fff"/><rect x="24" y="4" width="1.8" height="5" rx=".9" fill="#fff" opacity=".5"/></svg>
    </span>
  </div>
);

// A phone: titanium-style frame, dynamic island, status bar, and the screen content (the real app recordings) below it.
export const Phone: React.FC<{ children: React.ReactNode; glow?: number }> = ({ children, glow = 1 }) => {
  const bezel = 14;
  return (
    <div style={{ width: SCREEN_W + bezel * 2, height: STATUS_H + VIEW_H + bezel * 2, borderRadius: 112, padding: bezel, background: "linear-gradient(160deg,#3a3c45,#15161a 40%,#2b2d35)", boxShadow: `0 60px 140px -30px rgba(0,0,0,.85), 0 0 ${160 * glow}px -20px rgba(108,81,245,${0.55 * glow}), inset 0 0 0 2px rgba(255,255,255,.08)`, position: "relative", boxSizing: "border-box" }}>
      <div style={{ width: SCREEN_W, height: STATUS_H + VIEW_H, borderRadius: 98, overflow: "hidden", background: "#0d0e11", position: "relative" }}>
        <Status />
        <div style={{ position: "relative", width: SCREEN_W, height: VIEW_H, overflow: "hidden" }}>{children}</div>
        <div style={{ position: "absolute", top: 14 * K * 0.9, left: "50%", transform: "translateX(-50%)", width: 118 * K, height: 34 * K, borderRadius: 40, background: "#000" }} />
      </div>
    </div>
  );
};
