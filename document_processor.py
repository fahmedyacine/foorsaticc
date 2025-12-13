"""
Document Processor
Processes multiple DOCX and image-based PDF files using local OCR (Tesseract)
Returns extracted content in JSON format for chatbot integration
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import docx

class DocumentProcessor:
    """Processes DOCX and PDF documents using local tools"""
    
    # Supported file extensions
    SUPPORTED_EXTENSIONS = {'.docx', '.pdf'}
    
    def __init__(self, api_key: str = None):
        """
        Initialize the document processor
        
        Args:
            api_key: Not used for local processing, kept for compatibility
        """
        # Configuration for Tesseract/Poppler if needed
        # You might need to set tesseract_cmd if it's not in PATH
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass
    
    def process_docx(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from DOCX file"""
        print(f"DEBUG: Processing DOCX: {file_path.name}")
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        
        # DOCX doesn't have "pages" in the strict sense, treating as 1 page
        return [{
            "page_number": 1,
            "markdown_content": "\n".join(full_text)
        }]

    def process_pdf(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from PDF file (using OCR for images)"""
        print(f"DEBUG: Processing PDF: {file_path.name}")
        
        try:
            # Convert PDF to images
            print("DEBUG: Converting PDF to images...")
            images = convert_from_path(str(file_path))
            print(f"DEBUG: Converted {len(images)} pages.")
            
            pages = []
            for i, image in enumerate(images, 1):
                print(f"DEBUG: OCR Processing page {i}...")
                text = pytesseract.image_to_string(image, lang='fra+ara') # Assuming French/Arabic support needed
                # Fallback to eng/fra if ara not available or just default
                if not text.strip():
                     text = pytesseract.image_to_string(image)
                
                print(f"DEBUG: Page {i} text length: {len(text)}")
                
                pages.append({
                    "page_number": i,
                    "markdown_content": text
                })
            return pages
            
        except Exception as e:
            print(f"✗ Error during PDF processing (Check Poppler/Tesseract): {e}")
            raise

    def process_document(self, file_path: str) -> Dict[str, Any]:
        """
        Process a single document (DOCX or PDF)
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        if file_path.suffix.lower() not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")
        
        print(f"Processing: {file_path.name}")
        
        try:
            pages = []
            if file_path.suffix.lower() == '.docx':
                pages = self.process_docx(file_path)
            elif file_path.suffix.lower() == '.pdf':
                pages = self.process_pdf(file_path)
            
            result = {
                "filename": file_path.name,
                "file_path": str(file_path),
                "file_type": file_path.suffix.lower(),
                "total_pages": len(pages),
                "pages": pages
            }
            
            print(f"✓ Processed {file_path.name} ({len(pages)} pages)")
            return result
            
        except Exception as e:
            print(f"✗ Error processing {file_path.name}: {e}")
            raise
    
    def process_multiple_documents(self, file_paths: List[str]) -> Dict[str, Any]:
        """Process multiple documents"""
        results = {
            "total_documents": 0,
            "documents": []
        }
        
        for file_path in file_paths:
            try:
                document_result = self.process_document(file_path)
                results["documents"].append(document_result)
                results["total_documents"] += 1
            except Exception as e:
                print(f"✗ Skipped {file_path}: {e}")
                continue
        
        return results
    
    def process_directory(self, directory: str, recursive: bool = False) -> Dict[str, Any]:
        """Process all supported documents in a directory"""
        directory = Path(directory)
        if not directory.exists():
            raise FileNotFoundError(f"Directory not found: {directory}")
        
        file_paths = []
        if recursive:
            for ext in self.SUPPORTED_EXTENSIONS:
                file_paths.extend(directory.rglob(f"*{ext}"))
                file_paths.extend(directory.rglob(f"*{ext.upper()}"))
        else:
            for ext in self.SUPPORTED_EXTENSIONS:
                file_paths.extend(directory.glob(f"*{ext}"))
                file_paths.extend(directory.glob(f"*{ext.upper()}"))
        
        file_paths = list(set(file_paths))
        
        if not file_paths:
            print(f"No supported documents found in {directory}")
            return {"total_documents": 0, "documents": []}
        
        print(f"Found {len(file_paths)} document(s) to process")
        return self.process_multiple_documents([str(fp) for fp in file_paths])
    
    def save_results(self, results: Dict[str, Any], output_file: str):
        """Save processing results to JSON file"""
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"✓ Results saved to {output_file}")

def main():
    """Main entry point"""
    # Initialize processor (no API key needed)
    processor = DocumentProcessor()
    
    # Process all documents in current directory
    print(f"{'='*60}")
    print("Document Processor (Local) - Processing documents...")
    print(f"{'='*60}\n")
    
    # Check for Tesseract/Poppler presence (simple check)
    try:
        pytesseract.get_tesseract_version()
    except Exception:
        print("⚠ Warning: Tesseract not found. PDF OCR might fail.")
        print("  Please install Tesseract and add to PATH.")
    
    results = processor.process_directory(".", recursive=False)
    
    # Save results
    output_file = "documents_processed.json"
    processor.save_results(results, output_file)
    
    # Print summary
    print(f"\n{'='*60}")
    print("Processing Complete")
    print(f"{'='*60}")
    print(f"Total documents processed: {results['total_documents']}")
    for doc in results["documents"]:
        print(f"  - {doc['filename']}: {doc['total_pages']} pages")
    print(f"\nResults saved to: {output_file}")


if __name__ == "__main__":
    main()
