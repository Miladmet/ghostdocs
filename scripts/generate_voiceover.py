import asyncio
import os
import subprocess
import imageio_ffmpeg
import edge_tts

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
VOICE = "en-US-ChristopherNeural"
PROJECT_DIR = r"c:\Users\Milmann\Documents\GhostDocs"
TEMP_DIR = os.path.join(PROJECT_DIR, "voiceover_temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# Timed script lines matching the 62.6s video
SEGMENTS = [
    {
        "start": 0.5,
        "text": "Organizations often lose critical institutional memory when projects end. Meet GhostDocs: a browser-local AI Crew that resurrects forgotten documents with zero network leakage.",
    },
    {
        "start": 8.0,
        "text": "When we drop Markdown and text files into the vault, Web Workers parse, chunk, and embed them locally without blocking the UI.",
    },
    {
        "start": 16.5,
        "text": "Immediately, The Archivist catalogs structural metadata and summaries, while The Historian reconstructs a unified chronological timeline.",
    },
    {
        "start": 24.5,
        "text": "Notice how The Historian automatically detects implicit dates and flags temporal ambiguities with explicit confidence scores.",
    },
    {
        "start": 32.5,
        "text": "Now we ask: 'What was the Q3 budget allocation?' The Researcher uses client-side vector search to synthesize an exact answer with clickable, verbatim citations.",
    },
    {
        "start": 44.0,
        "text": "A second query instantly retrieves the ratified security constitution date: September 14, 2024. Zero hallucination, zero cloud transmission.",
    },
    {
        "start": 52.5,
        "text": "Finally, we seal our entire vault into a portable Time Capsule JSON file that can be restored offline anywhere. GhostDocs: bringing dead organizational memory back to life.",
    },
]

async def generate_speech():
    print("[1/4] Generating speech segments via edge-tts...")
    audio_files = []
    for i, seg in enumerate(SEGMENTS):
        out_path = os.path.join(TEMP_DIR, f"seg_{i}.mp3")
        tts = edge_tts.Communicate(seg["text"], VOICE, rate="+5%")
        await tts.save(out_path)
        audio_files.append((seg["start"], out_path))
        print(f"  Segment {i+1}/{len(SEGMENTS)} generated ({seg['start']}s)")
    return audio_files

def mux_audio_and_video(audio_files):
    print("[2/4] Mixing audio segments into timeline with FFmpeg...")
    
    # Build FFmpeg complex filter to delay and mix all audio tracks
    # Each input is delayed by its start time in milliseconds using adelay filter
    inputs = []
    filter_parts = []
    for i, (start_sec, path) in enumerate(audio_files):
        inputs.extend(["-i", path])
        delay_ms = int(start_sec * 1000)
        filter_parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms}[a{i}]")
    
    mix_inputs = "".join(f"[a{i}]" for i in range(len(audio_files)))
    filter_complex = f"{';'.join(filter_parts)};{mix_inputs}amix=inputs={len(audio_files)}:normalize=0[aout]"
    
    mixed_audio = os.path.join(TEMP_DIR, "full_voiceover.wav")
    cmd_mix = [
        FFMPEG, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[aout]",
        "-t", "62.6",
        mixed_audio
    ]
    subprocess.run(cmd_mix, check=True)
    print(f"  Unified voiceover audio created: {mixed_audio}")

    # Step 3: Combine with ghostdocs-demo-walkthrough.webm
    input_video = os.path.join(PROJECT_DIR, "ghostdocs-demo-walkthrough.webm")
    output_webm = os.path.join(PROJECT_DIR, "ghostdocs-demo-with-voiceover.webm")
    output_mp4 = os.path.join(PROJECT_DIR, "ghostdocs-demo-with-voiceover.mp4")
    desktop_mp4 = r"c:\Users\Milmann\Desktop\ghostdocs-demo-with-voiceover.mp4"
    desktop_webm = r"c:\Users\Milmann\Desktop\ghostdocs-demo-with-voiceover.webm"

    print("[3/4] Muxing audio into WebM video...")
    cmd_webm = [
        FFMPEG, "-y",
        "-i", input_video,
        "-i", mixed_audio,
        "-c:v", "copy",
        "-c:a", "libopus",
        "-b:a", "128k",
        "-shortest",
        output_webm
    ]
    subprocess.run(cmd_webm, check=True)
    print(f"  Saved WebM: {output_webm}")

    print("[4/4] Transcoding to universal MP4 (H.264/AAC)...")
    cmd_mp4 = [
        FFMPEG, "-y",
        "-i", input_video,
        "-i", mixed_audio,
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
    print(f"  Saved MP4: {output_mp4}")

    # Copy to Desktop for immediate access
    import shutil
    shutil.copyfile(output_mp4, desktop_mp4)
    shutil.copyfile(output_webm, desktop_webm)
    print(f"  Copied both files to Desktop: {desktop_mp4}")

async def main():
    audio_files = await generate_speech()
    mux_audio_and_video(audio_files)
    print("\nDONE! Demo video with professional voiceover successfully generated.")

if __name__ == "__main__":
    asyncio.run(main())
