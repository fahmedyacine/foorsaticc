from chatbot import DocumentChatbot
from config import get_deepseek_api_key

chatbot = DocumentChatbot(api_key=get_deepseek_api_key(), document_content="Exemple de contenu.")
print(chatbot.ask_question("Quels sont les services inclus?"))
