import subprocess
import numpy as np
import wave
import os

SR = 44100
DURATION = 56.0
N_SAMPLES = int(SR * DURATION)

# Load voiceover
vo_path = "/Users/zhangzhenfang/Desktop/贰点九/科普视频/粒子数反转旁白.mp3"
cmd = ["ffmpeg", "-i", vo_path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"]
raw = subprocess.check_output(cmd, stderr=subprocess.DEVNULL)
vo = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)

vo_padded = np.zeros((N_SAMPLES, 2), dtype=np.float32)
vo_len = min(len(vo), N_SAMPLES)
vo_padded[:vo_len] = vo[:vo_len]

t_full = np.arange(N_SAMPLES) / SR

# Helper functions for synthesis
def pluck_note(freq, dur, brightness=0.5, stereo_pan=0.0):
    n = int(SR * dur)
    if n <= 0 or freq <= 0:
        return np.zeros((0, 2), dtype=np.float32)
    t = np.arange(n) / SR
    # Plucked balalaika / harpsichord + warm body
    env = np.exp(-t * (5.5 / max(0.25, dur))) * (1.0 - np.exp(-t * 180.0))
    sig = (
        0.60 * np.sin(2 * np.pi * freq * t)
        + 0.25 * brightness * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 8.0)
        + 0.12 * brightness * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 12.0)
        + 0.06 * brightness * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 18.0)
    ) * env
    # Subtle mechanical pick transient
    click = np.exp(-t * 400.0) * np.sin(2 * np.pi * freq * 6 * t) * 0.08
    sig = sig + click
    l = sig * np.sqrt(0.5 * (1.0 - stereo_pan))
    r = sig * np.sqrt(0.5 * (1.0 + stereo_pan))
    return np.column_stack([l, r]).astype(np.float32)

def bell_note(freq, dur, pan=0.0):
    n = int(SR * dur)
    t = np.arange(n) / SR
    env = np.exp(-t * 3.2) * (1.0 - np.exp(-t * 300.0))
    sig = (
        0.7 * np.sin(2 * np.pi * freq * t)
        + 0.25 * np.sin(2 * np.pi * freq * 2.756 * t) * np.exp(-t * 7.0)
        + 0.15 * np.sin(2 * np.pi * freq * 5.404 * t) * np.exp(-t * 14.0)
    ) * env
    l = sig * np.sqrt(0.5 * (1.0 - pan))
    r = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([l, r]).astype(np.float32)

def add_clip(buf, start_sec, clip, gain=1.0):
    idx = int(start_sec * SR)
    if idx < 0 or idx >= len(buf):
        return
    end = min(len(buf), idx + len(clip))
    buf[idx:end] += clip[:end - idx] * gain

def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))

# Build Grand Budapest Hotel style whimsical plucked score (125 BPM, 2/4 polka-march feel)
bgm = np.zeros((N_SAMPLES, 2), dtype=np.float32)
bpm = 126.0
beat = 60.0 / bpm

# Chord progression in A minor / D minor / E7 / A minor (classic Eastern European chamber feel)
# Each bar is 2 beats
progression = [
    # (root_midi, chord_midis, melody_midis)
    (45, [57, 60, 64], [69, 72, 76, 72]),  # Am
    (45, [57, 60, 64], [76, 77, 76, 72]),  # Am
    (50, [62, 65, 69], [74, 77, 81, 77]),  # Dm
    (50, [62, 65, 69], [81, 79, 77, 74]),  # Dm
    (52, [59, 64, 68], [71, 74, 76, 74]),  # E7
    (52, [59, 64, 68], [76, 77, 74, 71]),  # E7
    (45, [57, 60, 64], [69, 72, 76, 81]),  # Am
    (52, [59, 64, 68], [80, 76, 74, 71]),  # E7 turnaround
]

total_bars = int(DURATION / (2 * beat)) + 2
for bar in range(total_bars):
    t_bar = bar * 2 * beat
    if t_bar >= DURATION - 1.8:
        break
    root, chord, mel = progression[bar % len(progression)]
    # Oom-pah bass & chord accompaniment
    # Beat 1: Bass pluck
    add_clip(bgm, t_bar, pluck_note(midi_to_freq(root), beat * 0.85, brightness=0.35, stereo_pan=-0.25), gain=0.22)
    # Beat 1.5: Offbeat chord staccato
    for c_m in chord:
        add_clip(bgm, t_bar + 0.5 * beat, pluck_note(midi_to_freq(c_m), beat * 0.42, brightness=0.65, stereo_pan=0.2), gain=0.09)
    # Beat 2: Alternate fifth bass
    add_clip(bgm, t_bar + 1.0 * beat, pluck_note(midi_to_freq(root + 7), beat * 0.85, brightness=0.35, stereo_pan=-0.25), gain=0.20)
    # Beat 2.5: Offbeat chord staccato
    for c_m in chord:
        add_clip(bgm, t_bar + 1.5 * beat, pluck_note(midi_to_freq(c_m), beat * 0.42, brightness=0.65, stereo_pan=0.2), gain=0.09)
    # Sixteenth/eighth whimsical balalaika / celesta melody
    for step_i, m_note in enumerate(mel):
        t_note = t_bar + step_i * 0.5 * beat
        pan = -0.35 if step_i % 2 == 0 else 0.35
        add_clip(bgm, t_note, pluck_note(midi_to_freq(m_note), beat * 0.48, brightness=0.8, stereo_pan=pan), gain=0.14)
        if bar % 2 == 1 and step_i in (0, 2):
            add_clip(bgm, t_note, bell_note(midi_to_freq(m_note + 12), beat * 0.8, pan=-pan), gain=0.06)

# Grand finale resolving chord at 53.6s -> 56.0s
for m_final in [45, 57, 61, 64, 69, 76, 81]:  # A major Picardy third triumph!
    add_clip(bgm, 53.55, pluck_note(midi_to_freq(m_final), 2.4, brightness=0.9, stereo_pan=0.0), gain=0.16)
    if m_final >= 69:
        add_clip(bgm, 53.55, bell_note(midi_to_freq(m_final), 2.4, pan=0.1), gain=0.10)

# Simple stereo comb/delay reverb on BGM
delay_samples = int(0.085 * SR)
bgm_rev = np.copy(bgm)
bgm_rev[delay_samples:, 0] += bgm[:-delay_samples, 1] * 0.25
bgm_rev[delay_samples:, 1] += bgm[:-delay_samples, 0] * 0.25
bgm = bgm_rev

# Build bespoke Sound Effects (SFX) layer synced to the 9 shots & morph transitions
sfx = np.zeros((N_SAMPLES, 2), dtype=np.float32)

def make_whoosh(dur, f_start, f_end, pan_start=-0.3, pan_end=0.3):
    n = int(SR * dur)
    t = np.arange(n) / SR
    np.random.seed(42)
    noise = np.random.randn(n)
    # Swept sine + filtered noise feel
    freq = np.linspace(f_start, f_end, n)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    env = np.sin(np.pi * t / dur) ** 1.5
    tone = np.sin(phase) * 0.6 + np.sin(phase * 1.5) * 0.25
    # Lowpass-like smoothing on noise
    win = 35
    smooth_noise = np.convolve(noise, np.ones(win)/win, mode="same")
    sig = (tone * 0.5 + smooth_noise * 0.5) * env
    pan = np.linspace(pan_start, pan_end, n)
    l = sig * np.sqrt(0.5 * (1.0 - pan))
    r = sig * np.sqrt(0.5 * (1.0 + pan))
    return np.column_stack([l, r]).astype(np.float32)

# 1. 0.2s: Vintage lamp click & warm buzz
add_clip(sfx, 0.20, bell_note(1200, 0.08, pan=0.0), gain=0.25)

# 2. 2.45s: Laser slice & power chord shimmer ("激光却威力无穷")
add_clip(sfx, 2.45, make_whoosh(0.55, 220, 1760, -0.6, 0.6), gain=0.28)
add_clip(sfx, 2.65, bell_note(880, 0.9, pan=0.2), gain=0.18)

# 3. 5.65s: Title plaque mechanical flip & hotel reception bell ("粒子数反转")
add_clip(sfx, 5.62, bell_note(1046.5, 1.2, pan=-0.15), gain=0.24)
add_clip(sfx, 5.74, bell_note(1318.5, 1.4, pan=0.15), gain=0.26)

# 4. 7.45s: Plaque morphing into Grand Budapest Hotel floors (elevator ding + architectural slide)
add_clip(sfx, 7.45, bell_note(1567.98, 1.1, pan=0.0), gain=0.28)
add_clip(sfx, 7.55, make_whoosh(0.60, 500, 180, 0.0, 0.0), gain=0.22)

# 5. 10.85s: Boltzmann curve drawing chime
for i, m in enumerate([76, 72, 69, 64, 60]):
    add_clip(sfx, 10.90 + i * 0.14, pluck_note(midi_to_freq(m), 0.3, brightness=0.9, stereo_pan=0.35), gain=0.18)

# 6. 15.90s: Boltzmann curve morphs to thermometer + 3000K heat rise
add_clip(sfx, 15.90, make_whoosh(1.2, 200, 950, 0.3, -0.3), gain=0.25)
add_clip(sfx, 17.10, bell_note(1174.6, 0.6, pan=-0.3), gain=0.20)

# 7. 19.75s: Thermometer bulb bounces out and morphs into the Golden Sun / Photon!
for i, f in enumerate([350, 520, 780]):
    add_clip(sfx, 19.75 + i * 0.16, bell_note(f, 0.35, pan=-0.3 + i * 0.3), gain=0.25)

# 8. 21.35s: Photon swallowed by E1 particle ("吃掉")
add_clip(sfx, 21.35, make_whoosh(0.28, 880, 110, 0.1, 0.0), gain=0.35)

# 9. 24.50s & 28.10s: Balance scale / 180-degree floor inversion ("粒子数反转")
add_clip(sfx, 24.50, make_whoosh(0.55, 240, 640, -0.4, 0.4), gain=0.22)
add_clip(sfx, 28.20, bell_note(987.77, 0.8, pan=-0.2), gain=0.22)
add_clip(sfx, 28.35, bell_note(1318.5, 1.0, pan=0.2), gain=0.25)

# 10. 30.65s & 33.80s: Pushing particles to E2 & slipping right back down to E1 ("瞬间就会掉回一楼")
add_clip(sfx, 30.65, make_whoosh(0.7, 220, 660, -0.4, 0.1), gain=0.22)
for i, m in enumerate([79, 77, 74, 71, 67, 64, 60, 55]):
    add_clip(sfx, 33.75 + i * 0.12, pluck_note(midi_to_freq(m), 0.25, brightness=0.9, stereo_pan=0.2), gain=0.24)

# 11. 36.65s & 38.35s: Brass Energy Pump activates -> shoots E1 particles to E3 ("一口气抽到三楼")
add_clip(sfx, 36.65, make_whoosh(0.45, 120, 420, -0.5, -0.5), gain=0.28)
for i, m in enumerate([57, 60, 64, 69, 72, 76, 81, 84]):
    add_clip(sfx, 38.40 + i * 0.18, bell_note(midi_to_freq(m), 0.45, pan=-0.4 + i * 0.08), gain=0.20)

# 12. 41.05s: Non-radiative relaxation spiral slide E3 -> E2 ("悄悄滑落到二楼")
for i, m in enumerate([84, 83, 81, 79, 77, 76]):
    add_clip(sfx, 41.10 + i * 0.22, bell_note(midi_to_freq(m), 0.5, pan=0.3 - i * 0.05), gain=0.18)

# 13. 43.55s - 47.18s: E2 population builds up and surpasses E1 ("终于反超一楼！")
for i, m in enumerate([69, 71, 72, 74, 76, 77, 79, 81]):
    add_clip(sfx, 43.60 + i * 0.32, pluck_note(midi_to_freq(m), 0.4, brightness=0.85, stereo_pan=0.0), gain=0.18)
add_clip(sfx, 46.20, bell_note(midi_to_freq(81), 1.3, pan=-0.2), gain=0.32)
add_clip(sfx, 46.25, bell_note(midi_to_freq(88), 1.3, pan=0.2), gain=0.32)

# 14. 48.00s - 53.80s: Collective stimulated emission jump & LASER AVALANCHE!
add_clip(sfx, 48.05, make_whoosh(1.1, 1400, 380, 0.0, 0.0), gain=0.26)
add_clip(sfx, 50.45, make_whoosh(1.4, 220, 2400, -0.7, 0.7), gain=0.38)
for i, m in enumerate([69, 73, 76, 81, 85, 88]):
    add_clip(sfx, 51.90 + i * 0.15, bell_note(midi_to_freq(m), 2.5, pan=-0.3 + i * 0.12), gain=0.26)

def fast_moving_avg(x, win):
    cs = np.cumsum(np.insert(x, 0, 0.0))
    res = (cs[win:] - cs[:-win]) / float(win)
    pad_l = win // 2
    pad_r = len(x) - len(res) - pad_l
    return np.pad(res, (pad_l, pad_r), mode="edge")

# Auto-ducking envelope based on voiceover energy
vo_mono = np.mean(np.abs(vo_padded), axis=1)
vo_env = fast_moving_avg(vo_mono, int(0.18 * SR))
speaking = (vo_env > 0.008).astype(np.float32)
# Smooth the ducking curve over 0.35s
speaking_smooth = fast_moving_avg(speaking, int(0.35 * SR))
# BGM gain is 0.26 when speaking, 0.68 during pauses and intro/outro
bgm_duck = 0.68 - 0.42 * np.clip(speaking_smooth, 0.0, 1.0)
sfx_duck = 0.85 - 0.25 * np.clip(speaking_smooth, 0.0, 1.0)

# Fade out at very end (55.0s -> 56.0s)
fade_out = np.ones(N_SAMPLES, dtype=np.float32)
fade_len = int(1.1 * SR)
fade_out[-fade_len:] = np.linspace(1.0, 0.0, fade_len)

master = (
    vo_padded * 1.15
    + bgm * bgm_duck[:, None] * fade_out[:, None]
    + sfx * sfx_duck[:, None] * fade_out[:, None]
)

# Soft limiter to prevent clipping
master = np.tanh(master * 1.05) * 0.92
master_int16 = (np.clip(master, -1.0, 1.0) * 32767).astype(np.int16)

os.makedirs("/Users/zhangzhenfang/Desktop/贰点九/科普视频/v1-grand-budapest-style", exist_ok=True)
wav_path = "/tmp/master_audio.wav"
with wave.open(wav_path, "wb") as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    wf.writeframes(master_int16.tobytes())

mp3_out = "/Users/zhangzhenfang/Desktop/贰点九/科普视频/v1-grand-budapest-style/audio_mix.mp3"
subprocess.run(["ffmpeg", "-y", "-i", wav_path, "-b:a", "192k", mp3_out], check=True, stderr=subprocess.DEVNULL)
print("Master audio generated:", mp3_out)
