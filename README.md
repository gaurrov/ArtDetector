<div align="center">

# 🎨 ArtDetector

### AI-Powered Detection of AI-Generated Digital Artwork

Detect whether a digital artwork is created by a human artist or generated using AI.

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![React](https://img.shields.io/badge/React-TypeScript-61DAFB)
![PyTorch](https://img.shields.io/badge/PyTorch-DeepLearning-red)
![Supabase](https://img.shields.io/badge/Supabase-Authentication-success)

</div>

---

## Overview

The rapid advancement of generative AI has made it increasingly difficult to distinguish between human-created digital artwork and AI-generated art. ArtDetector is a full-stack web application that uses a deep learning model to analyze **digital artwork** and predict whether it was created by a human or generated using AI.

Unlike general AI image detectors, ArtDetector is designed specifically for **digital art**. The model has been trained on artwork datasets and is intended for paintings, illustrations, concept art, and other digitally created artistic content rather than real-world photographs.

Users can upload both **art images** and **art videos**, receive prediction probabilities, and view a history of previous analyses through a secure account.

---

## Features

- 🎨 Detect whether a digital artwork image is AI-generated
- 🎥 Analyze artwork videos by evaluating individual frames
- 📊 Prediction confidence scores
- 📈 Per-class probability breakdown
- 🔐 User authentication
- 🕒 Detection history
- ⚡ Fast inference through a FastAPI backend
- 📱 Responsive modern web interface

---

## Screenshots

### Login

<p align="center">
<img width="1918" height="905" alt="Screenshot 2026-07-01 185713" src="https://github.com/user-attachments/assets/e737e1b5-5453-434c-8564-4047c0c0fd50" />

</p>

---

### Dashboard

<p align="center">
<img width="1918" height="913" alt="Screenshot 2026-07-01 185811" src="https://github.com/user-attachments/assets/fe00d78d-dfe3-482e-ad27-7bb01024b030" />

</p>

---

### Detection Result

<p align="center">
<img width="1918" height="907" alt="Screenshot 2026-07-01 185901" src="https://github.com/user-attachments/assets/6d4b4fea-e38c-4229-9dba-8a45e26f39c5" />
<img width="1918" height="911" alt="Screenshot 2026-07-01 185932" src="https://github.com/user-attachments/assets/92ee4473-3ad1-4bf9-81e6-051bb792d486" />

</p>

---

### Detection History

<p align="center">
<img width="1918" height="911" alt="Screenshot 2026-07-01 190418" src="https://github.com/user-attachments/assets/14b75c3d-2429-461d-84c7-d4a8c0c46abb" />

</p>

---

## How It Works

### Image Detection

1. User uploads a digital artwork.
2. The backend preprocesses the image.
3. The trained PyTorch model performs inference.
4. The model predicts one of two classes:
   - Human-created Artwork
   - AI-generated Artwork
5. Confidence scores are returned to the frontend.
6. Results are saved in the user's history.

---

### Video Detection

For artwork videos, the application:

- extracts frames from the uploaded video
- performs inference on each frame
- aggregates the predictions
- returns a final verdict with confidence scores

---

## System Architecture

```
                  React + TypeScript
                          │
                          │ REST API
                          ▼
                    FastAPI Backend
                          │
          ┌───────────────┼───────────────┐
          │                               │
          ▼                               ▼
  Artwork Detection Model          User Authentication
      (PyTorch)                      (Supabase)
          │
          ▼
 Prediction & Confidence Scores
          │
          ▼
     Detection History
```

---

## Tech Stack

### Frontend

- React
- TypeScript
- Tailwind CSS
- Vite

### Backend

- FastAPI
- Python

### AI / Machine Learning

- PyTorch
- EfficientNet-B0
- Transfer Learning
- OpenCV
- Pillow

### Database & Authentication

- Supabase

---

## Model

The detection model is based on **EfficientNet-B0** using transfer learning.

The model classifies uploaded artwork into two categories:

| Class | Description |
|--------|-------------|
| Human Artwork | Artwork created by a human artist |
| AI Artwork | Artwork generated using AI |

Each prediction includes:

- Final verdict
- Confidence score
- Per-class probabilities

---

## Project Structure

```
ArtDetector

├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── public/
│
├── screenshots/
│
└── README.md
```

---

## Installation

Clone the repository

```bash
git clone https://github.com/gaurrov/ArtDetector.git
```

Backend

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload
```

Frontend

```bash
cd frontend

npm install

npm run dev
```

---

## Usage

1. Sign in to your account.
2. Select Image or Video detection.
3. Upload a piece of digital artwork.
4. Wait for the analysis.
5. Review the prediction, confidence score, and probability breakdown.
6. Access previous analyses through the History tab.

---

## Project Scope

### Supported

- Digital paintings
- Digital illustrations
- Concept art
- AI-generated artwork
- Artwork videos

### Not Intended For

- Real-world photographs
- Selfies
- Face detection
- Deepfake detection
- AI-generated text
- General image classification

---

## Future Improvements

- Grad-CAM visual explanations
- Support for additional AI art generation models
- Batch artwork analysis
- Public REST API
- Mobile application
- Docker deployment
- Model versioning

---

## Author

**Gaurrov Narayanan**

GitHub: https://github.com/gaurrov

LinkedIn: https://www.linkedin.com/in/gaurrovnarayanan/

---

## Acknowledgements

This project was developed to explore the application of deep learning in digital artwork authentication and to provide an accessible tool for identifying AI-generated art.

If you found this project interesting, consider giving it a ⭐.
