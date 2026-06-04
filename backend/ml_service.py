"""
ml_service.py
=============
Kelas MLService: memuat model TorchScript hasil training
dan melakukan inferensi gambar serangga.

Alur inference:
  bytes → PIL Image → Normalize (ImageNet) → Tensor → Model → Softmax → Top-K
"""

import io
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

logger = logging.getLogger(__name__)


class MLService:
    """
    Mengelola loading model TorchScript dan pipeline inferensi.
    Model selalu dimuat ke CPU agar kompatibel di semua mesin (FAQ poin 3).
    """

    def __init__(self, model_path: str, metadata_path: str) -> None:
        # Selalu gunakan CPU — aman untuk deployment lokal tanpa GPU
        self.device = torch.device("cpu")
        self.model  = None
        self.class_names: List[str] = []
        self.img_size: int           = 224
        self.mean: List[float]       = [0.485, 0.456, 0.406]
        self.std: List[float]        = [0.229, 0.224, 0.225]
        self.transform               = None

        self._load_metadata(metadata_path)
        self._load_model(model_path)
        self._build_transform()

        logger.info(
            "MLService siap | kelas=%d | device=%s | img_size=%d",
            len(self.class_names), self.device, self.img_size,
        )

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _load_metadata(self, path: str) -> None:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(
                f"Metadata tidak ditemukan: {path}\n"
                "Pastikan file metadata.json ada di backend/artifacts/"
            )
        with open(p) as f:
            meta = json.load(f)

        self.class_names = meta["class_names"]
        self.img_size    = int(meta.get("img_size", 224))
        self.mean        = meta.get("imagenet_mean", [0.485, 0.456, 0.406])
        self.std         = meta.get("imagenet_std",  [0.229, 0.224, 0.225])
        logger.info("Metadata dimuat: %d kelas", len(self.class_names))

    def _load_model(self, path: str) -> None:
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(
                f"Model tidak ditemukan: {path}\n"
                "Pastikan insect_model.pt ada di backend/artifacts/"
            )
        # map_location='cpu' wajib agar tidak error di mesin tanpa GPU (FAQ poin 3)
        self.model = torch.jit.load(str(p), map_location=self.device)
        self.model.eval()
        logger.info("Model TorchScript dimuat dari: %s", path)

    def _build_transform(self) -> None:
        """Transform identik dengan val_transform saat training (tanpa augmentasi)."""
        self.transform = transforms.Compose([
            transforms.Resize((self.img_size, self.img_size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=self.mean, std=self.std),
        ])

    def _bytes_to_tensor(self, image_bytes: bytes) -> torch.Tensor:
        """Konversi raw bytes gambar → tensor (1, C, H, W) siap inferensi."""
        image  = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(image)   # (C, H, W)
        return tensor.unsqueeze(0)       # (1, C, H, W)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def predict(self, image_bytes: bytes, top_k: int = 3) -> Dict[str, Any]:
        """
        Lakukan inferensi pada gambar.

        Parameters
        ----------
        image_bytes : bytes — Raw bytes gambar
        top_k       : int   — Jumlah prediksi teratas

        Returns
        -------
        {
            "predicted_class": str,
            "confidence"     : float,   # dalam persen
            "top_predictions": [
                {"class": str, "confidence": float},
                ...
            ]
        }
        """
        tensor = self._bytes_to_tensor(image_bytes).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)                        # (1, num_classes)
            probs  = torch.softmax(logits, dim=1)[0]           # (num_classes,)

        k = min(top_k, len(self.class_names))
        top_probs, top_idx = torch.topk(probs, k)

        top_predictions = [
            {
                "class":      self.class_names[idx.item()],
                "confidence": round(prob.item() * 100, 2),
            }
            for prob, idx in zip(top_probs, top_idx)
        ]

        return {
            "predicted_class": top_predictions[0]["class"],
            "confidence":      top_predictions[0]["confidence"],
            "top_predictions": top_predictions,
        }
