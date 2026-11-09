import subprocess
import numpy as np
import wave
import os

SR = 44100
DURATION = 56.0
N_SAMPLES = int(SR * DURATION)

vo_path = "/Users/zhangzhenfang/Desktop/贰点九/科普视频/粒子数反转旁白.mp3"
cmd = ["ffmpeg", "-i", vo_path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"]
raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
vo = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)

vo_padded = np.zeros((N_SAMPLES, 2), dtype=np.float32)
vo_len = min(len(vo), N_SAMPLES)
vo_padded[:vo_len] = vo[:vo_len]

def fast_moving_avg(x, win):
    cs = np.cumsum(np.insert(x, 0, 0.0))
    res = (cs[win:] - cs[:-win]) / float(win)
    pad_l = win // 2
    pad_r = len(x) - len(res) - pad_l
    return np.pad(res, (pad_l, pad_r), mode="edge")

def add_clip(buf, start_sec, clip, gain=1.0):
    idx = int(start_sec * SR)
    if idx < 0 or idx >= len(buf):
        return
    end = min(len(buf), idx + len(clip))
    buf[idx:end] += clip[:end - idx] * gain

def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))

# --- SYNTHESIZERS MATCHING 《脑内擂台》 AUDIO PROFILE ---
# Deep sub-bass pulse + warm analog synth pad + minimal crystalline arpeggio + arena impacts

def sub_pulse(freq, dur, drive=1.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    # Punchy pitch envelope drop into deep sub (50-80Hz)
    f_env = freq * (1.0 + 1.4 * np.exp(-t * 38.0))
    phase = 2 * np.pi * np.cumsum(f_env) / SR
    amp_env = (1.0 - np.exp(-t * 140.0)) * np.exp(-t * (4.2 / max(0.2, dur)))
    sig = np.tanh(np.sin(phase) * drive) * amp_env
    return np.column_stack([sig, sig]).astype(np.float32)

def warm_pad_chord(midis, dur, tension=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    env = np.sin(np.pi * t / dur) ** 0.7
    l = np.zeros(n, dtype=np.float32)
    r = np.zeros(n, dtype=np.float32)
    for i, m in enumerate(midis):
        f = midi_to_freq(m)
        # Detuned warm analog saw/sine hybrid filtered low
        s1 = np.sin(2 * np.pi * f * 0.998 * t + i)
        s2 = np.sin(2 * np.pi * f * 1.002 * t - i)
        sub = 0.45 * np.sin(2 * np.pi * (f * 0.5) * t)
        shimmer = (0.15 + 0.2 * tension) * np.sin(2 * np.pi * (f * 2.0) * t) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.8 * t + i))
        l += (s1 * 0.5 + sub + shimmer) / len(midis)
        r += (s2 * 0.5 + sub + shimmer) / len(midis)
    return np.column_stack([l * env, r * env]).astype(np.float32)

def crystal_pluck(freq, dur, pan=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    env = (1.0 - np.exp(-t * 250.0)) * np.exp(-t * (5.0 / max(0.2, dur)))
    sig = (
        0.65 * np.sin(2 * np.pi * freq * t)
        + 0.25 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t * 10.0)
        + 0.10 * np.sin(2 * np.pi * freq * 3.0 * t) * np.exp(-t * 18.0)
    ) * env
    l = sig * np.sqrt(0.5 * (1.0 - pan))
    r = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([l, r]).astype(np.float32)

def cinematic_sub_drop(dur=1.1, f_start=130.0, f_end=32.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    freq = f_start * ((f_end / f_start) ** (t / dur))
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = (1.0 - np.exp(-t * 80.0)) * np.exp(-t * 2.8)
    sig = np.tanh(np.sin(phase) * 1.6) * env
    return np.column_stack([sig, sig]).astype(np.float32)

def shockwave_impact(dur=0.9, pan=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    np.random.seed(int(dur * 1000))
    noise = fast_moving_avg(np.random.randn(n), 18)
    # Sub punch + glassy transient + wide air tail
    f_punch = 160.0 * np.exp(-t * 24.0) + 38.0
    punch = np.sin(2 * np.pi * np.cumsum(f_punch) / SR) * np.exp(-t * 6.5)
    shimmer = (
        np.sin(2 * np.pi * 1480 * t) * 0.25
        + np.sin(2 * np.pi * 2220 * t) * 0.18
    ) * np.exp(-t * 9.0)
    tail = noise * np.exp(-t * 4.5) * 0.8
    sig = np.tanh((punch * 0.85 + shimmer + tail) * 1.3)
    l = sig * np.sqrt(0.5 * (1.0 - pan * 0.5))
    r = sig * np.sqrt(0.5 * (1.0 + pan * 0.5))
    return np.column_stack([l, r]).astype(np.float32)

def camera_whoosh(dur=0.45, f_low=140.0, f_high=680.0, pan_start=-0.5, pan_end=0.5):
    n = int(SR * dur)
    t = np.arange(n) / SR
    np.random.seed(17)
    noise = fast_moving_avg(np.random.randn(n), 28)
    env = np.sin(np.pi * t / dur) ** 1.8
    u = np.sin(np.pi * t / dur)
    freq = f_low + (f_high - f_low) * u
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * 0.45
    sig = (tone + noise * 0.7) * env
    pan = np.linspace(pan_start, pan_end, n)
    l = sig * np.sqrt(0.5 * (1.0 - pan))
    r = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([l, r]).astype(np.float32)

def hud_telemetry_bleeps(start_t, count=5, step_sec=0.065, base_freq=1320.0):
    out = np.zeros((int(SR * (count * step_sec + 0.3)), 2), dtype=np.float32)
    for i in range(count):
        f = base_freq * (1.0 + ((i * 3) % 5) * 0.12)
        beep = crystal_pluck(f, 0.09, pan=-0.3 + (i % 3) * 0.3)
        add_clip(out, i * step_sec, beep, gain=0.22)
    return out

# --- BUILD BGM (Deep Cerebral Arena Electronic Score, 112 BPM) ---
bgm = np.zeros((N_SAMPLES, 2), dtype=np.float32)
bpm = 112.0
beat = 60.0 / bpm
bar_dur = 4 * beat

# Progression: D minor9 -> Bb maj7 -> G minor7 -> A7sus4/A7 (dark, intellectual, cinematic tension -> rule-changing triumph)
chords = [
    (38, [50, 53, 57, 60, 64], [69, 72, 74, 76, 74, 72, 69, 65]),  # Dm9
    (34, [46, 50, 53, 57, 60], [69, 72, 74, 77, 76, 74, 72, 69]),  # Bbmaj7
    (31, [43, 46, 50, 53, 58], [67, 70, 74, 77, 74, 70, 67, 62]),  # Gm7
    (33, [45, 49, 52, 57, 61], [69, 73, 76, 79, 76, 73, 69, 64]),  # A7
]

n_bars = int(DURATION / bar_dur) + 2
for b in range(n_bars):
    t_b = b * bar_dur
    if t_b >= DURATION - 1.5:
        break
    root, pad_notes, arp = chords[b % len(chords)]
    # Narrative intensity rises from 36s ("于是，激光器用能量泵...") to 54s
    intensity = np.clip((t_b - 24.0) / 24.0, 0.15, 1.0)

    # Warm dark analog pad bed
    add_clip(bgm, t_b, warm_pad_chord(pad_notes, bar_dur * 1.05, tension=intensity), gain=0.20)

    # Deep heartbeat sub-bass pulse on beats 1, 2.5, 3
    add_clip(bgm, t_b + 0.0 * beat, sub_pulse(midi_to_freq(root), beat * 0.9), gain=0.34)
    add_clip(bgm, t_b + 1.5 * beat, sub_pulse(midi_to_freq(root), beat * 0.6), gain=0.22 * (0.5 + 0.5 * intensity))
    add_clip(bgm, t_b + 2.0 * beat, sub_pulse(midi_to_freq(root + 7), beat * 0.8), gain=0.26)
    if intensity > 0.45:
        add_clip(bgm, t_b + 3.0 * beat, sub_pulse(midi_to_freq(root), beat * 0.7), gain=0.24)

    # Crystalline neural pulse arpeggio (eighth notes)
    for s_i, note_m in enumerate(arp):
        t_n = t_b + s_i * 0.5 * beat
        pan = -0.4 + (s_i % 4) * 0.26
        add_clip(bgm, t_n, crystal_pluck(midi_to_freq(note_m), beat * 0.48, pan=pan), gain=0.10 + 0.08 * intensity)

# Final resonant resolution chord at 53.5s -> 56.0s
add_clip(bgm, 53.50, warm_pad_chord([38, 50, 57, 62, 66, 69, 74], 2.5, tension=0.8), gain=0.30)
add_clip(bgm, 53.50, sub_pulse(midi_to_freq(38), 2.2), gain=0.42)

# Stereo delay space on BGM
d_samp = int(0.11 * SR)
bgm_space = np.copy(bgm)
bgm_space[d_samp:, 0] += bgm[:-d_samp, 1] * 0.28
bgm_space[d_samp:, 1] += bgm[:-d_samp, 0] * 0.28
bgm = bgm_space

# --- BUILD BESPOKE 《脑内擂台》 STYLE SFX LAYER ---
sfx = np.zeros((N_SAMPLES, 2), dtype=np.float32)

# 0.25s: Neural filament flicker & low hum
add_clip(sfx, 0.25, hud_telemetry_bleeps(0.25, count=3, step_sec=0.09, base_freq=880.0), gain=0.45)

# 2.45s: RGB Shockwave Impact + Laser slash ("激光却威力无穷？")
add_clip(sfx, 2.45, shockwave_impact(0.95, pan=0.0), gain=0.45)
add_clip(sfx, 2.50, camera_whoosh(0.50, 180, 1400, -0.6, 0.6), gain=0.35)

# 5.58s: Heavy Arena Gong / Sub-Drop Title Reveal ("粒子数反转。")
add_clip(sfx, 5.58, cinematic_sub_drop(1.2, 140.0, 34.0), gain=0.48)
add_clip(sfx, 5.62, shockwave_impact(1.1, pan=0.0), gain=0.42)
add_clip(sfx, 5.68, crystal_pluck(midi_to_freq(74), 1.4, pan=-0.2), gain=0.30)
add_clip(sfx, 5.75, crystal_pluck(midi_to_freq(81), 1.4, pan=0.2), gain=0.30)

# 7.55s: Camera dive into the 1st Floor Arena ("自然状态下，微观粒子非常懒")
add_clip(sfx, 7.55, camera_whoosh(0.65, 520, 140, 0.0, 0.0), gain=0.38)

# 10.80s: Scientific HUD Card & Boltzmann curve telemetry draw ("按照玻尔兹曼分布")
add_clip(sfx, 10.80, hud_telemetry_bleeps(10.80, count=7, step_sec=0.07, base_freq=1240.0), gain=0.55)

# 15.85s: Camera whip-pan + 3000K Red-Hot Coral spike alarm ("哪怕加热到三千度")
add_clip(sfx, 15.85, camera_whoosh(0.55, 160, 880, -0.4, 0.4), gain=0.38)
add_clip(sfx, 16.20, shockwave_impact(0.8, pan=0.2), gain=0.32)
add_clip(sfx, 17.65, hud_telemetry_bleeps(17.65, count=4, step_sec=0.08, base_freq=980.0), gain=0.45)

# 19.70s: Bouncing glowing core morphs into Golden Sun Photon -> dives into E1 ("光子一进来，全被底层粒子吃掉")
add_clip(sfx, 19.70, camera_whoosh(0.50, 260, 920, 0.3, -0.3), gain=0.36)
add_clip(sfx, 21.30, cinematic_sub_drop(0.65, 220.0, 40.0), gain=0.48) # Dark swallow!

# 24.55s & 28.15s: Cyan Rule-Change Shield & 180-degree Arena Inversion ("实现粒子数反转")
add_clip(sfx, 24.55, camera_whoosh(0.55, 180, 640, -0.3, 0.3), gain=0.34)
add_clip(sfx, 28.15, shockwave_impact(1.0, pan=0.0), gain=0.42)
add_clip(sfx, 28.25, crystal_pluck(midi_to_freq(81), 1.1, pan=0.0), gain=0.32)

# 30.55s & 33.75s: Direct push to E2 fails -> particles tumble down ("瞬间就会掉回一楼")
add_clip(sfx, 30.55, camera_whoosh(0.55, 200, 720, -0.4, 0.2), gain=0.32)
for i, m in enumerate([77, 74, 71, 67, 62, 57]):
    add_clip(sfx, 33.75 + i * 0.11, crystal_pluck(midi_to_freq(m), 0.25, pan=0.2 - i * 0.06), gain=0.28)
add_clip(sfx, 34.45, cinematic_sub_drop(0.7, 110.0, 36.0), gain=0.38)

# 36.00s - 43.00s: "你可以改规则" — Cyan/Gold Energy Pump blasts E1 -> E3, then glides E3 -> E2!
add_clip(sfx, 36.55, cinematic_sub_drop(0.8, 90.0, 45.0), gain=0.38)
add_clip(sfx, 38.30, camera_whoosh(0.85, 140, 1560, -0.5, -0.2), gain=0.44)
for i, m in enumerate([62, 65, 69, 74, 77, 81, 86]):
    add_clip(sfx, 38.45 + i * 0.16, crystal_pluck(midi_to_freq(m), 0.4, pan=-0.3 + i * 0.08), gain=0.25)

# 41.05s: Silky E3 -> E2 non-radiative relaxation glide into Cyan Shield platform
add_clip(sfx, 41.05, camera_whoosh(0.75, 1200, 440, -0.1, 0.3), gain=0.32)
add_clip(sfx, 41.20, hud_telemetry_bleeps(41.20, count=6, step_sec=0.09, base_freq=1480.0), gain=0.45)

# 43.55s - 47.18s: E2 energy bar surges past E1 -> RGB Shockwave ("终于反超一楼！")
for i, m in enumerate([69, 71, 74, 76, 77, 81, 83, 86]):
    add_clip(sfx, 43.60 + i * 0.30, crystal_pluck(midi_to_freq(m), 0.35, pan=0.0), gain=0.24)
add_clip(sfx, 46.15, shockwave_impact(1.15, pan=0.0), gain=0.50)
add_clip(sfx, 46.20, cinematic_sub_drop(1.1, 150.0, 35.0), gain=0.48)

# 47.95s - 54.00s: Collective Jump & Chromatic Laser Avalanche!
add_clip(sfx, 48.00, camera_whoosh(0.95, 1300, 320, 0.0, 0.0), gain=0.38)
add_clip(sfx, 50.40, shockwave_impact(1.4, pan=0.0), gain=0.55)
add_clip(sfx, 50.50, camera_whoosh(1.2, 180, 2200, -0.7, 0.7), gain=0.48)
add_clip(sfx, 51.95, cinematic_sub_drop(1.8, 160.0, 32.0), gain=0.52)

# Sidechain ducking around voiceover
vo_mono = np.mean(np.abs(vo_padded), axis=1)
vo_env = fast_moving_avg(vo_mono, int(0.16 * SR))
speaking = (vo_env > 0.008).astype(np.float32)
speaking_smooth = fast_moving_avg(speaking, int(0.32 * SR))

bgm_duck = 0.72 - 0.44 * np.clip(speaking_smooth, 0.0, 1.0)
sfx_duck = 0.88 - 0.26 * np.clip(speaking_smooth, 0.0, 1.0)

fade_out = np.ones(N_SAMPLES, dtype=np.float32)
fade_len = int(1.2 * SR)
fade_out[-fade_len:] = np.linspace(1.0, 0.0, fade_len)

master = (
    vo_padded * 1.18
    + bgm * bgm_duck[:, None] * fade_out[:, None]
    + sfx * sfx_duck[:, None] * fade_out[:, None]
)

master = np.tanh(master * 1.08) * 0.93
master_int16 = (np.clip(master, -1.0, 1.0) * 32767).astype(np.int16)

os.makedirs("/Users/zhangzhenfang/Desktop/贰点九/科普视频/src", exist_ok=True)
wav_path = "/tmp/master_audio_arena.wav"
with wave.open(wav_path, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(master_int16.tobytes())

mp3_out = "/Users/zhangzhenfang/Desktop/贰点九/科普视频/src/audio_mix.mp3"
subprocess.run(["ffmpeg", "-y", "-i", wav_path, "-b:a", "192k", mp3_out], check=True, stderr=subprocess.DEVNULL)
print("Arena master audio generated:", mp3_out)
