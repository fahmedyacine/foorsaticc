
import os
from pathlib import Path
from document_processor import DocumentProcessor

def debug_pdf_ocr():
    # Initialize processor (local, no API key needed)
    processor = DocumentProcessor()
    
    # Try to find a PDF in the directory
    pdf_files = list(Path("C:/Users/user/Documents/ActelChatbot/Guide NGBSS").glob("*.pdf"))
    if not pdf_files:
        print("No PDF files found in current directory.")
        return

    test_file = pdf_files[0]
    print(f"Testing OCR on: {test_file}")
    
    try:
        results = processor.process_document(str(test_file))
        
        print(f"\nResults for {results['filename']}:")
        print(f"Total Pages: {results['total_pages']}")
        
        for page in results['pages']:
            print(f"\n--- Page {page['page_number']} ---")
            content = page['markdown_content']
            print(f"Content Length: {len(content)}")
            print(f"Preview: {content[:200]}...")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_pdf_ocr()
