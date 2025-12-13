"""
Document Processor
Processes multiple DOCX and image-based PDF files using local OCR (Tesseract)
Advanced pipeline with OpenCV preprocessing for dashboard screenshots.
"""

import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import docx
import cv2
import numpy as np

class DocumentProcessor:
    """Processes DOCX and PDF documents using local tools"""
    
    # Supported file extensions
    SUPPORTED_EXTENSIONS = {'.docx', '.pdf'}
    
    def __init__(self, api_key: str = None):
        """
        Initialize the document processor
        """
        # Configuration for Tesseract if needed (ensure it's in PATH)
        pass
    
    def _preprocess_image(self, pil_image: Image.Image) -> np.ndarray:
        """
        Preprocess image for optimal OCR extraction.
        Steps:
        1. RGB -> BGR (OpenCV format)
        2. Grayscale
        3. Bilateral Filter (Noise Reduction)
        4. Adaptive Gaussian Thresholding
        """
        # Convert PIL Image to OpenCV format
        img_cv = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Apply Bilateral Filter for noise reduction while keeping edges sharp
        # d=9, sigmaColor=75, sigmaSpace=75 are standard efficient values
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Apply Adaptive Gaussian Thresholding
        # blockSize=31, C=2 tuned for dashboard text isolation
        thresh = cv2.adaptiveThreshold(
            filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 31, 2
        )
        
        return thresh

    def process_docx(self, file_path: Path) -> List[Dict[str, Any]]:
        """Extract text from DOCX file"""
        print(f"DEBUG: Processing DOCX: {file_path.name}")
        doc = docx.Document(file_path)
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        
        return [{
            "page_number": 1,
            "markdown_content": "\n".join(full_text)
        }]

    def process_pdf(self, file_path: Path) -> List[Dict[str, Any]]:
        """
        Extract text from PDF file using optimized OCR pipeline.
        Designed for dashboard screenshots and dense UI text.
        """
        print(f"DEBUG: Processing PDF: {file_path.name}")
        
        try:
            # 1. PDF -> Image Conversion
            # dpi=400 for high resolution capture of small dashboard text
            print("DEBUG: Converting PDF to images (DPI=400)...")
            images = convert_from_path(str(file_path), dpi=400, fmt='png')
            print(f"DEBUG: Converted {len(images)} pages.")
            
            pages = []
            
            # 3. OCR Configuration
            # --oem 3: Default engine mode
            # --psm 11: Sparse text with OSD (optimized for UI/dashboards)
            custom_config = r'--oem 3 --psm 11'
            lang = 'fra+eng' # Primary languages
            
            for i, image in enumerate(images, 1):
                print(f"DEBUG: Preprocessing page {i}...")
                
                # 2. Image Preprocessing
                processed_img = self._preprocess_image(image)
                
                print(f"DEBUG: Running OCR on page {i}...")
                text = pytesseract.image_to_string(
                    processed_img, 
                    config=custom_config, 
                    lang=lang
                )
                
                # Clean text
                cleaned_text = text.strip()
                text_len = len(cleaned_text)
                print(f"DEBUG: Page {i} extracted length: {text_len}")
                
                # 5. Validation
                if text_len < 200:
                    print(f"⚠ WARNING: Low text extraction on page {i} ({text_len} chars). Quality might be poor.")
                
                # 4. Output Structure - Always include page, even if empty/low quality
                pages.append({
                    "page_number": i,
                    "markdown_content": cleaned_text
                })
                
            return pages
            
        except Exception as e:
            print(f"✗ Error during PDF processing (Check Poppler/Tesseract/OpenCV): {e}")
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
    processor = DocumentProcessor()
    
    print(f"{'='*60}")
    print("Document Processor (Local/Advanced) - Processing documents...")
    print(f"{'='*60}\n")
    
    results = processor.process_directory(".", recursive=False)
    
    output_file = "documents_processed.json"
    processor.save_results(results, output_file)
    
    print(f"\n{'='*60}")
    print("Processing Complete")
    print(f"{'='*60}")
    print(f"Total documents processed: {results['total_documents']}")
    for doc in results["documents"]:
        print(f"  - {doc['filename']}: {doc['total_pages']} pages")
    print(f"\nResults saved to: {output_file}")


if __name__ == "__main__":
    main()
