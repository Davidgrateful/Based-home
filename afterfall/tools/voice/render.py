"""Record every line in tools/voice/lines.json with Kokoro (local neural TTS),
treat each by who is speaking and how (radio, black-box tape, the Choir...),
and pack the results for the game:

    public/voice/<pack>.mp3      concatenated MP3 clips (one stream per pack)
    public/voice/manifest.json   key -> [pack, offset, bytes, ms] (+ "#b" keys:
                                 the player's lines in the second voice)

    pip install kokoro-onnx soundfile
    KOKORO=/path/to/dir-with-kokoro-v1.0.onnx-and-voices-v1.0.bin python3 tools/voice/render.py

Re-running only renders lines whose text or treatment changed (cache by hash).

Recorded voices: put actors' takes in tools/voice/recorded/ named by the line
IDs in cast.json (the voice script's IDs), e.g. WAKE-02.wav; the player's lines
come in two voices, WAKE-01-A.wav and WAKE-01-B.wav. A recorded take replaces
the TTS for that line and gets the same treatment (radio, tape, echo...); any
line without one keeps its TTS voice.
"""
import hashlib, json, os, subprocess, sys, tempfile, time

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../.."))
KDIR = os.environ.get("KOKORO", HERE)
CACHE = os.path.join(KDIR, "cache")
OUT = os.path.join(ROOT, "public", "voice")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

k = Kokoro(os.path.join(KDIR, "kokoro-v1.0.onnx"), os.path.join(KDIR, "voices-v1.0.bin"))

# ---------------------------------------------------------------- treatments
def pitch(f):  # shift pitch by factor f, keep the length
    return f"asetrate=24000*{f},aresample=24000,atempo={1 / f:.4f}"

ROOM = "aecho=0.8:0.35:18|31:0.18|0.1"
FX = {
    "dry": "highpass=f=70",
    "cabin": f"highpass=f=90,{ROOM}",
    "radio": "highpass=f=320,lowpass=f=3300,acompressor=threshold=0.12:ratio=5:attack=4:release=60,volume=1.6",
    "tape": "highpass=f=220,lowpass=f=3800,vibrato=f=0.7:d=0.025,aecho=0.8:0.3:40:0.15,acompressor=threshold=0.15:ratio=4,volume=1.4",
    "hollow": f"{pitch(0.8)},aecho=0.8:0.7:60|130:0.4|0.25,acrusher=bits=11:mix=0.25,lowpass=f=5200",
    "whisper": f"{pitch(0.94)},aecho=0.8:0.8:90|220:0.45|0.3,highpass=f=200",
    "warden": f"{pitch(0.74)},lowpass=f=5000,aecho=0.8:0.85:110|240:0.5|0.3,volume=1.3",
    "teo": f"{pitch(0.9)},highpass=f=80,{ROOM}",
    "soft": "highpass=f=90,volume=0.75",
    "choir": "highpass=f=140,aecho=0.8:0.88:170|390|720:0.42|0.3|0.2",
}

ECHO_VOICES = ["af_bella", "am_adam", "bf_isabella", "am_eric", "af_kore", "bm_daniel", "af_river", "am_liam", "bf_alice", "am_echo", "af_aoede"]
YOU_VOICES = {"a": "am_michael", "b": "af_sarah"}


def cast(l, alt="a"):
    """-> (list of (voice, speed, pitch factor)), fx key"""
    i, name, radio = l["id"], l["name"], l["radio"]
    if i == "RHEA":
        if name == "From the trees":
            return [("af_heart", 0.9, 1)], "whisper"
        return [("af_heart", 1.03, 1)], "radio" if radio else "cabin"
    if i == "YOU":
        v = YOU_VOICES[alt]
        if name == "The patient":
            return [(v, 0.8, 1)], "soft"
        if name.startswith("Patient"):
            return [(v, 0.98, 1)], "tape"
        return [(v, 1.0, 1)], "dry"
    if i == "PILOT":
        if "recording" in name:
            return [("bm_george", 0.95, 1)], "tape"
        return [("bm_george", 0.98, 1)], "radio" if radio else "cabin"
    if i == "DEZ":
        return [("am_puck", 1.12, 1)], "cabin"
    if i == "HOLLOW":
        if name in ("In the trees", "By the wreck"):
            return [("am_fenrir", 0.78, 1)], "whisper"
        return [("am_onyx", 0.86, 1)], "hollow"
    if i == "WARDEN":
        return [("bm_lewis", 0.84, 1)], "warden"
    if i == "CHOIR":
        return [("af_nicole", 0.85, 1.0), ("bf_emma", 0.85, 0.94), ("am_onyx", 0.85, 1.12)], "choir"
    if i == "ECHO":
        n = sum(map(ord, name))
        return [(ECHO_VOICES[n % len(ECHO_VOICES)], 0.95, 1)], "tape"
    if i == "INES":
        return [("bf_emma", 1.02, 1)], "dry"
    if i == "TRADER":
        return [("bf_lily", 0.9, 1)], "teo"
    if i == "TEO":
        return [("bm_fable", 0.88, 1)], "teo"
    raise ValueError(i)


def lang(v):
    return "en-gb" if v[0] == "b" else "en-us"


REC = os.path.join(HERE, "recorded")
IDS = {c["key"]: c["id"] for c in json.load(open(os.path.join(HERE, "cast.json")))}


def recorded(l, alt):
    """The actor's take for this line, if there is one."""
    rid = IDS.get(l["key"])
    if not rid:
        return None
    name = f"{rid}-{alt.upper()}" if l["id"] == "YOU" else rid
    for ext in (".wav", ".flac", ".mp3"):
        f = os.path.join(REC, name + ext)
        if os.path.exists(f):
            return f
    return None


def render(l, alt):
    voices, fx = cast(l, alt)
    take = recorded(l, alt)
    if take:
        # an actor's take: same treatment as the TTS line it replaces, minus
        # the Choir's layering (a recorded Choir is layered in the session)
        st = os.stat(take)
        h = hashlib.sha1(json.dumps([take, st.st_size, st.st_mtime, FX[fx]]).encode()).hexdigest()[:16]
        mp3 = os.path.join(CACHE, "rec-" + h + ".mp3")
        if not os.path.exists(mp3):
            chain = f"[0:a]aformat=channel_layouts=mono,aresample=24000,{FX[fx]},apad=pad_dur=0.12,loudnorm=I=-17:TP=-1.5:LRA=9[o]"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", take, "-filter_complex", chain, "-map", "[o]",
                            "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", mp3], check=True)
        ms = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3],
                                  capture_output=True, text=True).stdout) * 1000
        return mp3, round(ms)
    sig = json.dumps([l["say"], voices, FX[fx]])
    h = hashlib.sha1(sig.encode()).hexdigest()[:16]
    mp3 = os.path.join(CACHE, h + ".mp3")
    if not os.path.exists(mp3):
        with tempfile.TemporaryDirectory() as tmp:
            parts = []
            for n, (v, speed, p) in enumerate(voices):
                s, sr = k.create(l["say"], voice=v, speed=speed, lang=lang(v))
                w = os.path.join(tmp, f"{n}.wav")
                sf.write(w, s, sr)
                parts.append((w, p))
            ins = sum((["-i", w] for w, _ in parts), [])
            if len(parts) == 1:
                chain = f"[0:a]{FX[fx]},apad=pad_dur=0.12,loudnorm=I=-17:TP=-1.5:LRA=9[o]"
            else:
                # the Choir: the same words in several voices, slightly apart
                pre = ";".join(f"[{n}:a]{pitch(p)},adelay={n * 35}[v{n}]" for n, (_, p) in enumerate(parts))
                mix = "".join(f"[v{n}]" for n in range(len(parts)))
                chain = f"{pre};{mix}amix=inputs={len(parts)}:normalize=0,{FX[fx]},apad=pad_dur=0.4,loudnorm=I=-18:TP=-1.5:LRA=9[o]"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", chain, "-map", "[o]",
                            "-ar", "24000", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", mp3], check=True)
    ms = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3],
                              capture_output=True, text=True).stdout) * 1000
    return mp3, round(ms)


lines = json.load(open(os.path.join(HERE, "lines.json")))
jobs = [(l, "a") for l in lines] + [(l, "b") for l in lines if l["id"] == "YOU"]
if os.environ.get("SAMPLE"):  # one line per character, to audition the cast
    seen, pick = set(), []
    for l, alt in jobs:
        tag = (l["id"], l["name"], l["radio"], alt)
        if tag not in seen:
            seen.add(tag)
            pick.append((l, alt))
    jobs = pick
packs, manifest = {}, {}
t0 = time.time()
for n, (l, alt) in enumerate(jobs):
    mp3, ms = render(l, alt)
    data = open(mp3, "rb").read()
    buf = packs.setdefault(l["pack"], bytearray())
    key = l["key"] + ("#b" if alt == "b" else "")
    manifest[key] = [l["pack"], len(buf), len(data), ms]
    buf.extend(data)
    if n % 20 == 0:
        print(f"{n}/{len(jobs)} {time.time() - t0:.0f}s  {l['id']:7s} {l['say'][:60]}", flush=True)

for p, buf in packs.items():
    open(os.path.join(OUT, f"{p}.mp3"), "wb").write(buf)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), separators=(",", ":"))
sizes = {p: f"{len(b) / 1e6:.2f} MB" for p, b in packs.items()}
print("done", len(manifest), "clips", sizes, f"{time.time() - t0:.0f}s")
