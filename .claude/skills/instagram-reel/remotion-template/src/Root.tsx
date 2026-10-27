import React from "react";
import { Composition } from "remotion";
import { Reel } from "./Reel";
import plan from "./plan.json";

// 1080x1920 (9:16), 30 fps, 30 s. `music` switches the background track on or off (the Instagram version has none).
export const Root: React.FC = () => (
  <Composition
    id="StashReel"
    component={Reel}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={Math.round(plan.duration * 30)}
    defaultProps={{ music: true }}
  />
);
