# 🦋 LensArthropoda — Smart Insect Identifier & AI Insights

> **Final Project — Praktikum Pembelajaran Mesin (Machine Learning)**  
> Sistem identifikasi serangga otomatis menggunakan **EfficientNet-B3** (Transfer Learning PyTorch) + **Gemini 2.5 Flash Lite** untuk wawasan mendalam tentang spesies serangga.

---

## 📁 Struktur Direktori

```
LensArthropoda/
├── files/
│   ├── laporan.pdf          ← Laporan final (isi setelah training)
│   └── notebook.ipynb       ← Notebook training model
├── backend/
│   ├── artifacts/
│   │   ├── insect_model.pt  ← Model TorchScript (hasil training)
│   │   └── metadata.json    ← Metadata kelas & konfigurasi model
│   ├── env.example          ← Template environment variables
│   ├── gemini_service.py    ← Integrasi Gemini 2.5 Flash Lite
│   ├── main.py              ← FastAPI entry point
│   ├── ml_service.py        ← Pipeline inferensi ML
│   └── requirements.txt     ← Python dependencies
└── frontend/
    ├── app/
    │   ├── page.tsx         ← Halaman utama
    │   ├── globals.css      ← Global styles (dark theme)
    │   └── layout.tsx       ← Root layout Next.js
    ├── components/
    │   └── ResultCard.tsx   ← Komponen hasil prediksi + AI Insights
    ├── .env.local           ← URL backend (tidak di-upload ke GitHub)
    ├── next.config.mjs
    ├── package.json
    ├── postcss.config.mjs
    ├── tailwind.config.ts
    └── tsconfig.json
```

---

## 🚀 Cara Menjalankan Project

### Tahap 1 — Training Model (Kaggle / Google Colab)

1. Upload `files/notebook.ipynb` ke **Kaggle** atau **Google Colab**
2. Aktifkan GPU:
   - Kaggle: *Settings → Accelerator → GPU T4 x2*
   - Colab: *Runtime → Change runtime type → GPU*
3. Sesuaikan `DATASET_PATH` di cell konfigurasi:
   ```python
   # Kaggle
   DATASET_PATH = '/kaggle/input/insects-image-classification-dataset'
   # Colab + Google Drive
   DATASET_PATH = '/content/drive/MyDrive/insects_dataset'
   ```
4. Jalankan semua cell dari atas ke bawah (**Run All**)
5. Setelah training selesai, **download** dua file dari folder `artifacts/`:
   - `insect_model.pt`
   - `metadata.json`
6. Letakkan kedua file tersebut di: `backend/artifacts/`

---

### Tahap 2 — Setup & Jalankan Backend

```bash
# 1. Masuk ke folder backend
cd backend

# 2. Buat virtual environment
python -m venv env

# 3. Aktifkan virtual environment
#    Linux / macOS:
source env/bin/activate
#    Windows:
env\Scripts\activate

# 4. Install semua dependencies
pip install -r requirements.txt

# 5. Salin template .env dan isi API Key
cp env.example .env
```

Edit file `.env` yang baru dibuat:
```env
GEMINI_API_KEY=AIzaSy...xxxxxxxxxxxxxxxx   ← ganti dengan API key Anda
MODEL_PATH=./artifacts/insect_model.pt
METADATA_PATH=./artifacts/metadata.json
```

> 💡 Dapatkan Gemini API Key **GRATIS** di: https://aistudio.google.com/app/apikey  
> Pilih paket **Free Tier** — sudah cukup untuk project ini.

```bash
# 6. Jalankan backend
uvicorn main:app --reload
```

Backend berjalan di: **http://localhost:8000**

Verifikasi dengan membuka: http://localhost:8000 → harus muncul JSON `"status": "running"`

---

### Tahap 3 — Setup & Jalankan Frontend

Buka **terminal baru** (jangan tutup terminal backend):

```bash
# 1. Masuk ke folder frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Jalankan development server
npm run dev
```

Frontend berjalan di: **http://localhost:3000**

---

## ✅ Endpoint API

| Method | Endpoint    | Deskripsi                              |
|--------|-------------|----------------------------------------|
| GET    | `/`         | Health check — status backend          |
| GET    | `/health`   | Status detail komponen                 |
| GET    | `/classes`  | Daftar kelas serangga yang dikenali    |
| POST   | `/predict`  | Inferensi gambar + AI Insights Gemini  |
| GET    | `/docs`     | Swagger UI dokumentasi API             |

### Contoh request `/predict`:
```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@foto_serangga.jpg"
```

### Contoh response:
```json
{
  "predicted_class": "Butterfly",
  "confidence": 94.7,
  "top_predictions": [
    { "class_name": "Butterfly", "confidence": 94.7 },
    { "class_name": "Moth",      "confidence":  3.2 },
    { "class_name": "Dragonfly", "confidence":  1.5 }
  ],
  "ai_insights": "## Nama Ilmiah\n*Lepidoptera*\n\n## Nama Umum\n...",
  "ai_available": true,
  "message": null
}
```

---

## 🏗️ Arsitektur Sistem

```
[User — Browser]
      │
      │  Upload gambar (multipart/form-data)
      ▼
[Next.js Frontend :3000]
      │
      │  POST /predict
      ▼
[FastAPI Backend :8000]
      │
      ├──► [MLService]
      │      EfficientNet-B3 (TorchScript)
      │      → Preprocessing → Inference → Top-K Softmax
      │
      └──► [GeminiService]
             Gemini 2.5 Flash Lite
             ThinkingConfig + Optional GoogleSearch
             → Informasi taksonomi, habitat, fun facts
             → Fallback: None jika 503/rate-limit
      │
      │  JSON Response
      ▼
[Next.js Frontend]
  ResultCard.tsx
  → Nama + Confidence Badge
  → Top-K Bar Chart
  → Markdown rendering (react-markdown)
```

---

## 🧠 Detail Teknis

| Komponen | Detail |
|---|---|
| **Model** | EfficientNet-B3 (timm), pretrained ImageNet |
| **Training** | AdamW + CosineAnnealingLR + Early Stopping |
| **Augmentasi** | RandomCrop, Flip, Rotate, ColorJitter, Perspective |
| **Export** | TorchScript (`torch.jit.script` + `torch.jit.save`) |
| **Backend** | FastAPI + Uvicorn |
| **AI** | Gemini 2.5 Flash Lite (ThinkingConfig) |
| **Frontend** | Next.js 14 + Tailwind CSS |
| **Markdown** | react-markdown + remark-gfm |

---

## ⚠️ Troubleshooting

### Model tidak ditemukan saat backend start
```
FileNotFoundError: Model tidak ditemukan: ./artifacts/insect_model.pt
```
→ Pastikan sudah menjalankan training dan meletakkan `insect_model.pt` + `metadata.json` di `backend/artifacts/`

### Gemini error 503 / rate limit
→ Normal. Backend menggunakan **Fallback Mechanism** — prediksi ML tetap dikembalikan dengan pesan keterangan. Coba lagi beberapa saat kemudian.

### CORS error di browser
→ Pastikan backend berjalan di `http://localhost:8000` dan frontend di `http://localhost:3000`

### `ModuleNotFoundError` saat `pip install`
→ Pastikan virtual environment sudah diaktifkan sebelum install

### GPU tidak tersedia di backend lokal
→ Tidak masalah. `ml_service.py` sudah dikonfigurasi `map_location='cpu'` secara otomatis (FAQ poin 3 PDF)

---

## 📋 Deliverables Checklist

- [x] Source code lengkap (notebook + backend + frontend)
- [ ] `backend/artifacts/insect_model.pt` — setelah training
- [ ] `backend/artifacts/metadata.json`   — setelah training  
- [ ] `files/laporan.pdf` — laporan final
- [ ] Video demo 5–8 menit (upload ke YouTube/Drive)
- [ ] Post LinkedIn (tag Aslab Agil & Willy)

---

## 🔒 Keamanan & Git

File yang **TIDAK boleh** di-upload ke GitHub (sudah ada di `.gitignore`):
- `backend/.env` — berisi API Key
- `env/` atau `venv/` — virtual environment Python  
- `frontend/node_modules/` — dependencies Node.js
- `frontend/.env.local` — URL konfigurasi frontend
- `backend/artifacts/*.pt` — model besar (gunakan Git LFS jika diperlukan)

---

*Disusun untuk Final Project — Modul Praktikum Pembelajaran Mesin (Machine Learning)*
