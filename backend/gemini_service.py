"""
gemini_service.py
=================
Integrasi Google Gemini 2.5 Flash Lite dengan fitur:
  - ThinkingConfig  : model berpikir lebih mendalam sebelum menjawab
  - GoogleSearch    : grounding dengan hasil pencarian web (opsional)
  - Fallback        : mengembalikan None jika API gagal/limit (503)

Sesuai instruksi PDF Bagian B — Tahap Pengembangan Backend.

Model ID: gemini-2.5-flash-lite (stable, Juni 2026)
"""

import logging
from typing import Optional

import google.generativeai as genai
from google.generativeai.types import GenerationConfig

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────── #
# System prompt entomologis                                            #
# ──────────────────────────────────────────────────────────────────── #
_SYSTEM_PROMPT = """Kamu adalah seorang entomologis (ahli serangga) berpengalaman 
yang bertugas memberikan informasi ilmiah, akurat, dan menarik tentang serangga.

Selalu jawab dalam **Bahasa Indonesia** dengan format Markdown yang rapi.

Struktur jawaban WAJIB mengikuti format berikut:

## Nama Ilmiah
[nama ilmiah lengkap]

## Nama Umum
[nama umum dalam Bahasa Indonesia dan Inggris]

## Klasifikasi Taksonomi
- **Ordo:** ...
- **Famili:** ...
- **Genus:** ...
- **Spesies Umum:** [daftar 2-3 spesies yang paling dikenal]

## Habitat & Persebaran
[deskripsi habitat dan sebaran geografis]

## Karakteristik Fisik
[ciri-ciri fisik utama]

## Perilaku & Ekologi
[perilaku, siklus hidup, peran ekologis]

## Fun Facts 🎉
- [fakta unik 1]
- [fakta unik 2]
- [fakta unik 3]

---
*Catatan: Jika nama serangga kurang spesifik, berikan informasi berdasarkan genus atau famili yang paling mungkin.*
"""


class GeminiService:
    """
    Wrapper Gemini 2.5 Flash Lite untuk menghasilkan AI Insights serangga.

    ThinkingConfig diaktifkan agar model reasoning lebih mendalam
    sebelum menghasilkan jawaban (sesuai requirement PDF).
    """

    # Model ID Gemini 2.5 Flash Lite (sesuai PDF)
    MODEL_ID = "gemini-2.5-flash-lite"

    def __init__(self, api_key: str) -> None:
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError(
                "GEMINI_API_KEY tidak valid. "
                "Dapatkan key gratis di https://aistudio.google.com/app/apikey"
            )
        genai.configure(api_key=api_key)

        # Inisialisasi model dengan system instruction
        self._model = genai.GenerativeModel(
            model_name=self.MODEL_ID,
            system_instruction=_SYSTEM_PROMPT,
        )
        logger.info("GeminiService siap | model=%s", self.MODEL_ID)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def get_insect_info(
        self,
        insect_name: str,
        confidence: float,
        use_google_search: bool = False,
    ) -> Optional[str]:
        """
        Dapatkan informasi lengkap serangga dari Gemini AI.

        Parameters
        ----------
        insect_name       : Nama serangga dari prediksi model ML
        confidence        : Confidence score (%)
        use_google_search : Aktifkan grounding Google Search (opsional)

        Returns
        -------
        str  — Teks Markdown berisi informasi serangga
        None — Jika API gagal / rate limit (Fallback mechanism)
        """
        prompt = self._build_prompt(insect_name, confidence)

        # ThinkingConfig — aktifkan reasoning via thinking_budget
        # (sesuai requirement PDF: ThinkingConfig)
        # thinking_budget=-1  → model tentukan sendiri berapa lama berpikir
        generation_config = GenerationConfig(
            temperature=1.0,       # Gemini 2.5 rekomendasikan temperature=1.0
            max_output_tokens=4096,
        )

        # Thinking config — dipass sebagai dict karena google-generativeai < 0.9
        thinking_config = {"thinking_budget": 1024}  # 1024 token untuk reasoning

        # Tools (Google Search grounding — opsional sesuai PDF)
        tools = []
        if use_google_search:
            tools = [{"google_search": {}}]
            logger.info("Google Search grounding diaktifkan")

        try:
            # Coba dengan thinking_config dulu, fallback tanpa jika error
            try:
                if tools:
                    response = self._model.generate_content(
                        contents=prompt,
                        generation_config=generation_config,
                        tools=tools,
                    )
                else:
                    response = self._model.generate_content(
                        contents=prompt,
                        generation_config=generation_config,
                        thinking_config=thinking_config,
                    )
            except TypeError:
                # SDK lama tidak support thinking_config parameter → fallback
                logger.info("thinking_config tidak didukung SDK ini, menggunakan mode standar")
                response = self._model.generate_content(
                    contents=prompt,
                    generation_config=generation_config,
                )

            result = response.text
            logger.info(
                "Gemini OK | serangga=%s | panjang=%d karakter",
                insect_name, len(result)
            )
            return result

        except Exception as exc:
            # Fallback: log error, kembalikan None agar backend tetap merespons
            # Sesuai FAQ poin 8: "sistem dapat tetap menampilkan nama serangga"
            logger.warning("Gemini API gagal (fallback): %s", exc)
            return None

    # ------------------------------------------------------------------ #
    # Private helpers
    # ------------------------------------------------------------------ #

    def _build_prompt(self, insect_name: str, confidence: float) -> str:
        """Bangun prompt dengan konteks hasil prediksi model ML."""
        return (
            f"Model Machine Learning kami mengidentifikasi serangga berikut:\n\n"
            f"**Nama Serangga (dari model ML):** {insect_name}\n"
            f"**Confidence Score:** {confidence:.1f}%\n\n"
            f"Berikan informasi lengkap tentang serangga ini sesuai format "
            f"yang telah ditentukan. Gunakan bahasa yang informatif namun "
            f"mudah dipahami oleh masyarakat umum."
        )