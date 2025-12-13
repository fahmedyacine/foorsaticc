"""
Utility functions for document processing
"""

from typing import Dict, Any, List


def build_document_content(results: Dict[str, Any]) -> str:
    """
    Build combined document content from processed results
    
    Args:
        results: Results dictionary from DocumentProcessor
        
    Returns:
        Combined markdown content from all documents
    """
    content = ""
    for doc in results.get("documents", []):
        content += f"\n\n=== Document: {doc['filename']} ===\n\n"
        for page in doc.get("pages", []):
            content += f"\n--- Page {page['page_number']} ---\n"
            content += page['markdown_content']
    return content


def create_error_response(message: str, status_code: int = 400) -> tuple:
    """
    Create standardized error response
    
    Args:
        message: Error message
        status_code: HTTP status code
        
    Returns:
        Tuple of (jsonify response, status_code)
    """
    from flask import jsonify
    return jsonify({"success": False, "error": message}), status_code


def create_success_response(data: Dict[str, Any], status_code: int = 200) -> tuple:
    """
    Create standardized success response
    
    Args:
        data: Response data
        status_code: HTTP status code
        
    Returns:
        Tuple of (jsonify response, status_code)
    """
    from flask import jsonify
    response = {"success": True, **data}
    return jsonify(response), status_code

