# Document Processor

A Python application for processing multiple DOCX and image-based PDF documents using Mistral OCR API. Extracts content and returns it in JSON format for chatbot integration.

## Features

- Process multiple DOCX files
- Process multiple image-based PDF files
- Extract text and structure using Mistral OCR
- Output results in JSON format
- Support for batch processing from directories

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export MISTRAL_API_KEY="your-mistral-api-key"
export DEEPSEEK_API_KEY="your-deepseek-api-key"  # Optional, for chatbot features
```

On Windows:
```cmd
set MISTRAL_API_KEY=your-mistral-api-key
set DEEPSEEK_API_KEY=your-deepseek-api-key
```

## Usage

### Process documents in current directory:

```python
from document_processor import DocumentProcessor
import os

processor = DocumentProcessor(api_key=os.getenv("MISTRAL_API_KEY"))
results = processor.process_directory(".")
processor.save_results(results, "documents_processed.json")
```

### Process specific files:

```python
file_paths = ["document1.docx", "document2.pdf"]
results = processor.process_multiple_documents(file_paths)
processor.save_results(results, "documents_processed.json")
```

### Command line:

```bash
python document_processor.py
```

## Output Format

The JSON output has the following structure:

```json
{
  "total_documents": 2,
  "documents": [
    {
      "filename": "document1.docx",
      "file_path": "path/to/document1.docx",
      "file_type": ".docx",
      "total_pages": 5,
      "pages": [
        {
          "page_number": 1,
          "markdown_content": "..."
        }
      ]
    }
  ]
}
```

## Supported File Types

- `.docx` - Microsoft Word documents
- `.pdf` - PDF documents (including image-based)

## Web Server / API

A Flask web server is provided for easy integration with web applications.

### Starting the Server

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set environment variables:
```cmd
set MISTRAL_API_KEY=your-mistral-api-key
set DEEPSEEK_API_KEY=your-deepseek-api-key
```

3. Start the server:
```bash
python app.py
```

Or use the startup script:
```bash
python start_server.py
```

The server will start on `http://localhost:5000` (or configure with `PORT` environment variable).

### API Endpoints

- `GET /health` - Health check endpoint
- `GET /api/status` - Get server and document processing status
- `POST /api/process-documents` - Process documents from file paths or directory
- `POST /api/upload-documents` - Upload and process document files (multipart/form-data)
- `POST /api/ask-question` - Ask a single question and get answer
- `POST /api/process-questions-batch` - Process batch of questions (same format as input_questions.json)

### Example API Usage

#### Process Documents:
```bash
curl -X POST http://localhost:5000/api/process-documents \
  -H "Content-Type: application/json" \
  -d '{"directory": "."}'
```

#### Ask a Question:
```bash
curl -X POST http://localhost:5000/api/ask-question \
  -H "Content-Type: application/json" \
  -d '{"question": "Quels sont les services inclus?"}'
```

#### Process Questions Batch:
```bash
curl -X POST http://localhost:5000/api/process-questions-batch \
  -H "Content-Type: application/json" \
  -d @input_questions.json
```

## Chatbot Integration

The chatbot module (`chatbot.py`) can answer questions based on processed documents. It automatically detects the language of each question (French or Arabic) and responds in the same language.

### Using the Chatbot

1. First, process your documents:
```python
from document_processor import DocumentProcessor
from config import get_mistral_api_key

processor = DocumentProcessor(api_key=get_mistral_api_key())
results = processor.process_directory(".")
processor.save_results(results, "documents_processed.json")
```

2. Then, use the chatbot to answer questions:
```python
from chatbot import DocumentChatbot
from config import get_deepseek_api_key
import json

# Load processed documents
chatbot = DocumentChatbot(api_key=get_deepseek_api_key(), document_content="")
chatbot.load_document_from_json("documents_processed.json")

# Load questions
with open("input_questions.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

# Process questions (answers will be in French or Arabic depending on question language)
results = chatbot.process_questions_batch(questions)
chatbot.save_results(results, "output_answers.json")
```

### Question Format

Input questions should be in this JSON format:
```json
{
  "equipe": "Team_Name",
  "question": {
    "categorie_01": {
      "1": "Question in French or Arabic",
      "2": "Another question"
    },
    "categorie_02": {
      "1": "More questions..."
    }
  }
}
```

### Answer Format

Answers are returned in the same format:
```json
{
  "team": "Team_Name",
  "answers": {
    "categorie_01": {
      "1": "Answer in the same language as the question",
      "2": "Another answer"
    }
  }
}
```

### Language Detection

- Questions containing Arabic characters (even one) will receive Arabic answers
- Questions in French (or other Latin scripts) will receive French answers
- The chatbot automatically detects the language and responds accordingly

