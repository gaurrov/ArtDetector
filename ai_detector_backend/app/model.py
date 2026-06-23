"""
model.py
--------
Loads the trained EfficientNet-B0 checkpoint and exposes a single
prediction function used by both the image and video endpoints.
"""

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import numpy as np
import io
import logging

logger = logging.getLogger("ai_detector.model")

# ── Config ────────────────────────────────────────────────────────────────────
CHECKPOINT_PATH = "models/ai_detector_best.pth"
IMG_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Preprocessing — must exactly match the eval_tf used during training
TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def build_model(num_classes: int = 2) -> nn.Module:
    """
    Recreate the exact EfficientNet-B0 architecture used during training.
    Must match the training notebook's build_model() structure so that
    state_dict keys line up when loading the checkpoint.
    """
    m = models.efficientnet_b0(weights=None)  # weights loaded from checkpoint, not ImageNet
    in_features = m.classifier[1].in_features
    m.classifier = nn.Sequential(nn.Dropout(0.5), nn.Linear(in_features, num_classes))
    return m


class AIDetector:
    """
    Wraps the trained model and exposes a simple predict(image) -> dict API.
    Loaded once at server startup and reused across all requests.
    """

    def __init__(self, checkpoint_path: str = CHECKPOINT_PATH):
        logger.info(f"Loading checkpoint from {checkpoint_path} on device={DEVICE}")
        checkpoint = torch.load(checkpoint_path, map_location=DEVICE)

        self.class_names = checkpoint["class_names"]          # e.g. ['fake', 'real']
        self.num_classes = len(self.class_names)
        self.validation_accuracy = checkpoint.get("validation_accuracy", None)

        self.model = build_model(self.num_classes).to(DEVICE)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

        logger.info(
            f"Model loaded. Classes={self.class_names} "
            f"val_acc={self.validation_accuracy}"
        )

    @torch.no_grad()
    def predict_pil(self, img: Image.Image) -> dict:
        """
        Run inference on a single PIL image.

        Returns:
            {
                "predicted_class": str,
                "confidence": float,
                "class_probabilities": {class_name: prob, ...}
            }
        """
        img = img.convert("RGB")
        tensor = TRANSFORM(img).unsqueeze(0).to(DEVICE)

        logits = self.model(tensor)
        probs = torch.softmax(logits, dim=1)[0].cpu()

        pred_idx = int(probs.argmax().item())
        pred_class = self.class_names[pred_idx]
        confidence = float(probs[pred_idx].item())
        class_probs = {
            self.class_names[i]: round(float(probs[i].item()), 4)
            for i in range(self.num_classes)
        }

        return {
            "predicted_class": pred_class,
            "confidence": round(confidence, 4),
            "class_probabilities": class_probs,
        }

    def predict_bytes(self, image_bytes: bytes) -> dict:
        """Convenience wrapper: raw image bytes -> prediction dict."""
        img = Image.open(io.BytesIO(image_bytes))
        return self.predict_pil(img)

    @torch.no_grad()
    def predict_batch(self, images: list) -> list:
        """
        Run inference on a batch of PIL images at once (used for video frames).
        Much faster than calling predict_pil() in a loop since it uses a
        single forward pass for the whole batch.

        Args:
            images: list of PIL.Image objects

        Returns:
            list of prediction dicts, same order as input
        """
        if not images:
            return []

        tensors = torch.stack([TRANSFORM(img.convert("RGB")) for img in images]).to(DEVICE)
        logits = self.model(tensors)
        probs = torch.softmax(logits, dim=1).cpu()

        results = []
        for i in range(len(images)):
            pred_idx = int(probs[i].argmax().item())
            pred_class = self.class_names[pred_idx]
            confidence = float(probs[i, pred_idx].item())
            class_probs = {
                self.class_names[c]: round(float(probs[i, c].item()), 4)
                for c in range(self.num_classes)
            }
            results.append({
                "predicted_class": pred_class,
                "confidence": round(confidence, 4),
                "class_probabilities": class_probs,
            })
        return results


# ── Singleton instance, loaded once when this module is imported ─────────────
_detector_instance: AIDetector | None = None


def get_detector() -> AIDetector:
    """Lazy-loaded singleton so the model is only loaded into memory once."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = AIDetector()
    return _detector_instance
