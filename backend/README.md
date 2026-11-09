# CargoLens AI - Backend (stage 1)

FastAPI + SQLAlchemy backend for import-document extraction, cross-document validation, review,
manager approval and CSV/XLSX export.

## Run it (Windows PowerShell)

```powershell
cd C:\Users\Rakshita\Documents\cargolens-ai\backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # first time only
python -m uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs . Click **Authorize** and sign in with a demo account.
Always start Uvicorn from the `backend` folder (not from `backend\app`).

## Demo accounts (demonstration only - change before any real use)

| Role      | Username  | Password       |
|-----------|-----------|----------------|
| Executive | executive | Executive@123  |
| Manager   | manager   | Manager@123    |

## Tests

```powershell
python -m pytest -q
```

## AI extraction modes

* **No GOOGLE_API_KEY (default):** DEMO/FALLBACK mode. Returns *synthetic sample data*. Every field is tagged
  `demo_fallback` and the API/UI must label it as not AI-generated.
* **Real AI:** set `GOOGLE_API_KEY` **and** `AI_DATA_PROCESSING_VERIFIED=true` in `.env`. The second switch is a
  deliberate safeguard: confidential client documents are not sent to a third party until its data-processing and
  no-training terms (and India-region / DPDP Act 2023 requirements) have been verified.
  The Gemini path is implemented but has NOT been tested against the live API in this build.

## Key rules enforced in the backend

* Validation is plain Python (`services/validation_service.py`), not an LLM.
* Gross-weight tolerance 0.5% (`WEIGHT_TOLERANCE_PCT`) is a provisional demo value that needs client approval.
* The system never picks a "correct" document: a cross-document discrepancy stays blocking until a reviewer
  corrects a value or records a written resolution. Changing the compared values re-opens it.
* Export requires status Approved/Exported AND zero unresolved blocking issues (checked again at export time).
* The CSV layout is PROVISIONAL (`export_format_version` column); edit `EXPORT_COLUMNS` in
  `services/export_service.py` once the client's filing-software template is available.
* Accuracy reports separate demo data from real AI output and make no 95% claim.

## Known limitations

* Extraction runs synchronously inside the request (fine for an MVP; use a job queue for production).
* Weights are assumed to be in kg; numbers use comma-as-thousands parsing.
* Item matching between invoice and packing list uses the normalised description text.
* No login rate-limiting or token revocation yet (tokens are stateless; logout is recorded in the audit log).
* SQLite for the prototype; set `DATABASE_URL` to PostgreSQL for production and add migrations (Alembic).
