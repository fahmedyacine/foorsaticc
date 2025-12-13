# API Test Examples

## Test JSON Files

### test_questions.json
Contains sample questions in both French and Arabic to test language detection.

## Example API Calls

### 1. Health Check
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### 2. Check Server Status
```bash
curl http://localhost:5000/api/status
```

### 3. Process Documents (from current directory)
```bash
curl -X POST http://localhost:5000/api/process-documents \
  -H "Content-Type: application/json" \
  -d "{\"directory\": \".\"}"
```

### 4. Process Specific Documents
```bash
curl -X POST http://localhost:5000/api/process-documents \
  -H "Content-Type: application/json" \
  -d "{\"file_paths\": [\"Convention AT & L_établissement V.docx\", \"document.pdf\"]}"
```

### 5. Ask a Single Question (French)
```bash
curl -X POST http://localhost:5000/api/ask-question \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"Quels sont les services inclus dans cette convention?\"}"
```

Expected response:
```json
{
  "success": true,
  "question": "Quels sont les services inclus dans cette convention?",
  "answer": "...",
  "language": "fr"
}
```

### 6. Ask a Single Question (Arabic)
```bash
curl -X POST http://localhost:5000/api/ask-question \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"ما هي الخدمات المشمولة في هذه الاتفاقية؟\"}"
```

Expected response:
```json
{
  "success": true,
  "question": "ما هي الخدمات المشمولة في هذه الاتفاقية؟",
  "answer": "...",
  "language": "ar"
}
```

### 7. Process Batch of Questions
```bash
curl -X POST http://localhost:5000/api/process-questions-batch \
  -H "Content-Type: application/json" \
  -d @test_questions.json
```

Expected response:
```json
{
  "team": "Test_Team",
  "answers": {
    "categorie_01": {
      "1": "Answer in French...",
      "2": "إجابة بالعربية...",
      ...
    }
  }
}
```

### 8. Upload and Process Documents
```bash
curl -X POST http://localhost:5000/api/upload-documents \
  -F "files=@Convention AT & L_établissement V.docx" \
  -F "files=@document.pdf"
```

## Using Python requests

```python
import requests
import json

base_url = "http://localhost:5000"

# Health check
response = requests.get(f"{base_url}/health")
print(response.json())

# Process documents
response = requests.post(
    f"{base_url}/api/process-documents",
    json={"directory": "."}
)
print(response.json())

# Ask a question
response = requests.post(
    f"{base_url}/api/ask-question",
    json={"question": "Quels sont les services inclus?"}
)
print(response.json())

# Process batch questions
with open("test_questions.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

response = requests.post(
    f"{base_url}/api/process-questions-batch",
    json=questions
)
print(json.dumps(response.json(), ensure_ascii=False, indent=2))
```

## Using JavaScript/Fetch

```javascript
// Health check
fetch('http://localhost:5000/health')
  .then(res => res.json())
  .then(data => console.log(data));

// Process documents
fetch('http://localhost:5000/api/process-documents', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ directory: '.' })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Ask a question
fetch('http://localhost:5000/api/ask-question', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ 
    question: 'Quels sont les services inclus?' 
  })
})
  .then(res => res.json())
  .then(data => console.log(data));

// Process batch questions
fetch('http://localhost:5000/api/process-questions-batch', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testQuestions) // Your JSON object
})
  .then(res => res.json())
  .then(data => console.log(data));
```

