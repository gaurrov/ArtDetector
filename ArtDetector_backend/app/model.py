"""
model.py
--------
Loads the trained EfficientNet-B0 checkpoint and exposes a single
prediction function used by both the image and video endpoints.

Note on class threshold:
    The model was trained on a balanced dataset but shows a slight bias
    toward predicting 'fake'. A confidence threshold of 0.60 means we
    only classify as 'fake' if fake probability >= 60%, otherwise 'real'.
    Adjust FAKE_THRESHOLD to tune sensitivity vs specificity.
"""

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import io
import logging

logger = logging.getLogger("ai_detector.model")

CHECKPOINT_PATH = "models/ai_detector_best.pth"
IMG_SIZE        = 224
MEAN            = [0.485, 0.456, 0.406]
STD             = [0.229, 0.224, 0.225]

# Only classify as FAKE if the fake probability exceeds this threshold.
# Raise this value (e.g. 0.65) to reduce false positives on real images.
FAKE_THRESHOLD  = 0.55

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

TRANSFORM = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(MEAN, STD),
])


def build_model(num_classes: int = 2) -> nn.Module:
    m = models.efficientnet_b0(weights=None)
    in_features = m.classifier[1].in_features
    # Dropout value doesn't affect inference (model.eval() disables it)
    m.classifier = nn.Sequential(nn.Dropout(0.5), nn.Linear(in_features, num_classes))
    return m


def _apply_threshold(class_names: list, probs: list[float]) -> tuple[str, float]:
    """
    Apply a confidence threshold to reduce fake bias.
    Only predict 'fake' if fake_prob >= FAKE_THRESHOLD, else predict 'real'.
    Returns (predicted_class, confidence).
    """
    # Find indices for fake and real labels
    fake_idx = next((i for i, c in enumerate(class_names) if c.lower() in ('fake', 'ai', 'generated')), 0)
    real_idx = next((i for i, c in enumerate(class_names) if c.lower() in ('real', 'authentic')), 1)

    fake_prob = probs[fake_idx]
    real_prob = probs[real_idx]

    if fake_prob >= FAKE_THRESHOLD:
        return class_names[fake_idx], fake_prob
    else:
        return class_names[real_idx], real_prob


class AIDetector:
    def __init__(self, checkpoint_path: str = CHECKPOINT_PATH):
        logger.info(f"Loading checkpoint from {checkpoint_path} on device={DEVICE}")
        checkpoint = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)

        self.class_names       = checkpoint["class_names"]
        self.num_classes       = len(self.class_names)
        self.validation_accuracy = checkpoint.get("validation_accuracy")

        self.model = build_model(self.num_classes).to(DEVICE)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

        logger.info(
            f"Model loaded. Classes={self.class_names} "
            f"val_acc={self.validation_accuracy} "
            f"fake_threshold={FAKE_THRESHOLD}"
        )

    @torch.no_grad()
    def predict_pil(self, img: Image.Image) -> dict:
        img    = img.convert("RGB")
        tensor = TRANSFORM(img).unsqueeze(0).to(DEVICE)
        logits = self.model(tensor)
        probs  = torch.softmax(logits, dim=1)[0].cpu().tolist()

        pred_class, confidence = _apply_threshold(self.class_names, probs)
        class_probs = {
            self.class_names[i]: round(probs[i], 4)
            for i in range(self.num_classes)
        }

        logger.debug(
            f"Raw probs: {dict(zip(self.class_names, [round(p,3) for p in probs]))} "
            f"-> {pred_class} ({confidence:.2%})"
        )

        return {
            "predicted_class"     : pred_class,
            "confidence"          : round(confidence, 4),
            "class_probabilities" : class_probs,
        }

    def predict_bytes(self, image_bytes: bytes) -> dict:
        img = Image.open(io.BytesIO(image_bytes))
        return self.predict_pil(img)

    @torch.no_grad()
    def predict_batch(self, images: list) -> list:
        if not images:
            return []

        tensors = torch.stack([TRANSFORM(img.convert("RGB")) for img in images]).to(DEVICE)
        logits  = self.model(tensors)
        probs_t = torch.softmax(logits, dim=1).cpu()

        results = []
        for i in range(len(images)):
            probs = probs_t[i].tolist()
            pred_class, confidence = _apply_threshold(self.class_names, probs)
            class_probs = {
                self.class_names[c]: round(probs[c], 4)
                for c in range(self.num_classes)
            }
            results.append({
                "predicted_class"     : pred_class,
                "confidence"          : round(confidence, 4),
                "class_probabilities" : class_probs,
            })
        return results


_detector_instance: AIDetector | None = None


def get_detector() -> AIDetector:
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = AIDetector()
    return _detector_instance