import asyncio
import os
import subprocess
import json
import wave
import imageio_ffmpeg
import edge_tts

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "en-US-ChristopherNeural"
PROJECT_DIR = r"c:\Users\Milmann\Documents\GhostDocs"
TEMP_DIR = os.path.join(PROJECT_DIR, "voiceover_clean_temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# Tightened, punchy narration lines timed perfectly to the 62.6s video
SEGMENTS = [
    {
        "target_start": 0.5,
        "text": "Every year, organizations lose critical institutional memory when projects sunset. Meet GhostDocs: a browser-local AI Crew that resurrects forgotten documents with zero network leakage.",
    },
    {
        "target_start": 9.0,
        "text": "Dropping Markdown and text files into the vault triggers Web Workers to parse, chunk, and embed them locally without blocking the UI.",
    },
    {
        "target_start": 17.0,
        "text": "The Archivist instantly catalogs structural metadata, author names, and extractive summaries.",
    },
    {
        "target_start": 23.5,
        "text": "The Historian reconstructs a chronological timeline across all documents, flagging temporal signals and confidence scores.",
    },
    {
        "target_start": 32.5,
        "text": "When we query the Q3 budget, The Researcher runs client-side vector search to synthesize an exact answer with clickable, verbatim citation badges.",
    },
    {
        "target_start": 44.0,
        "text": "A second question retrieves the security constitution date: September 14, 2024. Provenance is guaranteed with zero cloud leakage.",
    },
    {
        "target_start": 52.0,
        "text": "Finally, we seal our entire vault into a portable Time Capsule JSON file that can be restored offline. GhostDocs: bringing organizational memory back from the dead.",
    },
]

def get_audio_duration(file_path):
    cmd = [
        FFMPEG, "-i", file_path,
        "-f", "null", "-"
    ]
    result = subprocess.run(cmd, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    # Search for duration line: Duration: 00:00:07.49,
    import re
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", result.stderr)
    if m:
        hours, mins, secs = m.groups()
        return int(hours) * 3600 + int(mins) * 60 + float(secs)
    raise RuntimeError(f"Could not determine duration for {file_path}")

async def main():
    print("=== Step 1: Generate Speech Audio for Each Line ===")
    wav_files = []
    
    for i, seg in enumerate(SEGMENTS):
        mp3_path = os.path.join(TEMP_DIR, f"line_{i}.mp3")
        wav_path = os.path.join(TEMP_DIR, f"line_{i}.wav")
        
        # Rate +12% produces a crisp, natural, professional documentary pace
        tts = edge_tts.Communicate(seg["text"], VOICE, rate="+12%")
        await tts.save(mp3_path)
        
        # Convert to standard 24kHz mono PCM WAV
        subprocess.run([
            FFMPEG, "-y", "-i", mp3_path,
            "-ar", "24000", "-ac", "1",
            wav_path
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        duration = get_audio_duration(wav_path)
        wav_files.append({
            "index": i,
            "target_start": seg["target_start"],
            "path": wav_path,
            "duration": duration,
            "text": seg["text"]
        })
        print(f"  Line {i+1}: duration = {duration:.2f}s | Target start = {seg['target_start']}s")

    print("\n=== Step 2: Compute Guaranteed Non-Overlapping Timeline ===")
    current_time = 0.0
    timeline = []
    
    for item in wav_files:
        # Start at either the target start or after previous segment + 0.5s pause, whichever is later
        planned_start = max(item["target_start"], current_time + 0.5 if current_time > 0 else item["target_start"])
        end_time = planned_start + item["duration"]
        timeline.append({
            "index": item["index"],
            "start": planned_start,
            "end": end_time,
            "duration": item["duration"],
            "path": item["path"]
        })
        print(f"  Line {item['index']+1}: [{planned_start:5.2f}s -> {end_time:5.2f}s] (gap before: {planned_start - current_time:4.2f}s)")
        current_time = end_time

    # Verify 100% strictly non-overlapping
    for i in range(1, len(timeline)):
        gap = timeline[i]["start"] - timeline[i-1]["end"]
        assert gap >= 0.3, f"Overlap detected between {i-1} and {i}: gap={gap}s"
    print(f"\nTimeline verification passed! Final speech ends at {current_time:.2f}s (video is 62.6s).")

    print("\n=== Step 3: Stitch Single Sequential Audio Track ===")
    input_video = os.path.join(PROJECT_DIR, "ghostdocs-demo-walkthrough.webm")
    try:
        video_duration = get_audio_duration(input_video)
        print(f"  Detected input video duration: {video_duration:.2f}s")
    except Exception:
        video_duration = 63.0

    SAMPLE_RATE = 24000
    TOTAL_SAMPLES = int((video_duration + 1.0) * SAMPLE_RATE)
    master_samples = bytearray(TOTAL_SAMPLES * 2) # 16-bit PCM = 2 bytes/sample
    
    for item in timeline:
        with wave.open(item["path"], "rb") as wf:
            frames = wf.readframes(wf.getnframes())
            start_byte = int(item["start"] * SAMPLE_RATE) * 2
            end_byte = start_byte + len(frames)
            if end_byte > len(master_samples):
                frames = frames[:len(master_samples) - start_byte]
                end_byte = len(master_samples)
            master_samples[start_byte:end_byte] = frames

    unified_wav = os.path.join(TEMP_DIR, "single_voiceover_clean.wav")
    with wave.open(unified_wav, "wb") as out_wf:
        out_wf.setnchannels(1)
        out_wf.setsampwidth(2)
        out_wf.setframerate(SAMPLE_RATE)
        out_wf.writeframes(master_samples)
    print(f"  Unified clean audio track written to {unified_wav}")

    print("\n=== Step 4: Mux Clean Audio with Video ===")
    input_video = os.path.join(PROJECT_DIR, "ghostdocs-demo-walkthrough.webm")
    output_mp4 = os.path.join(PROJECT_DIR, "ghostdocs-demo-with-voiceover.mp4")
    output_webm = os.path.join(PROJECT_DIR, "ghostdocs-demo-with-voiceover.webm")
    desktop_mp4 = r"c:\Users\Milmann\Desktop\ghostdocs-demo-with-voiceover.mp4"
    desktop_webm = r"c:\Users\Milmann\Desktop\ghostdocs-demo-with-voiceover.webm"

    # Transcode MP4 with crisp H.264 video and clean single-track AAC audio
    cmd_mp4 = [
        FFMPEG, "-y",
        "-i", input_video,
        "-i", unified_wav,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        output_mp4
    ]
    subprocess.run(cmd_mp4, check=True)
    print(f"  Generated MP4: {output_mp4}")

    # Generate WebM with VP9 video and Opus audio
    cmd_webm = [
        FFMPEG, "-y",
        "-i", input_video,
        "-i", unified_wav,
        "-c:v", "copy",
        "-c:a", "libopus",
        "-b:a", "128k",
        "-shortest",
        output_webm
    ]
    subprocess.run(cmd_webm, check=True)
    print(f"  Generated WebM: {output_webm}")

    # Copy to Desktop
    import shutil
    shutil.copyfile(output_mp4, desktop_mp4)
    shutil.copyfile(output_webm, desktop_webm)
    print(f"  Copied clean MP4 and WebM to Desktop: {desktop_mp4}")

    print("\nALL DONE! Single crystal-clear voiceover with zero overlap.")

if __name__ == "__main__":
    asyncio.run(main())
