"""
main.py
=======
Entry point backend LensArthropoda menggunakan FastAPI.

Endpoints:
  GET  /          → health check
  GET  /health    → status komponen
  GET  /classes   → daftar kelas serangga
  POST /predict   → inferensi gambar + AI Insights Gemini

Fallback Mechanism (sesuai PDF):
  Jika Gemini gagal/limit, endpoint tetap mengembalikan
  hasil prediksi ML dengan pesan keterangan.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from gemini_service import GeminiService
from ml_service import MLService

# ──────────────────────────────────────────────────────────────── #
# Logging setup
# ──────────────────────────────────────────────────────────────── #
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  [%(levelname)s]  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("lensarthropoda")

# ──────────────────────────────────────────────────────────────── #
# Load .env
# ──────────────────────────────────────────────────────────────── #
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODEL_PATH     = os.getenv("MODEL_PATH",     "./artifacts/insect_model.pt")
METADATA_PATH  = os.getenv("METADATA_PATH",  "./artifacts/metadata.json")

# ──────────────────────────────────────────────────────────────── #
# Application state (singleton per process)
# ──────────────────────────────────────────────────────────────── #
_ml_service: Optional[MLService]      = None
_gemini_service: Optional[GeminiService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup dan shutdown aplikasi."""
    global _ml_service, _gemini_service

    # ── Startup ──────────────────────────────────────────────── #
    logger.info("=" * 55)
    logger.info("  🦋  LensArthropoda Backend — Starting Up")
    logger.info("=" * 55)

    # Load ML model
    try:
        _ml_service = MLService(MODEL_PATH, METADATA_PATH)
        logger.info("✅ ML Model berhasil dimuat (%d kelas)", len(_ml_service.class_names))
    except FileNotFoundError as e:
        logger.error("❌ ML Model tidak ditemukan: %s", e)
        logger.warning(
            "Backend tetap berjalan, tapi /predict akan mengembalikan error 503 "
            "sampai model tersedia."
        )

    # Load Gemini service
    if GEMINI_API_KEY and GEMINI_API_KEY != "your_gemini_api_key_here":
        try:
            _gemini_service = GeminiService(GEMINI_API_KEY)
            logger.info("✅ Gemini Service berhasil diinisialisasi")
        except Exception as e:
            logger.error("❌ Gemini inisialisasi gagal: %s", e)
    else:
        logger.warning(
            "⚠️  GEMINI_API_KEY belum diset. "
            "Salin env.example ke .env dan isi API key."
        )

    yield

    # ── Shutdown ─────────────────────────────────────────────── #
    logger.info("🛑 LensArthropoda Backend — Shutting Down")


# ──────────────────────────────────────────────────────────────── #
# FastAPI instance
# ──────────────────────────────────────────────────────────────── #
app = FastAPI(
    title="LensArthropoda API",
    description=(
        "REST API untuk identifikasi serangga otomatis menggunakan "
        "EfficientNet-B3 + Gemini 2.5 Flash Lite AI Insights."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — izinkan frontend Next.js (localhost:3000) mengakses backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────── #
# Pydantic schemas
# ──────────────────────────────────────────────────────────────── #
class TopPrediction(BaseModel):
    class_name:  str
    confidence:  float   # dalam persen (%)


class PredictionResponse(BaseModel):
    predicted_class:  str
    confidence:       float
    top_predictions:  List[TopPrediction]
    ai_insights:      Optional[str] = None   # Markdown dari Gemini
    ai_available:     bool = True
    message:          Optional[str] = None   # Pesan fallback jika Gemini gagal


# ──────────────────────────────────────────────────────────────── #
# Endpoints
# ──────────────────────────────────────────────────────────────── #

@app.get("/", tags=["Health"])
async def root():
    """Health check — cek apakah backend berjalan."""
    return {
        "status":         "running",
        "app":            "LensArthropoda API",
        "version":        "1.0.0",
        "ml_ready":       _ml_service is not None,
        "gemini_ready":   _gemini_service is not None,
    }


@app.get("/health", tags=["Health"])
async def health():
    """Status detail komponen backend."""
    return {
        "ml_service":     "ready" if _ml_service     else "unavailable",
        "gemini_service": "ready" if _gemini_service else "unavailable",
        "model_classes":  len(_ml_service.class_names) if _ml_service else 0,
    }


@app.get("/classes", tags=["Info"])
async def get_classes():
    """Daftar semua kelas serangga yang dapat diidentifikasi model."""
    if not _ml_service:
        raise HTTPException(
            status_code=503,
            detail="ML Model belum siap. Pastikan artifacts/insect_model.pt tersedia.",
        )
    return {
        "classes":     _ml_service.class_names,
        "num_classes": len(_ml_service.class_names),
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
async def predict(
    file: UploadFile = File(..., description="Gambar serangga (JPG/PNG/WebP, maks 10 MB)")
):
    """
    Identifikasi serangga dari gambar + AI Insights dari Gemini.

    **Fallback Mechanism:** Jika Gemini tidak tersedia (503/rate limit),
    hasil prediksi ML tetap dikembalikan dengan pesan keterangan.
    """

    # ── Validasi ML service ───────────────────────────────────── #
    if not _ml_service:
        raise HTTPException(
            status_code=503,
            detail=(
                "ML Model belum siap. "
                "Letakkan insect_model.pt dan metadata.json di backend/artifacts/ "
                "lalu restart server."
            ),
        )

    # ── Validasi file ─────────────────────────────────────────── #
    allowed_content_types = {
        "image/jpeg", "image/jpg", "image/png", "image/webp",
    }
    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Format file '{file.content_type}' tidak didukung. "
                "Gunakan JPG, PNG, atau WebP."
            ),
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="File gambar kosong.")

    max_size = 10 * 1024 * 1024  # 10 MB
    if len(image_bytes) > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"Ukuran file melebihi batas 10 MB ({len(image_bytes) / 1e6:.1f} MB).",
        )

    # ── Inferensi ML ─────────────────────────────────────────── #
    try:
        ml_result = _ml_service.predict(image_bytes, top_k=3)
    except Exception as exc:
        logger.error("Inferensi gagal: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Inferensi model gagal: {str(exc)}",
        )

    predicted_class = ml_result["predicted_class"]
    confidence      = ml_result["confidence"]
    top_predictions = [
        TopPrediction(class_name=p["class"], confidence=p["confidence"])
        for p in ml_result["top_predictions"]
    ]

    # ── Gemini AI Insights (dengan fallback) ─────────────────── #
    ai_insights  = None
    ai_available = True
    message      = None

    if _gemini_service:
        try:
            ai_insights = _gemini_service.get_insect_info(
                insect_name=predicted_class,
                confidence=confidence,
                use_google_search=False,  # Ganti True untuk aktifkan Google Search
            )
            if ai_insights is None:
                raise RuntimeError("Gemini mengembalikan None")

        except Exception as exc:
            # Fallback — sesuai FAQ poin 8 dan requirement PDF
            logger.warning("Gemini fallback diaktifkan: %s", exc)
            ai_available = False
            message = (
                "AI Insights sementara tidak tersedia (server Gemini sibuk/rate limit). "
                "Hasil identifikasi serangga tetap ditampilkan di atas."
            )
    else:
        ai_available = False
        message = (
            "Gemini API Key belum dikonfigurasi. "
            "Isi GEMINI_API_KEY di file .env untuk mengaktifkan AI Insights."
        )

    return PredictionResponse(
        predicted_class=predicted_class,
        confidence=confidence,
        top_predictions=top_predictions,
        ai_insights=ai_insights,
        ai_available=ai_available,
        message=message,
    )
