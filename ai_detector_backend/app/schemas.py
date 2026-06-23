"""
schemas.py
----------
Pydantic models defining the request/response shapes for the API.
Using explicit schemas gives auto-generated docs (Swagger UI) and
validates responses at runtime.

Note: auth (login/signup) schemas are not needed here since Supabase
handles authentication entirely on the frontend. This backend only
verifies Supabase-issued tokens (see app/auth.py).
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class ImagePredictionResponse(BaseModel):
    predicted_class: str = Field(..., example="fake")
    confidence: float = Field(..., example=0.9493)
    class_probabilities: Dict[str, float] = Field(
        ..., example={"fake": 0.9493, "real": 0.0507}
    )
    filename: str


class FrameResult(BaseModel):
    frame_index: int
    timestamp_seconds: float
    predicted_class: str
    confidence: float
    class_probabilities: Dict[str, float]


class VideoMetadata(BaseModel):
    total_frames: int
    fps: float
    width: int
    height: int
    duration_seconds: float


class VideoPredictionResponse(BaseModel):
    filename: str
    final_verdict: str = Field(..., example="fake")
    overall_confidence: float = Field(..., example=0.87)
    fake_frame_ratio: float = Field(
        ..., description="Fraction of analyzed frames classified as fake"
    )
    num_frames_analyzed: int
    video_metadata: VideoMetadata
    frame_results: List[FrameResult]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    classes: Optional[List[str]] = None
    validation_accuracy: Optional[float] = None
    device: str


class ErrorResponse(BaseModel):
    detail: str
