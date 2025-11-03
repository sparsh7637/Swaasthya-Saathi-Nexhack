
# 🏥 Medical Assistant API

A production-ready FastAPI microservice that orchestrates two Hugging Face hosted LLMs via LangChain to:

- Summarize raw prescription OCR text into a structured JSON summary
- Answer patient questions safely, optionally grounded by a prescription summary and India-specific medicine hints

It focuses on Indian healthcare context, provides strong safety messaging, and validates all model outputs with Pydantic.

---

## ✨ Highlights

- **Two-stage orchestration** (LangChain): medical model → refiner → Pydantic validation
- **Strict JSON contracts** for both endpoints; resilient JSON extraction
- **Safety layer**: request prefiltering + mandatory disclaimer and emergency hint (India)
- **Context enrichment**: built‑in Indian medicines hints; optional prescription summary context
- **Observability**: Loguru logging with configurable log level; CORS configurable

---

## 📦 Project Structure

```
medical-api-endpoints/
└─ app/
   ├─ chains/
   │  ├─ prompts.py              # Prompt templates
   │  ├─ schemas.py              # Pydantic request/response models
   │  ├─ safety.py               # Prefilter + safety footer
   │  ├─ retrieval.py            # Lightweight Indian medicines hints
   │  ├─ medical_model.py        # Medical model (draft paragraphs)
   │  └─ gpt_refiner.py          # Refiner model (final strict JSON)
   │
   ├─ models/
   │  ├─ ii_medical_loader.py    # HF: Intelligent-Internet/II-Medical-8B
   │  └─ gpt_ss_loader.py        # HF: GPT‑OSS refiner (configurable repo)
   │
   ├─ utils/
   │  ├─ json_extract.py         # Robust extractor for JSON from model text
   │  └─ prescription_context.py # Flattens summary into context lines
   │
   ├─ config.py                  # Settings (pydantic-settings)
   ├─ logging_conf.py            # Loguru configuration
   └─ main.py                    # FastAPI app + routes
```

See also: `DESIGN.md` for a short data-flow overview.

---

## ⚙️ Setup

### 1) Create a virtualenv and install deps

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 2) Configure environment

Create a `.env` file at repo root:

```ini
# Required for HF Inference API
HF_TOKEN=hf_xxx_your_token

# Server
APP_HOST=127.0.0.1
APP_PORT=8080
LOG_LEVEL=INFO

# CORS (comma-separated) — use * during local dev only
CORS_ORIGINS=*
```

Notes:
- The loaders use the Hugging Face Inference API via `langchain-huggingface`. Set `HF_TOKEN` accordingly.
- `LOG_LEVEL` drives Loguru (e.g., DEBUG, INFO, WARNING, ERROR).

### 3) Run locally

```bash
uvicorn app.main:app --host %APP_HOST% --port %APP_PORT% --reload
# or hardcode
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

The server exposes OpenAPI at `/docs` and `/redoc`.

---

## 🔌 API Endpoints

### Health

GET `/health`

Response:
```json
{"status":"ok"}
```

---

### Summarize Prescription

POST `/summarize-prescription`

- Accepts OCR text and returns a structured summary validated against `PrescriptionSummary`.
- Flow: safety prefilter → medical model draft → refiner JSON → JSON extraction → Pydantic validation.

Request (schema = `SummarizeRequest`):
```json
{
  "text": "Patient: Suresh Kumar. Dx: Acute Gastritis. Rx: Pantocid D 40 mg OD before breakfast x 7 days; Sucralfate syrup 2 tsp TID before meals x 10 days; ORS powder as needed."
}
```

Response (schema = `SummarizeResponse`):
```json
{
  "summary": {
    "patient_name": "Suresh Kumar",
    "diagnosis_or_complaints": "Acute Gastritis",
    "medicines": [
      {"name": "Pantocid D", "dosage": "40 mg", "frequency": "once daily", "duration": "7 days", "instructions": "before breakfast"},
      {"name": "Sucralfate syrup", "dosage": "2 tsp", "frequency": "three times daily", "duration": "10 days", "instructions": "before meals"},
      {"name": "ORS powder", "dosage": null, "frequency": "as needed", "duration": null, "instructions": ""}
    ],
    "tests_or_followup": null,
    "red_flags": null,
    "generic_advice": "Maintain hydration; avoid irritants.",
    "disclaimer": "Informational only; not a substitute for professional medical advice."
  }
}
```

---

### Answer Patient Query

POST `/answer-query`

- Answers a free‑text question. If you pass a `prescription_summary`, it is flattened into context. Also merges Indian‑meds hints when relevant.
- Flow: safety prefilter → build merged context → medical model draft → refiner JSON → JSON extraction → Pydantic validation.

Request (schema = `AnswerQueryRequest`):
```json
{
  "query": "Can I drink tea if I'm taking Pantocid D before breakfast?",
  "prescription_summary": {
    "summary": {
      "patient_name": "Suresh Kumar",
      "diagnosis_or_complaints": "Acute Gastritis",
      "medicines": [
        {"name": "Pantocid D", "dosage": "40 mg", "frequency": "once daily", "duration": "7 days", "instructions": "before breakfast"}
      ]
    }
  }
}
```

Response (schema = `AnswerQueryResponse`):
```json
{
  "answer": "Pantocid D should be taken on an empty stomach. Wait ~30 minutes before tea or breakfast.",
  "safety": {
    "disclaimer": "Informational only; not a substitute for professional medical advice.",
    "emergency": "If this is an emergency in India, call 112 or visit the nearest emergency department.",
    "version": "v1"
  },
  "sources": [
    "Pantocid D (40 mg, once daily, 7 days, before breakfast)"
  ]
}
```

---

## 🧩 Schemas (Pydantic)

- `SummarizeRequest`: `{ text: str (min 5), locale?: "en-IN" }`
- `SummarizeResponse`: `{ summary: PrescriptionSummary }`
- `PrescriptionSummary`:
  - `patient_name?: str`
  - `diagnosis_or_complaints?: str`
  - `medicines: MedicineItem[]` where each item has `{ name: str, dosage?: str, frequency?: str, duration?: str, instructions?: str }`
  - `tests_or_followup?: str`, `red_flags?: str`, `generic_advice?: str`, `disclaimer: str`
- `AnswerQueryRequest`: `{ query: str (min 3), locale?: "en-IN", prescription_summary?: object }`
- `AnswerQueryResponse`: `{ answer: str, safety: object, sources: string[] }`

---

## 🔐 Safety & Compliance

- `prefilter()` blocks known harmful intents (e.g., self‑harm, overdose advice)
- Every response includes `safety_footer()` with disclaimer + India emergency hint
- Refiner enforces JSON structure; `json_extract.py` robustly pulls JSON from model text

---

## 🛠 Configuration Reference

- `HF_TOKEN` (required): Hugging Face token for Inference API
- `APP_HOST`, `APP_PORT`: server binding
- `LOG_LEVEL`: DEBUG | INFO | WARNING | ERROR (Loguru)
- `CORS_ORIGINS`: comma‑separated list or `*`

---

## 🧪 Testing

Run smoke tests (extend as needed):
```bash
pytest -q
```

---

## 🚀 Deployment Notes

- Uvicorn/Gunicorn + FastAPI
- Ensure `HF_TOKEN` is set as a secret
- Restrict `CORS_ORIGINS` in production
- Tune Hugging Face endpoint parameters (max tokens, temperature) in `models/*.py`

---

## 🧭 Troubleshooting

- 502 from refiner: check `HF_TOKEN`, model availability, and confirm refiner returns valid JSON (see logs)
- Empty/invalid JSON: `json_extract.py` now handles fenced blocks and tagged `<Answer>` wrappers; inspect raw text in logs if extraction fails
- Import errors on startup: ensure environment is active and `requirements.txt` installed

---

## 📄 License

This project is provided as part of Swaasthya Saathi. See repository license for terms.


