"""
main.py
-------
FastAPI backend for AI-Generated vs Real detection.

Endpoints:
    GET  /health              - health check + model info
    POST /predict/image       - classify a single image
    POST /predict/video       - classify a video by sampling frames

Run locally with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Then visit http://localhost:8000/docs for interactive Swagger UI.
"""

import logging
import mimetypes
import os
import tempfile
import time
from collections import Counter

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFile
import io

from app.model import get_detector
from app.video_utils import extract_frames, get_video_metadata
from app.schemas import (
    ImagePredictionResponse,
    VideoPredictionResponse,
    FrameResult,
    VideoMetadata,
    HealthResponse,
)
from app.auth import get_current_user, SupabaseUser

# Avoid crashes on slightly corrupted / truncated images, same as training
ImageFile.LOAD_TRUNCATED_IMAGES = True
Image.MAX_IMAGE_PIXELS = None

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("ai_detector.main")

# ── Config ────────────────────────────────────────────────────────────────────
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/bmp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/x-matroska"}
MAX_IMAGE_SIZE_MB = 15
MAX_VIDEO_SIZE_MB = 200
NUM_VIDEO_FRAMES = 16  # fixed number of evenly-spaced frames sampled per video
FAKE_VOTE_THRESHOLD = 0.5  # if >50% of frames are "fake", verdict is fake

app = FastAPI(
    title="AI-Generated vs Real Image/Video Detector",
    description="Detects whether an image, or the frames of a video, are AI-generated or real.",
    version="1.0.0",
)

# CORS — adjust allow_origins for your actual frontend domain in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_model_on_startup():
    """Load the model once when the server starts, not on every request."""
    logger.info("Starting up — loading model...")
    get_detector()
    logger.info("Model loaded and ready to serve requests.")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
def health_check():
    try:
        detector = get_detector()
        return HealthResponse(
            status="ok",
            model_loaded=True,
            classes=detector.class_names,
            validation_accuracy=detector.validation_accuracy,
            device=str(detector.model.parameters().__next__().device),
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(status="error", model_loaded=False, device="unknown")


# ── Image prediction ──────────────────────────────────────────────────────────
@app.post("/predict/image", response_model=ImagePredictionResponse)
async def predict_image(
    file: UploadFile = File(...),
    current_user: SupabaseUser = Depends(get_current_user),
):
    """
    Classify a single uploaded image as 'fake' (AI-generated) or 'real'.
    Requires a valid Supabase access token (Authorization: Bearer <token>).
    """
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type or 'unknown'}'. "
                   f"Allowed: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    raw_bytes = await file.read()
    size_mb = len(raw_bytes) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large ({size_mb:.1f} MB). Max allowed: {MAX_IMAGE_SIZE_MB} MB.",
        )

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        img.verify()  # quick integrity check
        img = Image.open(io.BytesIO(raw_bytes))  # reopen after verify() invalidates the handle
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image file. It may be corrupted.")

    detector = get_detector()
    start = time.time()
    result = detector.predict_pil(img)
    elapsed = time.time() - start

    logger.info(
        f"Image prediction by user='{current_user.email or current_user.id}': {file.filename} -> "
        f"{result['predicted_class']} ({result['confidence']:.2%}) in {elapsed*1000:.0f}ms"
    )

    return ImagePredictionResponse(**result, filename=file.filename)


# ── Video prediction ──────────────────────────────────────────────────────────
@app.post("/predict/video", response_model=VideoPredictionResponse)
async def predict_video(
    file: UploadFile = File(...),
    current_user: SupabaseUser = Depends(get_current_user),
):
    """
    Classify a video as 'fake' or 'real' by:
      1. Sampling NUM_VIDEO_FRAMES evenly-spaced frames from the video
      2. Running the image classifier on each frame
      3. Aggregating frame-level predictions into a final verdict
         (majority vote weighted by average confidence)

    Requires a valid Supabase access token (Authorization: Bearer <token>).
    """
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{content_type or 'unknown'}'. "
                   f"Allowed: {', '.join(ALLOWED_VIDEO_TYPES)}",
        )

    raw_bytes = await file.read()
    size_mb = len(raw_bytes) / (1024 * 1024)
    if size_mb > MAX_VIDEO_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Video too large ({size_mb:.1f} MB). Max allowed: {MAX_VIDEO_SIZE_MB} MB.",
        )

    # Videos must be read from disk by OpenCV, so write to a temp file first
    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        metadata = get_video_metadata(tmp_path)
        frames = extract_frames(tmp_path, num_frames=NUM_VIDEO_FRAMES)

        if metadata["fps"] > 0:
            frame_timestamps = [
                round((metadata["total_frames"] * (i + 0.5) / len(frames)) / metadata["fps"], 2)
                for i in range(len(frames))
            ]
        else:
            frame_timestamps = [0.0] * len(frames)

        detector = get_detector()
        start = time.time()
        frame_predictions = detector.predict_batch(frames)
        elapsed = time.time() - start

        frame_results = [
            FrameResult(
                frame_index=i,
                timestamp_seconds=frame_timestamps[i],
                predicted_class=pred["predicted_class"],
                confidence=pred["confidence"],
                class_probabilities=pred["class_probabilities"],
            )
            for i, pred in enumerate(frame_predictions)
        ]

        # ── Aggregate frame-level results into a final video verdict ──────────
        class_votes = Counter(p["predicted_class"] for p in frame_predictions)
        fake_label = _resolve_fake_label(detector.class_names)
        fake_count = class_votes.get(fake_label, 0)
        fake_ratio = fake_count / len(frame_predictions)

        final_verdict = fake_label if fake_ratio >= FAKE_VOTE_THRESHOLD else _other_label(
            detector.class_names, fake_label
        )

        # Overall confidence = average confidence of frames that agree with the final verdict
        agreeing_confidences = [
            p["confidence"] for p in frame_predictions if p["predicted_class"] == final_verdict
        ]
        overall_confidence = (
            sum(agreeing_confidences) / len(agreeing_confidences) if agreeing_confidences else 0.0
        )

        logger.info(
            f"Video prediction by user='{current_user.email or current_user.id}': {file.filename} -> "
            f"{final_verdict} (fake_ratio={fake_ratio:.2f}, {len(frames)} frames) in {elapsed:.1f}s"
        )

        return VideoPredictionResponse(
            filename=file.filename,
            final_verdict=final_verdict,
            overall_confidence=round(overall_confidence, 4),
            fake_frame_ratio=round(fake_ratio, 4),
            num_frames_analyzed=len(frame_predictions),
            video_metadata=VideoMetadata(**metadata),
            frame_results=frame_results,
        )

    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # Always clean up the temp file, even if an error occurred
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _resolve_fake_label(class_names: list) -> str:
    """Find the label representing the 'AI-generated' class, case-insensitively."""
    for name in class_names:
        if name.lower() in ("fake", "ai", "ai-generated", "generated"):
            return name
    # Fallback: assume index 0 (matches the training notebook's convention)
    return class_names[0]


def _other_label(class_names: list, exclude: str) -> str:
    for name in class_names:
        if name != exclude:
            return name
    return class_names[0]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
