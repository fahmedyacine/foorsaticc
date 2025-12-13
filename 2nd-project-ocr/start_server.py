"""
Simple script to start the Flask server with dependency checks
"""

import os
import sys


def check_dependencies():
    """Check if required packages are installed"""
    try:
        import flask
        import flask_cors
        print(f"✓ Flask {flask.__version__} installed")
        print(f"✓ flask-cors installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("\nPlease install dependencies:")
        print("  pip install -r requirements.txt")
        return False


def check_api_keys():
    """Check if API keys are set"""
    from config import get_mistral_api_key, get_deepseek_api_key
    
    mistral_key = get_mistral_api_key()
    deepseek_key = get_deepseek_api_key()
    
    if mistral_key:
        print("✓ MISTRAL_API_KEY is set")
    else:
        print("⚠ Warning: MISTRAL_API_KEY not set")
    
    if deepseek_key:
        print("✓ DEEPSEEK_API_KEY is set")
    else:
        print("⚠ Warning: DEEPSEEK_API_KEY not set (needed for chatbot)")
    
    return True


if __name__ == "__main__":
    print("=" * 60)
    print("Checking server prerequisites...")
    print("=" * 60)
    
    if not check_dependencies():
        sys.exit(1)
    
    print()
    check_api_keys()
    
    print("\n" + "=" * 60)
    print("Starting Flask server...")
    print("=" * 60 + "\n")
    
    # Import and run the app
    from app import app
    
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('DEBUG', 'False').lower() == 'true'
    
    app.run(host=host, port=port, debug=debug)
