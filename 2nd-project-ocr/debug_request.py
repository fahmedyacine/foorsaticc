"""Debug script to compare requests between working and broken versions"""
import requests
import json
from config import get_deepseek_api_key

api_key = get_deepseek_api_key()

# ===== WORKING: testAPI.py version =====
print("=" * 60)
print("WORKING REQUEST (testAPI.py style)")
print("=" * 60)

url_working = "https://api.modelarts-maas.com/v2/chat/completions"
headers_working = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}
data_working = {
    "model": "deepseek-v3.1",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    "stream": False
}

print(f"URL: {url_working}")
print(f"Headers: {json.dumps(headers_working, indent=2)}")
print(f"Payload: {json.dumps(data_working, indent=2)}")
print()

response_working = requests.post(url_working, headers=headers_working, data=json.dumps(data_working))
print(f"Status: {response_working.status_code}")
print(f"Response: {response_working.text[:200]}")
print()

# ===== BROKEN: chatbot.py version =====
print("=" * 60)
print("BROKEN REQUEST (chatbot.py style with doc content)")
print("=" * 60)

from chatbot import DocumentChatbot

chatbot = DocumentChatbot(api_key=api_key, document_content="Sample document content for testing.")

# Manually build the request to see what's being sent
system_instructions = chatbot.get_language_instructions('fr')
system_message = f"""{system_instructions}

Contenu des documents (Document content):
{chatbot.document_content}"""

headers_broken = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {api_key}"
}

payload_broken = {
    "model": chatbot.model,
    "messages": [
        {"role": "system", "content": system_message},
        {"role": "user", "content": "Quels sont les services?"}
    ],
    "stream": False
}

print(f"URL: {chatbot.api_url}")
print(f"Headers: {json.dumps(headers_broken, indent=2)}")
print(f"Payload (first 500 chars): {json.dumps(payload_broken, indent=2)[:500]}")
print(f"Model: {payload_broken['model']}")
print()

response_broken = requests.post(chatbot.api_url, headers=headers_broken, data=json.dumps(payload_broken), timeout=30)
print(f"Status: {response_broken.status_code}")
print(f"Response: {response_broken.text}")
