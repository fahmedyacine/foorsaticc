"""
Flask web server for document processing and chatbot API
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

from document_processor import DocumentProcessor
from chatbot import DocumentChatbot
from config import get_mistral_api_key, get_deepseek_api_key
from utils import build_document_content, create_error_response, create_success_response

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)  # Enable CORS for web app integration

# Global variables to store processed documents
processed_documents = None
document_content = ""
processor_instance = None

# Folder mapping - CUSTOMIZE THESE TO YOUR ACTUAL FOLDER NAMES
FOLDER_MAP = {
    "folder1": "Guide NGBSS",
    "folder2": "Offres",
    "folder3": "Convention",
    "folder4": "Offres en arabe",
    "folder5": "Depot Vente"
}


def initialize_processor():
    """Initialize the document processor instance"""
    global processor_instance

    mistral_key = get_mistral_api_key()
    if not mistral_key:
        print("⚠ Warning: MISTRAL_API_KEY not set. Document processing disabled.")
        return None

    processor_instance = DocumentProcessor(api_key=mistral_key)
    return processor_instance


def process_selected_folders(selected_folders=None):
    """
    Process documents from selected folders

    Args:
        selected_folders: List of folder keys (e.g., ['folder1', 'folder2'])
                         If None, processes all folders

    Returns:
        dict: Results with total_documents and documents list
    """
    global processor_instance

    if processor_instance is None:
        processor_instance = initialize_processor()
        if processor_instance is None:
            return {"total_documents": 0, "documents": []}

    if selected_folders is None:
        selected_folders = list(FOLDER_MAP.keys())

    all_results = {
        "total_documents": 0,
        "documents": [],
        "processed_folders": []
    }

    for folder_key in selected_folders:
        folder_name = FOLDER_MAP.get(folder_key)
        if not folder_name:
            print(f"⚠ Unknown folder key: {folder_key}")
            continue

        folder_path = os.path.join(".", folder_name)

        if not os.path.exists(folder_path):
            print(f"⚠ Folder not found: {folder_path}")
            continue

        print(f"Processing folder: {folder_name} ({folder_path})")

        try:
            results = processor_instance.process_directory(folder_path, recursive=False)

            if results["total_documents"] > 0:
                all_results["total_documents"] += results["total_documents"]
                all_results["documents"].extend(results["documents"])
                all_results["processed_folders"].append(folder_name)

                print(f"✓ Processed {results['total_documents']} document(s) from {folder_name}")
        except Exception as e:
            print(f"✗ Error processing folder {folder_name}: {e}")

    return all_results


def preprocess_documents_on_startup():
    """Automatically process all documents in configured folders on server startup"""
    global processed_documents, document_content

    print("\n" + "="*60)
    print("Preprocessing documents for RAG...")
    print("="*60)

    try:
        # Process all folders by default
        results = process_selected_folders()

        if results["total_documents"] == 0:
            print("⚠ No documents found to process.")
            print("Make sure your folders exist and contain documents:")
            for key, folder in FOLDER_MAP.items():
                folder_path = os.path.join(".", folder)
                exists = "✓" if os.path.exists(folder_path) else "✗"
                print(f"  {exists} {folder}")
            return False

        # Store processed documents
        processed_documents = results

        # Extract combined content for chatbot/RAG
        document_content = build_document_content(results)

        print(f"✓ Successfully processed {results['total_documents']} document(s)")
        print(f"✓ From folders: {', '.join(results['processed_folders'])}")
        total_pages = sum(doc['total_pages'] for doc in results.get("documents", []))
        print(f"✓ Total pages processed: {total_pages}")
        print(f"✓ Content length: {len(document_content)} characters")
        print("="*60 + "\n")

        return True

    except Exception as e:
        print(f"✗ Error preprocessing documents: {e}")
        print("Server will start but document processing may not work.")
        return False


# Preprocess documents on startup
preprocess_documents_on_startup()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok", "message": "Server is running"})


@app.route('/api/reload-documents', methods=['POST'])
def reload_documents():
    """
    Reload documents from selected folders

    Request body:
    {
        "folders": ["folder1", "folder2", "folder3"]
    }

    Returns:
    {
        "success": true,
        "total_documents": 15,
        "processed_folders": ["Guide NGBSS", "Technical Docs"],
        "content_length": 50000
    }
    """
    global processed_documents, document_content

    try:
        data = request.get_json() or {}
        selected_folders = data.get('folders', [])

        if not selected_folders:
            return create_error_response("No folders selected. Please select at least one folder.", 400)

        print(f"\n{'='*60}")
        print(f"Reloading documents from selected folders...")
        print(f"Selected: {selected_folders}")
        print(f"{'='*60}")

        # Process selected folders
        results = process_selected_folders(selected_folders)

        if results["total_documents"] == 0:
            return jsonify({
                "success": False,
                "error": "No documents found in selected folders",
                "total_documents": 0,
                "processed_folders": []
            })

        # Store processed documents
        processed_documents = results

        # Extract combined content for chatbot/RAG
        document_content = build_document_content(results)

        print(f"✓ Reload complete: {results['total_documents']} documents")
        print(f"{'='*60}\n")

        return jsonify({
            "success": True,
            "total_documents": results["total_documents"],
            "processed_folders": results["processed_folders"],
            "content_length": len(document_content),
            "documents": [
                {
                    "filename": doc["filename"],
                    "total_pages": doc["total_pages"]
                }
                for doc in results.get("documents", [])
            ]
        })

    except Exception as e:
        print(f"✗ Error reloading documents: {e}")
        return create_error_response(str(e), 500)


@app.route('/api/available-folders', methods=['GET'])
def get_available_folders():
    """
    Get list of available folders and their status

    Returns:
    {
        "folders": [
            {
                "key": "folder1",
                "name": "Guide NGBSS",
                "exists": true,
                "path": "./Guide NGBSS"
            },
            ...
        ]
    }
    """
    folders = []

    for key, name in FOLDER_MAP.items():
        folder_path = os.path.join(".", name)
        folders.append({
            "key": key,
            "name": name,
            "exists": os.path.exists(folder_path),
            "path": folder_path
        })

    return jsonify({"folders": folders})


@app.route('/api/process-documents', methods=['POST'])
def process_documents():
    """
    Process multiple documents (DOCX and PDF)

    Request body:
    {
        "file_paths": ["document1.docx", "document2.pdf"],  # Optional: specific files
        "directory": "."  # Optional: directory to process (defaults to current directory)
    }

    Returns:
    {
        "success": true,
        "total_documents": 2,
        "documents": [...]
    }
    """
    global processed_documents, document_content, processor_instance

    try:
        mistral_key = get_mistral_api_key()
        if not mistral_key:
            return create_error_response("MISTRAL_API_KEY environment variable not set", 400)

        if processor_instance is None:
            processor_instance = DocumentProcessor(api_key=mistral_key)

        data = request.get_json() or {}
        file_paths = data.get("file_paths", [])
        directory = data.get("directory", ".")

        # Process documents
        if file_paths:
            results = processor_instance.process_multiple_documents(file_paths)
        else:
            results = processor_instance.process_directory(directory, recursive=False)

        # Store processed documents and build content
        processed_documents = results
        document_content = build_document_content(results)

        return create_success_response({
            "total_documents": results["total_documents"],
            "documents": results["documents"]
        })

    except Exception as e:
        return create_error_response(str(e), 500)


@app.route('/api/ask-question', methods=['POST'])
def ask_question():
    """
    Ask a single question and get an answer

    Request body:
    {
        "question": "What are the services included?"
    }

    Returns:
    Stream of text answer
    """
    global document_content

    try:
        deepseek_key = get_deepseek_api_key()
        if not deepseek_key:
            return jsonify({
                "success": False,
                "error": "DEEPSEEK_API_KEY environment variable not set"
            }), 400

        if not document_content:
            return jsonify({
                "success": False,
                "error": "No documents processed. Please process documents first using /api/process-documents"
            }), 400

        data = request.get_json()
        if not data or "question" not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'question' in request body"
            }), 400

        question = data["question"]

        # Initialize chatbot
        chatbot = DocumentChatbot(api_key=deepseek_key, document_content=document_content)

        # Detect language (for logging)
        language = chatbot.detect_language(question)
        print(f"DEBUG: Processing question in {language}")

        # Get answer generator
        generator = chatbot.ask_question(question, stream=True)

        if isinstance(generator, str):
            # Error occurred returned as string
            return create_error_response(generator, 500)

        # Stream the response
        from flask import Response, stream_with_context

        def generate_stream():
            try:
                # First chunk indicates success and language
                yield json.dumps({
                    "type": "meta",
                    "success": True,
                    "language": language
                }) + "\n"

                # Stream content
                for chunk in generator:
                    yield json.dumps({
                        "type": "content",
                        "content": chunk
                    }) + "\n"

                # End of stream
                yield json.dumps({
                    "type": "done"
                }) + "\n"

            except Exception as e:
                yield json.dumps({
                    "type": "error",
                    "error": str(e)
                }) + "\n"

        return Response(stream_with_context(generate_stream()), mimetype='application/x-ndjson')

    except Exception as e:
        return create_error_response(str(e), 500)


@app.route('/api/process-questions-batch', methods=['POST'])
def process_questions_batch():
    """
    Process a batch of questions (same format as input_questions.json)

    Request body:
    {
        "equipe": "Team_Name",
        "question": {
            "categorie_01": {
                "1": "Question 1",
                "2": "Question 2"
            }
        }
    }

    Returns:
    {
        "team": "Team_Name",
        "answers": {
            "categorie_01": {
                "1": "Answer 1",
                "2": "Answer 2"
            }
        }
    }
    """
    global document_content

    try:
        deepseek_key = get_deepseek_api_key()
        if not deepseek_key:
            return create_error_response("DEEPSEEK_API_KEY environment variable not set", 400)

        if not document_content:
            return create_error_response(
                "No documents processed. Please process documents first using /api/process-documents",
                400
            )

        data = request.get_json()
        if not data:
            return create_error_response("Missing request body", 400)

        # Initialize chatbot
        chatbot = DocumentChatbot(api_key=deepseek_key, document_content=document_content)

        # Process questions
        results = chatbot.process_questions_batch(data)

        return jsonify(results)

    except Exception as e:
        return create_error_response(str(e), 500)


@app.route('/api/upload-documents', methods=['POST'])
def upload_documents():
    """
    Upload and process document files

    Request: multipart/form-data with files
    Returns: Processed documents JSON
    """
    global processed_documents, document_content, processor_instance

    try:
        mistral_key = get_mistral_api_key()
        if not mistral_key:
            return create_error_response("MISTRAL_API_KEY environment variable not set", 400)

        if 'files' not in request.files:
            return create_error_response("No files provided", 400)

        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return create_error_response("No valid files provided", 400)

        # Save uploaded files temporarily
        if processor_instance is None:
            processor_instance = DocumentProcessor(api_key=mistral_key)

        file_paths = []
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        for file in files:
            if file.filename:
                file_path = os.path.join(upload_dir, file.filename)
                file.save(file_path)
                file_paths.append(file_path)

        # Process documents
        results = processor_instance.process_multiple_documents(file_paths)

        # Store processed documents and build content
        processed_documents = results
        document_content = build_document_content(results)

        return create_success_response({
            "total_documents": results["total_documents"],
            "documents": results["documents"]
        })

    except Exception as e:
        return create_error_response(str(e), 500)


@app.route('/')
def index():
    """Serve the chat interface"""
    return app.send_static_file('index.html')


@app.route('/api/status', methods=['GET'])
def get_status():
    """Get server status and document processing status"""
    global processed_documents, document_content

    doc_info = {}
    processed_folder_names = []

    if processed_documents:
        doc_info = {
            "total_documents": processed_documents["total_documents"],
            "documents": [
                {
                    "filename": doc["filename"],
                    "total_pages": doc["total_pages"]
                }
                for doc in processed_documents.get("documents", [])
            ]
        }
        processed_folder_names = processed_documents.get("processed_folders", [])

    return jsonify({
        "status": "running",
        "documents_processed": processed_documents is not None,
        "total_documents": processed_documents["total_documents"] if processed_documents else 0,
        "has_content": len(document_content) > 0,
        "content_length": len(document_content),
        "processed_folders": processed_folder_names,
        "documents": doc_info
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('DEBUG', 'False').lower() == 'true'

    print(f"\n{'='*60}")
    print("Starting Document Processor & Chatbot Server")
    print(f"{'='*60}")
    print(f"Server running on: http://{host}:{port}")
    print(f"Web Interface: http://{host}:{port}/")
    print(f"\nAPI Endpoints:")
    print(f"  GET  /health - Health check")
    print(f"  GET  /api/status - Server status")
    print(f"  GET  /api/available-folders - List available folders")
    print(f"  POST /api/reload-documents - Reload from selected folders")
    print(f"  POST /api/process-documents - Process documents")
    print(f"  POST /api/upload-documents - Upload and process files")
    print(f"  POST /api/ask-question - Ask a single question")
    print(f"  POST /api/process-questions-batch - Process batch of questions")
    print(f"{'='*60}\n")

    app.run(host=host, port=port, debug=debug)