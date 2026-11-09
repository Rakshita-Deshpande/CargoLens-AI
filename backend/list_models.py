
import httpx
from app.config import settings

url = "https://generativelanguage.googleapis.com/v1beta/models"

response = httpx.get(
    url,
    headers={"x-goog-api-key": settings.google_api_key},
    timeout=20
)

print("HTTP:", response.status_code)

if response.is_success:
    data = response.json()

    for model in data.get("models", []):
        name = model.get("name", "")
        if "gemini" in name.lower():
            print("\nModel:", name)
            print("Methods:", model.get("supportedGenerationMethods"))
            print("Input:", model.get("inputTokenLimit"))
            print("Output:", model.get("outputTokenLimit"))
else:
    print(response.text[:1000])
