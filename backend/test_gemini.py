
import httpx
import time
from app.config import settings

url = (
    f"https://generativelanguage.googleapis.com/v1beta/"
    f"models/{settings.gemini_model}:generateContent"
)

print("Model:", settings.gemini_model, flush=True)
print("API key loaded:", bool(settings.google_api_key), flush=True)
print("Sending Gemini request...", flush=True)

start = time.time()

try:
    response = httpx.post(
        url,
        headers={
            "x-goog-api-key": settings.google_api_key,
            "Content-Type": "application/json",
        },
        json={
            "contents": [{
                "parts": [{"text": "Reply with exactly GEMINI WORKING"}]
            }]
        },
        timeout=httpx.Timeout(60.0, connect=15.0),
    )

    print("Time taken:", round(time.time() - start, 2), "seconds")
    print("HTTP status:", response.status_code)
    print("Response:", response.text[:1500])

except httpx.TimeoutException as exc:
    print("TIMEOUT:", type(exc).__name__)
    print("Details:", str(exc))
    print("Time taken:", round(time.time() - start, 2), "seconds")

except httpx.RequestError as exc:
    print("NETWORK ERROR:", type(exc).__name__)
    print("Details:", str(exc))
