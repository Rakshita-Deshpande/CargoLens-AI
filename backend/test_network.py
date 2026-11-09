
import httpx

urls = [
    "https://www.google.com",
    "https://generativelanguage.googleapis.com",
]

for url in urls:
    try:
        response = httpx.get(url, timeout=8.0)
        print(url, "CONNECTED:", response.status_code)
    except Exception as e:
        print(url, "FAILED:", type(e).__name__)
