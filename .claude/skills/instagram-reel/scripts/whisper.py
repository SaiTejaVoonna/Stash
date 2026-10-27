import sherpa_onnx, soundfile as sf, glob, numpy as np, sys
M="sherpa-onnx-whisper-base.en"
r=sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{M}/base.en-encoder.int8.onnx",decoder=f"{M}/base.en-decoder.int8.onnx",tokens=f"{M}/base.en-tokens.txt",num_threads=4,language="en",task="transcribe")
for f in (sys.argv[1:] or sorted(glob.glob("lines/*.wav"))):
    d,sr=sf.read(f,dtype="float32")
    if d.ndim>1: d=d.mean(1)
    x=np.interp(np.linspace(0,len(d),int(len(d)*16000/sr),endpoint=False),np.arange(len(d)),d).astype("float32")
    s=r.create_stream(); s.accept_waveform(16000,x); r.decode_stream(s); print(f,"|",s.result.text.strip())
