
from google import genai
from app.config import settings

print("Testing CargoLens Gemini SDK...", flush=True)

try:
    client = genai.Client(api_key=settings.google_api_key)

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents="Reply with exactly CARGOLENS SDK WORKING"
    )

    print("Model:", settings.gemini_model)
    print("Response:", response.text)

except Exception as e:
    print("SDK ERROR:", type(e).__name__, str(e)[:500])
