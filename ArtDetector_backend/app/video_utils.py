"""
video_utils.py
---------------
Extracts a fixed number of evenly-spaced frames from a video file
so the image classifier can be applied to each frame.
"""

import cv2
from PIL import Image
import logging
import os

logger = logging.getLogger("ai_detector.video_utils")


def extract_frames(video_path: str, num_frames: int = 16) -> list:
    """
    Extract `num_frames` evenly-spaced frames from a video file.

    Args:
        video_path: path to the video file on disk
        num_frames: how many frames to sample across the full video duration

    Returns:
        list of PIL.Image objects (RGB), in chronological order.
        May return fewer than num_frames if the video is very short.

    Raises:
        ValueError: if the video cannot be opened or has zero frames.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0

    if total_frames <= 0:
        cap.release()
        raise ValueError("Video appears to have zero frames or is corrupted.")

    logger.info(
        f"Video info: {video_path} | total_frames={total_frames} fps={fps:.2f} "
        f"duration={(total_frames / fps if fps else 0):.1f}s"
    )

    # Evenly space frame indices across the full video, avoiding the very
    # first/last frame (often black or transition frames)
    actual_num_frames = min(num_frames, total_frames)
    if actual_num_frames < num_frames:
        logger.warning(
            f"Video has only {total_frames} frames; requested {num_frames}, "
            f"using {actual_num_frames} instead."
        )

    frame_indices = [
        int(total_frames * (i + 0.5) / actual_num_frames)
        for i in range(actual_num_frames)
    ]

    frames = []
    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        success, frame_bgr = cap.read()
        if not success:
            logger.warning(f"Failed to read frame at index {idx}, skipping.")
            continue
        # OpenCV reads BGR; convert to RGB for PIL / torchvision compatibility
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        frames.append(Image.fromarray(frame_rgb))

    cap.release()

    if not frames:
        raise ValueError("No frames could be extracted from the video.")

    logger.info(f"Extracted {len(frames)} frames from video.")
    return frames


def get_video_metadata(video_path: str) -> dict:
    """Return basic metadata about a video file (duration, fps, resolution)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps else 0

    cap.release()

    return {
        "total_frames": total_frames,
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "duration_seconds": round(duration, 2),
    }
