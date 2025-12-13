const API_BASE_URL = window.location.origin;

// DOM elements
const messagesContainer = document.getElementById('messages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const docCount = document.getElementById('docCount');

// Check if text contains Arabic characters
function isArabic(text) {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return arabicPattern.test(text);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendQuestion();
        }
    });
});

// Check server status
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/status`);
        const data = await response.json();

        if (data.documents_processed) {
            statusIndicator.classList.add('connected');
            statusText.textContent = `Connected - ${data.total_documents} document(s) loaded`;
            docCount.textContent = data.total_documents;
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'No documents loaded';
            docCount.textContent = '0';
            addSystemMessage('Warning: No documents have been processed. Please ensure documents are in the server directory.');
        }
    } catch (error) {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Connection error';
        addSystemMessage('Error: Could not connect to server. Please check if the server is running.');
    }
}

// Add message to chat
function addMessage(content, type = 'bot', language = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    if (language === 'ar' || (language === null && isArabic(content))) {
        messageDiv.classList.add('rtl');
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'message-meta';

    if (language) {
        const langBadge = document.createElement('span');
        langBadge.className = 'language-badge';
        langBadge.textContent = language.toUpperCase();
        metaDiv.appendChild(langBadge);
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = new Date().toLocaleTimeString();
    metaDiv.appendChild(timeSpan);

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(metaDiv);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}

// Add system message
function addSystemMessage(content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = `<strong>System:</strong> ${content}`;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add loading message
function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message loading';
    messageDiv.id = 'loading-message';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = 'Thinking<span class="loading-dots"></span>';

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}

// Remove loading message
function removeLoadingMessage() {
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

// Send question to API
// Send question to API
async function sendQuestion() {
    const question = questionInput.value.trim();

    if (!question) {
        return;
    }

    // Disable input while processing
    sendButton.disabled = true;
    questionInput.disabled = true;

    // Add user message
    addMessage(question, 'user');
    questionInput.value = '';

    // Add loading message
    addLoadingMessage();

    try {
        const response = await fetch(`${API_BASE_URL}/api/ask-question`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ question: question })
        });

        // Handle stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentMessageDiv = null;
        let isFirstChunk = true;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const data = JSON.parse(line);

                    if (data.type === 'meta') {
                        if (data.success) {
                            removeLoadingMessage();
                            // Create message div
                            currentMessageDiv = addMessage('', 'bot', data.language);
                        } else {
                            throw new Error(data.error || 'Unknown error');
                        }
                    } else if (data.type === 'content') {
                        if (currentMessageDiv) {
                            const contentDiv = currentMessageDiv.querySelector('.message-content');
                            contentDiv.textContent += data.content;
                            messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        }
                    } else if (data.type === 'error') {
                        throw new Error(data.error);
                    }
                } catch (e) {
                    console.error('Error parsing stream:', e);
                }
            }
        }

    } catch (error) {
        removeLoadingMessage();
        addSystemMessage(`Error: ${error.message}. Please check your connection.`);
    } finally {
        // Re-enable input
        sendButton.disabled = false;
        questionInput.disabled = false;
        questionInput.focus();
    }
}

// Auto-focus input
questionInput.focus();

