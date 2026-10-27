#!/bin/sh
# Re-mix the audio of the two versions onto the rendered picture (no need to re-render video when only sound changes).
# usage: sh mix.sh   (expects remo/out/stash-reel-nomusic.mp4 as the picture; writes deliver/*.mp4 at about -15 LUFS)
set -e
cd "$(dirname "$0")"
A=remo/public/audio; V=remo/out/stash-reel-nomusic.mp4; mkdir -p deliver
ffmpeg -y -loglevel error -i $V -i $A/voice_sfx.wav -i $A/music.wav -filter_complex "[1:a][2:a]amix=inputs=2:duration=first:normalize=0:weights=1 1[a]" -map 0:v -map "[a]" -c:v copy -t 30 /tmp/_with.mp4
ffmpeg -y -loglevel error -i $V -i $A/voice_sfx.wav -map 0:v -map 1:a -c:v copy -t 30 /tmp/_no.mp4
ffmpeg -y -loglevel error -i /tmp/_with.mp4 -c:v copy -af "acompressor=threshold=-26dB:ratio=3:attack=5:release=150:makeup=4,loudnorm=I=-14:TP=-2.5:LRA=7,alimiter=limit=0.72:level=disabled" -c:a aac -b:a 256k -ar 48000 -movflags +faststart deliver/Stash-Reel-with-music.mp4
ffmpeg -y -loglevel error -i /tmp/_no.mp4 -c:v copy -af "acompressor=threshold=-26dB:ratio=3:attack=5:release=150:makeup=4,loudnorm=I=-14:TP=-2.5:LRA=7,alimiter=limit=0.72:level=disabled" -c:a aac -b:a 256k -ar 48000 -movflags +faststart deliver/Stash-Reel-no-music.mp4
