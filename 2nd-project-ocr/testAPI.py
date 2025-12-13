import requests
import json

url = "https://api.modelarts-maas.com/v2/chat/completions"

headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer 9UTzYmpmp7VfXRf_Bnyfne9jNFmpnY2I9nr2GWax705uDZLqFkrG3tM3Imu3pJ8jcqit-DOPjVglO61N7y1O3Q"
}

data = {
    "model": "deepseek-v3.1",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    "stream": False
}

response = requests.post(url, headers=headers, data=json.dumps(data))

print("Status Code:", response.status_code)
print("Response:", response.json().get("choices", [{}])[0].get("message", {}).get("content", ""))
