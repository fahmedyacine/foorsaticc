"""
Chatbot for answering questions based on processed documents
Answers in French or Arabic depending on the question language
"""

import json
import os
import requests
from typing import Dict, Any, Optional
import re


class DocumentChatbot:
    """
    Chatbot that answers questions based on document content
    Responds in French or Arabic depending on the question language
    """
    
    def __init__(self, api_key: str, document_content: str):
        """
        Initialize the chatbot
        
        Args:
            api_key: DeepSeek API key
            document_content: Combined content from processed documents
        """
        self.api_key = api_key
        self.api_url = "https://api.modelarts-maas.com/v2/chat/completions"
        self.document_content = document_content
        self.model = "deepseek-v3.1"
    
    def detect_language(self, text: str) -> str:
        """
        Detect if text is in Arabic or French
        
        Args:
            text: Text to analyze
            
        Returns:
            Language code: 'ar' for Arabic, 'fr' for French
        """
        # Remove whitespace and special characters for analysis
        text_clean = re.sub(r'[^\w\s]', '', text)
        text_clean = re.sub(r'\s+', '', text_clean)
        
        if not text_clean:
            return 'fr'  # Default to French if empty
        
        # Arabic Unicode ranges:
        # U+0600-U+06FF: Arabic
        # U+0750-U+077F: Arabic Supplement
        # U+08A0-U+08FF: Arabic Extended-A
        # U+FB50-U+FDFF: Arabic Presentation Forms-A
        # U+FE70-U+FEFF: Arabic Presentation Forms-B
        arabic_pattern = re.compile(r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]')
        arabic_chars = len(arabic_pattern.findall(text_clean))
        
        # If any Arabic characters are found (even one), consider it Arabic
        # This handles mixed content and ensures Arabic questions get Arabic answers
        if arabic_chars > 0:
            return 'ar'
        else:
            return 'fr'
    
    def get_language_instructions(self, language: str) -> str:
        """
        Get system instructions in the specified language
        
        Args:
            language: Language code ('ar' or 'fr')
            
        Returns:
            System message in the specified language
        """
        if language == 'ar':
            return """أنت مساعد ذكي متخصص في خدمة العملاءو الإجابة على الأسئلة بناءً على محتوى المستندات.
سأقدم لك محتوى مستندات، وعليك الإجابة على الأسئلة بناءً على هذا المحتوى فقط.

تعليمات مهمة:
1. أجب فقط بناءً على المعلومات الموجودة في المستندات
2. إذا لم تجد الإجابة في المستندات، قل "لا توجد معلومات كافية في المستندات للإجابة على هذا السؤال"
3. كن دقيقاً ومختصراً في إجاباتك
4. اذكر اسم المستند ورقم الصفحة إذا كان ذلك مفيداً
5. أجب دائماً بالعربية إذا كان السؤال بالعربية
6. قم بتنظيم الإجابة في نقاط منظمة وسليمة
7. كن ودودا في الإجابة على الأسئلة"""
        else:  # French
            return """Vous êtes un assistant intelligent spécialisé dans Service client et la réponse aux questions basées sur le contenu des documents.
Je vais vous fournir le contenu de documents, et vous devez répondre aux questions uniquement sur la base de ce contenu.

Instructions importantes:
1. Répondez uniquement en vous basant sur les informations présentes dans les documents
2. Si vous ne trouvez pas la réponse dans les documents, dites "Il n'y a pas suffisamment d'informations dans les documents pour répondre à cette question"
3. Soyez précis et concis dans vos réponses
4. Mentionnez le nom du document et le numéro de page si cela est utile
5. Répondez toujours en français si la question est en français
6. Réponder toujours en points organisés et structurés
7. Soyez toujours amical et professionnel
"""
    
    def load_document_from_json(self, json_file: str) -> str:
        """
        Load document content from processed documents JSON file
        
        Args:
            json_file: Path to JSON file with processed documents
            
        Returns:
            Combined text content from all documents
        """
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Use utility function to build content
            from utils import build_document_content
            full_text = build_document_content(data)
            
            self.document_content = full_text
            print(f"✓ Loaded {len(data.get('documents', []))} document(s) successfully")
            return full_text
            
        except Exception as e:
            print(f"✗ Error loading documents: {e}")
            return ""
    
    def ask_question(self, question: str, stream: bool = False):
        """
        Ask a question and get an answer based on document content
        
        Args:
            question: The question to ask
            stream: Whether to stream the response
            
        Returns:
            Answer string or generator if stream=True
        """
        # Detect question language
        language = self.detect_language(question)
        
        # Get language-specific instructions
        system_instructions = self.get_language_instructions(language)
        
        # Create system message with document content
        system_message = f"""{system_instructions}

Contenu des documents (Document content):
{self.document_content}"""
        
        # Prepare request
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": question}
            ],
            "stream": stream
        }
        
        try:
            # Send request with timeout
            print(f"DEBUG: Sending request to {self.api_url}")
            print(f"DEBUG: Payload stream={stream}")
            
            response = requests.post(self.api_url, headers=headers, data=json.dumps(payload), stream=stream)

            # If non-2xx, include status and body for easier debugging
            if not response.ok:
                body = response.text
                msg = f"status={response.status_code} body={body}"
                error_msg = f"Erreur de connexion à l'API: {msg}" if language == 'fr' else f"خطأ في الاتصال بـ API: {msg}"
                return error_msg

            if stream:
                def generate():
                    for line in response.iter_lines():
                        if line:
                            line_str = line.decode('utf-8')
                            if line_str.startswith("data: "):
                                data_str = line_str[6:]
                                if data_str == "[DONE]":
                                    break
                                try:
                                    data_json = json.loads(data_str)
                                    content = data_json['choices'][0]['delta'].get('content', '')
                                    if content:
                                        yield content
                                except json.JSONDecodeError:
                                    pass
                return generate()

            # Extract answer (non-streaming)
            result = response.json()
            answer = result['choices'][0]['message']['content']
            return answer

        except requests.exceptions.RequestException as e:
            error_msg = f"Erreur de connexion à l'API: {e}" if language == 'fr' else f"خطأ في الاتصال بـ API: {e}"
            return error_msg
        except Exception as e:
            error_msg = f"Erreur: {e}" if language == 'fr' else f"خطأ: {e}"
            return error_msg
    
    def process_questions_batch(self, input_json: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a batch of questions in the required format
        
        Args:
            input_json: Input JSON with team name and questions by category
            
        Returns:
            Output JSON with team name and answers by category
        """
        team_name = input_json.get("equipe", "Unknown")
        questions = input_json.get("question", {})
        
        # Create answers structure
        answers = {}
        
        # Process each category
        for category_id, category_questions in questions.items():
            answers[category_id] = {}
            
            print(f"\n🔄 Processing category: {category_id}")
            
            # Process each question
            for question_id, question_text in category_questions.items():
                # Detect language for logging
                lang = self.detect_language(question_text)
                lang_name = "Arabic" if lang == 'ar' else "French"
                print(f"  ❓ Question {question_id} ({lang_name}): {question_text[:50]}...")
                
                # Get answer
                answer = self.ask_question(question_text)
                answers[category_id][question_id] = answer
                
                print(f"  ✓ Answered")
        
        # Create output JSON
        output = {
            "team": team_name,
            "answers": answers
        }
        
        return output
    
    def save_results(self, results: Dict[str, Any], output_file: str):
        """
        Save results to JSON file
        
        Args:
            results: Results dictionary
            output_file: Path to output file
        """
        try:
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"\n✓ Results saved to {output_file}")
        except Exception as e:
            print(f"\n✗ Error saving results: {e}")


def main():
    """Example usage"""
    from config import get_deepseek_api_key
    
    # Get API key
    api_key = get_deepseek_api_key()
    if not api_key:
        print("Error: DEEPSEEK_API_KEY environment variable not set")
        print("Please set it using:")
        print("  Windows: set DEEPSEEK_API_KEY=your-api-key")
        print("  Linux/Mac: export DEEPSEEK_API_KEY='your-api-key'")
        return
    
    # Initialize chatbot
    chatbot = DocumentChatbot(api_key=api_key, document_content="")
    
    # Load documents from processed JSON
    chatbot.load_document_from_json("documents_processed.json")
    
    # Load questions
    with open("input_questions.json", "r", encoding="utf-8") as f:
        input_questions = json.load(f)
    
    # Process questions
    print("\n" + "=" * 60)
    print("🚀 Starting question processing")
    print("=" * 60)
    
    results = chatbot.process_questions_batch(input_questions)
    
    # Save results
    chatbot.save_results(results, "output_answers.json")
    
    # Display results
    print("\n" + "=" * 60)
    print("📊 Final Results")
    print("=" * 60)
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

