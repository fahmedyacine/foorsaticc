
from chatbot import DocumentChatbot
from config import get_deepseek_api_key

def test_chatbot_class():
    api_key = get_deepseek_api_key()
    print(f"API Key: {api_key[:5]}...")
    
    chatbot = DocumentChatbot(api_key=api_key, document_content="Test content")
    print(f"Chatbot URL: '{chatbot.api_url}'")
    
    response = chatbot.ask_question("Hello")
    print(f"Response: {response}")

if __name__ == "__main__":
    test_chatbot_class()
