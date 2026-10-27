import sherpa_onnx, soundfile as sf, numpy as np, json, sys, os
D="kokoro-multi-lang-v1_0"
cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(),kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=f"{D}/model.onnx",voices=f"{D}/voices.bin",tokens=f"{D}/tokens.txt",data_dir=f"{D}/espeak-ng-data",dict_dir=f"{D}/dict",lexicon=f"{D}/lexicon-us-en.txt"),num_threads=4,provider="cpu"))
tts=sherpa_onnx.OfflineTts(cfg)
print("speakers",tts.num_speakers,"sr",tts.sample_rate)
sid=int(sys.argv[1]); speed=float(sys.argv[2]); text=sys.argv[3]; out=sys.argv[4]
a=tts.generate(text,sid=sid,speed=speed)
sf.write(out,np.array(a.samples),a.sample_rate); print(out,len(a.samples)/a.sample_rate,"s")
