
import os
import base64
from pathlib import Path
from mistralai import Mistral
from config import get_mistral_api_key

def debug_pdf_ocr():
    api_key = get_mistral_api_key()
    if not api_key:
        print("Error: API Key not set")
        return

    client = Mistral(api_key=api_key)
    
    # Try to find a PDF in the directory
    pdf_files = list(Path("C:/Users/user/Documents/ActelChatbot/Guide NGBSS").glob("*.pdf"))
    if not pdf_files:
        print("No PDF files found in current directory.")
        return

    test_file = pdf_files[0]
    print(f"Testing OCR on: {test_file}")

    with open(test_file, "rb") as f:
        file_bytes = f.read()
        b64 = base64.b64encode(file_bytes).decode()

    try:
        print("Sending request to Mistral OCR...")
        resp = client.ocr.process(
            model="mistral-ocr-latest",
            document={
                "type": "document_url",
                "document_url": f"data:application/pdf;base64,{b64}"
            },
            include_image_base64=True,
        )
        
        print(f"Response received. Pages: {len(resp.pages)}")
        
        for i, page in enumerate(resp.pages):
            print(f"\n--- Page {i+1} ---")
            print(f"Markdown Content Length: {len(page.markdown)}")
            print(f"Markdown Content Preview: {page.markdown[:200]}...")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_pdf_ocr()
