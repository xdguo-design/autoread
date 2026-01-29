import os
import edge_tts
from moviepy import ImageClip, AudioFileClip
import asyncio
import wave

try:
    from moviepy import concatenate_videoclips
except Exception:
    concatenate_videoclips = None

try:
    from moviepy import ConcatenateVideoClip
except Exception:
    ConcatenateVideoClip = None

try:
    from moviepy import ColorClip
except Exception:
    ColorClip = None

class VideoGeneratorService:
    def __init__(self, storage_dir="storage"):
        self.storage_dir = storage_dir
        self.videos_dir = os.path.join(storage_dir, "videos")
        self.audio_dir = os.path.join(storage_dir, "temp")
        os.makedirs(self.videos_dir, exist_ok=True)
        os.makedirs(self.audio_dir, exist_ok=True)

    async def generate_video(self, text: str, images: list[str], screenshots: list[str], task_id: str, voice: str | None = None):
        try:
            if not voice:
                voice = "zh-CN-XiaoxiaoNeural" if any('\u4e00' <= ch <= '\u9fff' for ch in text) else "en-US-AriaNeural"
            
            audio_fallback = False
            audio_path = os.path.join(self.audio_dir, f"{task_id}.mp3")
            try:
                communicate = edge_tts.Communicate(text, voice)
                await communicate.save(audio_path)
            except Exception as e:
                print(f"TTS failed with voice {voice}: {e}")
                audio_fallback = True
                audio_path = os.path.join(self.audio_dir, f"{task_id}.wav")
                duration_sec = max(6.0, min(120.0, len(text) / 14.0))
                self._write_silence_wav(audio_path, duration_sec)
            
            # 2. Create Video using MoviePy
            # For simplicity, we'll just show the screenshots in a loop or sequence
            # matching the audio duration.
            
            # This part is synchronous CPU intensive, might block event loop.
            # In production, run in a separate process or thread.
            output_path = os.path.join(self.videos_dir, f"{task_id}.mp4")
            
            # Run moviepy logic in a separate thread/executor if possible, 
            # but for MVP direct call is okay if not heavy load.
            await asyncio.to_thread(self._create_moviepy_video, audio_path, images, screenshots, output_path)
            return {
                "video_path": output_path,
                "voice": voice,
                "audio_fallback": audio_fallback
            }
            
        except Exception as e:
            print(f"Video generation failed: {e}")
            raise e
    
    def get_available_voices(self):
        return [
            # Chinese Voices
            {"id": "zh-CN-XiaoxiaoNeural", "name": "晓晓 (女声)", "lang": "zh-CN"},
            {"id": "zh-CN-YunxiNeural", "name": "云希 (男声)", "lang": "zh-CN"},
            {"id": "zh-CN-YunjianNeural", "name": "云健 (男声)", "lang": "zh-CN"},
            {"id": "zh-CN-XiaoyiNeural", "name": "晓伊 (女声)", "lang": "zh-CN"},
            {"id": "zh-CN-liaoning-XiaobeiNeural", "name": "晓北 (东北话 - 辽宁)", "lang": "zh-CN"},
            {"id": "zh-TW-HsiaoChenNeural", "name": "晓臻 (女声 - 台湾)", "lang": "zh-TW"},
            {"id": "zh-HK-HiuMaanNeural", "name": "晓曼 (女声 - 香港)", "lang": "zh-HK"},
            # English Voices
            {"id": "en-US-AriaNeural", "name": "Aria (Female)", "lang": "en-US"},
            {"id": "en-US-GuyNeural", "name": "Guy (Male)", "lang": "en-US"},
            {"id": "en-US-JennyNeural", "name": "Jenny (Female)", "lang": "en-US"},
            {"id": "en-GB-SoniaNeural", "name": "Sonia (Female - UK)", "lang": "en-GB"},
            {"id": "en-AU-NatashaNeural", "name": "Natasha (Female - AU)", "lang": "en-AU"},
        ]

    async def generate_preview(self, voice: str, text: str = "你好，这是一段试听文本。"):
        preview_id = f"preview_{voice}"
        preview_path = os.path.join(self.audio_dir, f"{preview_id}.mp3")
        
        # Only generate if doesn't exist to save resources
        if not os.path.exists(preview_path):
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(preview_path)
            
        return preview_path

    def _write_silence_wav(self, audio_path: str, duration_sec: float, sample_rate: int = 22050):
        frames = int(duration_sec * sample_rate)
        with wave.open(audio_path, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(b"\x00\x00" * frames)

    def _create_moviepy_video(self, audio_path, images, screenshots, output_path):
        audio_clip = AudioFileClip(audio_path)
        duration = audio_clip.duration
        
        # Divide duration equally among screenshots
        visual_paths = images if images else screenshots
        if not visual_paths:
            if ColorClip is None:
                raise ValueError("No visuals provided")
            base = ColorClip(size=(1920, 1080), color=(15, 23, 42))
            base = self._set_duration(base, duration)
            final_video = self._set_audio(base, audio_clip)
            final_video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
            return
            
        clip_duration = duration / len(visual_paths)
        
        clips = []
        for img_path in visual_paths:
            clip = ImageClip(img_path)
            clip = self._resize(clip, height=1080)
            if clip.w < 1920:
                clip = self._resize(clip, width=1920)
            clip = self._crop(clip, width=1920, height=1080, x_center=clip.w / 2, y_center=clip.h / 2)
            clip = self._set_duration(clip, clip_duration)
            clips.append(clip)

        if ConcatenateVideoClip is not None:
            final_video = ConcatenateVideoClip(clips)
        elif concatenate_videoclips is not None:
            final_video = concatenate_videoclips(clips, method="compose")
        else:
            raise RuntimeError("No moviepy concatenation API available")

        final_video = self._set_audio(final_video, audio_clip)
        
        # Write file
        final_video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")

    def _resize(self, clip, **kwargs):
        if hasattr(clip, "resized"):
            return clip.resized(**kwargs)
        return clip.resize(**kwargs)

    def _crop(self, clip, **kwargs):
        if hasattr(clip, "cropped"):
            return clip.cropped(**kwargs)
        return clip.crop(**kwargs)

    def _set_duration(self, clip, duration: float):
        if hasattr(clip, "with_duration"):
            return clip.with_duration(duration)
        return clip.set_duration(duration)

    def _set_audio(self, video_clip, audio_clip):
        if hasattr(video_clip, "with_audio"):
            return video_clip.with_audio(audio_clip)
        return video_clip.set_audio(audio_clip)
