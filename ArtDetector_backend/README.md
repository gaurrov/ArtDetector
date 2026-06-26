# AI-Generated Image/Video Detector — Backend

FastAPI backend that classifies images and videos as **AI-generated (fake)** or **real**,
using a trained EfficientNet-B0 model. For videos, it extracts evenly-spaced frames
and runs the same image classifier on each one, then aggregates the results.

**Auth model:** Authentication (signup/login) and detection history are handled
entirely by **Supabase** on the frontend. This backend does **not** store users
or passwords — it only verifies the Supabase-issued JWT on each request to
confirm the caller is logged in before running model inference.

---

## Project structure

```
ai_detector_backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app + /predict/image, /predict/video
│   ├── model.py          # Model loading + inference logic
│   ├── video_utils.py    # Video frame extraction (OpenCV)
│   ├── schemas.py        # Pydantic request/response models
│   └── auth.py            # Verifies Supabase JWTs (does not issue tokens)
├── models/
│   └── ai_detector_best.pth   # <-- put your trained checkpoint here
├── uploads/                    # (optional) temp storage, not required
├── requirements.txt
└── README.md
```

---

## Setup

### 1. Install dependencies

It's recommended to use a virtual environment:

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

> **Note on PyTorch + GPU:** the `requirements.txt` installs the CPU build of
> PyTorch by default via pip. If you have an NVIDIA GPU and want CUDA
> acceleration, install PyTorch separately first using the command from
> https://pytorch.org/get-started/locally/ that matches your CUDA version,
> then run `pip install -r requirements.txt` (it will skip torch/torchvision
> if already satisfied, but to be safe, install torch first).

### 2. Add your trained model

Copy your `ai_detector_best.pth` (downloaded from Kaggle) into the `models/` folder:

```
ai_detector_backend/models/ai_detector_best.pth
```

The checkpoint must contain these keys (this matches what the training notebook saves):
- `model_state_dict`
- `class_names`
- `validation_accuracy` (optional, just used for the `/health` endpoint)

### 3. Set your Supabase JWT secret

This backend verifies tokens that Supabase already issued — it needs your
project's JWT secret to do that. Find it at:

**Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret**

Set it as an environment variable before starting the server:

```bash
export SUPABASE_JWT_SECRET="paste-your-supabase-jwt-secret-here"     # Windows: set SUPABASE_JWT_SECRET=...
```

If you skip this, the server will still start but will log a warning and
reject all `/predict` requests with a 500 error until it's set.

### 4. Run the server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You'll see a log line like:
```
Model loaded. Classes=['fake', 'real'] val_acc=0.9073
```

### 5. Try it out

Open the interactive API docs in your browser:
```
http://localhost:8000/docs
```

To test `/predict` endpoints from Swagger UI or `curl`, you need a real
Supabase access token — get one from your frontend after logging in
(`supabase.auth.getSession()` returns it), or from Supabase's own API directly.

```bash
# Health check (no auth needed)
curl http://localhost:8000/health

# Predict an image (requires a Supabase access token)
curl -X POST http://localhost:8000/predict/image \
  -H "Authorization: Bearer <supabase-access-token>" \
  -F "file=@/path/to/image.jpg"

# Predict a video (same auth header)
curl -X POST http://localhost:8000/predict/video \
  -H "Authorization: Bearer <supabase-access-token>" \
  -F "file=@/path/to/video.mp4"
```

---

## API Reference

### Authentication

### Authentication

This backend doesn't expose `/auth/*` endpoints — sign up, log in, and
session management all happen via Supabase directly on the frontend
(`@supabase/supabase-js`). Once logged in, the frontend gets a Supabase
access token and attaches it as a Bearer header to every `/predict` call.

---

### Detection (requires a valid Supabase session)

Both endpoints below require a valid `Authorization: Bearer <supabase-access-token>`
header. Requests without a valid token return `401 Unauthorized`.

### `GET /health`

Returns model status and metadata. **Not** protected — useful for uptime checks.

```json
{
  "status": "ok",
  "model_loaded": true,
  "classes": ["fake", "real"],
  "validation_accuracy": 0.9073,
  "device": "cuda:0"
}
```

### `POST /predict/image`

**Form data:** `file` — an image file (jpg, png, webp, bmp), max 15 MB.

**Response:**
```json
{
  "predicted_class": "fake",
  "confidence": 0.9493,
  "class_probabilities": {"fake": 0.9493, "real": 0.0507},
  "filename": "photo.jpg"
}
```

### `POST /predict/video`

**Form data:** `file` — a video file (mp4, mov, avi, webm, mkv), max 200 MB.

The video is split into **16 evenly-spaced frames** across its full duration.
Each frame is classified independently, then a final verdict is computed:
- If **≥50% of frames** are classified `fake`, the video's `final_verdict` is `fake`.
- `overall_confidence` is the average confidence of the frames that agree with the final verdict.

**Response:**
```json
{
  "filename": "clip.mp4",
  "final_verdict": "fake",
  "overall_confidence": 0.87,
  "fake_frame_ratio": 0.75,
  "num_frames_analyzed": 16,
  "video_metadata": {
    "total_frames": 480,
    "fps": 30.0,
    "width": 1920,
    "height": 1080,
    "duration_seconds": 16.0
  },
  "frame_results": [
    {
      "frame_index": 0,
      "timestamp_seconds": 0.5,
      "predicted_class": "fake",
      "confidence": 0.91,
      "class_probabilities": {"fake": 0.91, "real": 0.09}
    }
    // ... 15 more frames
  ]
}
```

---

## Configuration

Key settings are at the top of `app/main.py`:

| Variable | Default | Description |
|---|---|---|
| `NUM_VIDEO_FRAMES` | `16` | Number of evenly-spaced frames sampled per video |
| `FAKE_VOTE_THRESHOLD` | `0.5` | Fraction of fake frames needed to call the whole video fake |
| `MAX_IMAGE_SIZE_MB` | `15` | Max upload size for images |
| `MAX_VIDEO_SIZE_MB` | `200` | Max upload size for videos |

Model/preprocessing settings are in `app/model.py` (`IMG_SIZE`, `MEAN`, `STD`) —
these must match what was used during training and should not be changed
unless you retrain with different values.

---

## Notes on accuracy for video detection

This approach treats each frame independently using an image classifier — it does
**not** use temporal/motion information between frames. This is a reasonable and
common baseline approach, but be aware of its limitations:

- A video with only a few AI-generated frames mixed into real footage may be
  misclassified depending on the vote threshold.
- For higher accuracy on video specifically, a dedicated video classification
  model (e.g., using 3D CNNs or temporal transformers) would outperform this
  frame-sampling approach, but requires a different training pipeline.

You can tune `NUM_VIDEO_FRAMES` and `FAKE_VOTE_THRESHOLD` to adjust the
sensitivity/specificity tradeoff for your use case.

---

## Connecting a frontend

After login, store the `access_token` (e.g. in memory or `sessionStorage` —
avoid `localStorage` for tokens if you can, to reduce XSS risk) and attach it
to every `/predict/*` request:

```javascript
// Login
const loginRes = await fetch('http://localhost:8000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
const { access_token } = await loginRes.json();

// Predict (image or video) — same pattern, just add the header
const formData = new FormData();
formData.append('file', file);

const predictRes = await fetch('http://localhost:8000/predict/image', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${access_token}` },
  body: formData,
});
const result = await predictRes.json();
```

If a request returns `401`, the token is missing, invalid, or expired —
redirect the user back to the login screen.

---

## Production considerations

This setup is intended for **local/personal server use** as configured. Before
deploying publicly, consider:
- Restricting `allow_origins` in the CORS middleware (`app/main.py`) to your actual frontend domain instead of `"*"`
- Adding authentication/rate-limiting (e.g. via API keys or a gateway)
- Running behind a process manager (e.g. `gunicorn` with `uvicorn` workers, or a container orchestrator)
- Using a proper object store instead of temp files for video uploads at scale
