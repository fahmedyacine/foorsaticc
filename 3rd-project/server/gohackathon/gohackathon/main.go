package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ============================
// Configuration
// ============================

type Config struct {
	ModelArtsAPIKey   string `json:"modelarts_api_key"`
	MistralAPIKey     string `json:"mistral_api_key"`
	ServerPort        string `json:"server_port"`
	ModelName         string `json:"model_name"`
	MistralModel      string `json:"mistral_model"`
	MistralOCRModel   string `json:"mistral_ocr_model"`
	MistralEmbedModel string `json:"mistral_embed_model"`
}

func loadConfig() (*Config, error) {
	config := &Config{
		ModelArtsAPIKey:   os.Getenv("MODELARTS_API_KEY"),
		MistralAPIKey:     os.Getenv("MISTRAL_API_KEY"),
		ServerPort:        getEnv("PORT", "8080"),
		ModelName:         getEnv("MODEL_NAME", "deepseek-v3.1"),
		MistralModel:      getEnv("MISTRAL_MODEL", "mistral-large-latest"),
		MistralOCRModel:   getEnv("OCR_MODEL", "mistral-ocr-latest"),
		MistralEmbedModel: getEnv("MISTRAL_EMBED_MODEL", "mistral-embed"),
	}

	if config.ModelArtsAPIKey == "" {
		return nil, errors.New("MODELARTS_API_KEY not found")
	}
	if config.MistralAPIKey == "" {
		return nil, errors.New("MISTRAL_API_KEY not found")
	}

	return config, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ============================
// Document and Vector Types
// ============================

type Document struct {
	ID       string                 `json:"id"`
	Text     string                 `json:"text"`
	Metadata map[string]interface{} `json:"metadata"`
	Vector   []float64              `json:"vector,omitempty"`
	Chunks   []DocumentChunk        `json:"chunks,omitempty"`
}

type DocumentChunk struct {
	ID        string    `json:"id"`
	Text      string    `json:"text"`
	StartChar int       `json:"start_char"`
	EndChar   int       `json:"end_char"`
	Vector    []float64 `json:"vector,omitempty"`
}

type VectorStore struct {
	documents []Document
	mu        sync.RWMutex
}

func NewVectorStore() *VectorStore {
	return &VectorStore{
		documents: make([]Document, 0),
	}
}

func (vs *VectorStore) AddDocument(doc Document) {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	vs.documents = append(vs.documents, doc)
}

func (vs *VectorStore) GetAllDocuments() []Document {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.documents
}

func (vs *VectorStore) GetDocument(id string) (*Document, bool) {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	for _, doc := range vs.documents {
		if doc.ID == id {
			return &doc, true
		}
	}
	return nil, false
}

func (vs *VectorStore) DeleteDocument(id string) bool {
	vs.mu.Lock()
	defer vs.mu.Unlock()
	for i, doc := range vs.documents {
		if doc.ID == id {
			vs.documents = append(vs.documents[:i], vs.documents[i+1:]...)
			return true
		}
	}
	return false
}

func (vs *VectorStore) Search(queryVector []float64, topK int) []Document {
	vs.mu.RLock()
	defer vs.mu.RUnlock()

	if len(vs.documents) == 0 {
		return []Document{}
	}

	type scoreDoc struct {
		doc   Document
		score float64
	}

	var scores []scoreDoc

	for _, doc := range vs.documents {
		// 1. Score the document level vector (summary)
		if len(doc.Vector) > 0 {
			s := cosineSimilarity(queryVector, doc.Vector)
			scores = append(scores, scoreDoc{doc: doc, score: s})
		}

		// 2. Score each chunk
		for _, chunk := range doc.Chunks {
			if len(chunk.Vector) > 0 {
				s := cosineSimilarity(queryVector, chunk.Vector)
				// Create a transient document for the chunk result
				chunkDoc := Document{
					ID:       chunk.ID,
					Text:     chunk.Text,
					Metadata: doc.Metadata, // Inherit metadata
					Vector:   chunk.Vector,
				}
				scores = append(scores, scoreDoc{doc: chunkDoc, score: s})
			}
		}
	}

	// Sort by score descending
	// Simple bubble sort for small N or topK
	for i := 0; i < topK && i < len(scores); i++ {
		maxIdx := i
		for j := i + 1; j < len(scores); j++ {
			if scores[j].score > scores[maxIdx].score {
				maxIdx = j
			}
		}
		scores[i], scores[maxIdx] = scores[maxIdx], scores[i]
	}

	if topK > len(scores) {
		topK = len(scores)
	}

	results := make([]Document, topK)
	for i := 0; i < topK; i++ {
		results[i] = scores[i].doc
	}

	return results
}

// ============================
// Text Chunking
// ============================

type TextChunk struct {
	Text          string
	ChunkIndex    int
	TotalChunks   int
	ParentDocID   string
	StartPosition int
	EndPosition   int
}

type TextChunker struct {
	ChunkSize    int // Target chunk size in characters
	OverlapSize  int // Overlap between chunks in characters
	MinChunkSize int // Minimum chunk size to avoid tiny chunks
}

func NewTextChunker() *TextChunker {
	return &TextChunker{
		ChunkSize:    2000, // ~500 tokens
		OverlapSize:  200,  // ~50 tokens overlap
		MinChunkSize: 500,  // Don't create chunks smaller than this
	}
}

func (tc *TextChunker) ChunkText(text string, parentDocID string) []TextChunk {
	// If text is small enough, return as single chunk
	if len(text) <= tc.ChunkSize {
		return []TextChunk{
			{
				Text:          text,
				ChunkIndex:    0,
				TotalChunks:   1,
				ParentDocID:   parentDocID,
				StartPosition: 0,
				EndPosition:   len(text),
			},
		}
	}

	var chunks []TextChunk
	sentences := tc.splitIntoSentences(text)

	currentChunk := strings.Builder{}
	chunkStartPos := 0

	for i := 0; i < len(sentences); i++ {
		sentence := sentences[i]

		// If adding this sentence would exceed chunk size and we have content
		if currentChunk.Len() > 0 && currentChunk.Len()+len(sentence) > tc.ChunkSize {
			// Save current chunk
			chunks = append(chunks, TextChunk{
				Text:          strings.TrimSpace(currentChunk.String()),
				ChunkIndex:    len(chunks),
				TotalChunks:   0, // Will update at end
				ParentDocID:   parentDocID,
				StartPosition: chunkStartPos,
				EndPosition:   chunkStartPos + currentChunk.Len(),
			})

			// Start new chunk with overlap
			currentChunk.Reset()
			chunkStartPos = chunkStartPos + currentChunk.Len() - tc.OverlapSize

			// Add overlap sentences
			overlapStart := i
			overlapLen := 0
			for j := i - 1; j >= 0 && overlapLen < tc.OverlapSize; j-- {
				overlapLen += len(sentences[j])
				overlapStart = j
			}

			for j := overlapStart; j < i; j++ {
				currentChunk.WriteString(sentences[j])
			}
		}

		currentChunk.WriteString(sentence)
	}

	// Add final chunk if it has content
	if currentChunk.Len() >= tc.MinChunkSize || len(chunks) == 0 {
		chunks = append(chunks, TextChunk{
			Text:          strings.TrimSpace(currentChunk.String()),
			ChunkIndex:    len(chunks),
			TotalChunks:   0,
			ParentDocID:   parentDocID,
			StartPosition: chunkStartPos,
			EndPosition:   chunkStartPos + currentChunk.Len(),
		})
	}

	// Update total chunks count
	totalChunks := len(chunks)
	for i := range chunks {
		chunks[i].TotalChunks = totalChunks
	}

	return chunks
}

func (tc *TextChunker) splitIntoSentences(text string) []string {
	// Simple sentence splitting - split on period, question mark, exclamation mark, newlines
	var sentences []string
	var currentSentence strings.Builder

	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		currentSentence.WriteRune(r)

		// Check for sentence endings
		if r == '.' || r == '!' || r == '?' || r == '\n' {
			// Look ahead to ensure it's not an abbreviation
			if i+1 < len(runes) && (runes[i+1] == ' ' || runes[i+1] == '\n' || runes[i+1] == '\r') {
				sentence := currentSentence.String()
				if len(strings.TrimSpace(sentence)) > 0 {
					sentences = append(sentences, sentence)
				}
				currentSentence.Reset()
			}
		}

		// Also split on double newlines (paragraph breaks)
		if r == '\n' && i+1 < len(runes) && runes[i+1] == '\n' {
			sentence := currentSentence.String()
			if len(strings.TrimSpace(sentence)) > 0 {
				sentences = append(sentences, sentence)
			}
			currentSentence.Reset()
			i++ // Skip second newline
		}
	}

	// Add remaining text as final sentence
	if currentSentence.Len() > 0 {
		sentence := currentSentence.String()
		if len(strings.TrimSpace(sentence)) > 0 {
			sentences = append(sentences, sentence)
		}
	}

	return sentences
}

func cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (sqrt(normA) * sqrt(normB))
}

func sqrt(x float64) float64 {
	z := x / 2
	for i := 0; i < 10; i++ {
		z -= (z*z - x) / (2 * z)
	}
	return z
}

// ============================
// Mistral API for Document Parsing
// ============================

type MistralClient struct {
	apiKey   string
	baseURL  string
	model    string
	ocrModel string
	client   *http.Client
}

func NewMistralClient(apiKey, model, ocrModel string) *MistralClient {
	return &MistralClient{
		apiKey:   apiKey,
		baseURL:  "https://api.mistral.ai/v1",
		model:    model,
		ocrModel: ocrModel,
		client: &http.Client{
			Timeout: 300 * time.Second,
		},
	}
}

// Mistral Files API
type MistralFileResponse struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Bytes     int64  `json:"bytes"`
	CreatedAt int64  `json:"created_at"`
	Filename  string `json:"filename"`
	Purpose   string `json:"purpose"`
}

// Mistral Chat API for document parsing
type MistralMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type MistralChatRequest struct {
	Model       string           `json:"model"`
	Messages    []MistralMessage `json:"messages"`
	Temperature float64          `json:"temperature,omitempty"`
	MaxTokens   int              `json:"max_tokens,omitempty"`
	SafePrompt  bool             `json:"safe_prompt"`
}

type MistralChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// Mistral Embedding API
type MistralEmbeddingRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type MistralEmbeddingResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object    string    `json:"object"`
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
}

func (c *MistralClient) CreateEmbedding(ctx context.Context, input string) ([]float64, error) {
	// Preprocess text for better embedding quality
	processedInput := preprocessTextForEmbedding(input)

	reqBody := MistralEmbeddingRequest{
		Model: "mistral-embed",
		Input: []string{processedInput},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal embedding request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/embeddings", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create embedding request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mistral embedding request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read embedding response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mistral embedding error %d: %s", resp.StatusCode, string(body))
	}

	var result MistralEmbeddingResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse embedding response: %w", err)
	}

	if len(result.Data) == 0 {
		return nil, errors.New("no embedding returned")
	}

	embedding := result.Data[0].Embedding

	// Normalize embedding to unit vector for better cosine similarity
	embedding = normalizeVector(embedding)

	return embedding, nil
}

// preprocessTextForEmbedding cleans and normalizes text for better embedding quality
func preprocessTextForEmbedding(text string) string {
	// Remove excessive whitespace
	text = strings.Join(strings.Fields(text), " ")

	// Truncate to reasonable length (mistral-embed supports 8k tokens ~ 32k chars)
	maxChars := 30000
	if len(text) > maxChars {
		text = text[:maxChars]
	}

	return strings.TrimSpace(text)
}

// normalizeVector performs L2 normalization
func normalizeVector(vec []float64) []float64 {
	var sumSquares float64
	for _, val := range vec {
		sumSquares += val * val
	}

	if sumSquares == 0 {
		return vec
	}

	magnitude := sqrt(sumSquares)
	normalized := make([]float64, len(vec))
	for i, val := range vec {
		normalized[i] = val / magnitude
	}

	return normalized
}

// CreateEmbeddingWithContext creates embedding with additional metadata context for better matching
func (c *MistralClient) CreateEmbeddingWithContext(ctx context.Context, text string, metadata map[string]interface{}) ([]float64, error) {
	// Enrich text with contextual metadata
	enrichedText := text

	// Add title if available
	if title, ok := metadata["title"].(string); ok && title != "" {
		enrichedText = title + ". " + enrichedText
	}

	// Add source file name for context
	if source, ok := metadata["source_file"].(string); ok && source != "" {
		enrichedText = "[Source: " + source + "] " + enrichedText
	}

	return c.CreateEmbedding(ctx, enrichedText)
}

// CreateArabicEnrichedEmbedding creates enhanced embeddings for Arabic queries with expansion
func (c *MistralClient) CreateArabicEnrichedEmbedding(ctx context.Context, text string) ([]float64, error) {
	// Expand Arabic text with common synonyms and related terms
	expandedText := expandArabicQuery(text)

	return c.CreateEmbedding(ctx, expandedText)
}

// expandArabicQuery adds semantic context to Arabic queries
func expandArabicQuery(query string) string {
	// Common Arabic business/telecom terms and their variations
	arabicExpansions := map[string][]string{
		"عرض":       {"عروض", "تقديم", "باقة"},       // Offer
		"سعر":       {"أسعار", "تسعير", "تكلفة"},     // Price
		"خدمة":      {"خدمات", "تقديم خدمة"},         // Service
		"انترنت":    {"إنترنت", "انترنيت", "الشبكة"}, // Internet
		"هاتف":      {"جوال", "موبايل"},              // Phone
		"باقة":      {"باقات", "حزمة"},               // Package
		"اشتراك":    {"اشتراكات", "تسجيل"},           // Subscription
		"شهر":       {"شهري", "شهرية"},               // Month
		"سنة":       {"سنوي", "سنوية"},               // Year
		"مجاني":     {"مجانا", "بدون مقابل"},         // Free
		"تخفيض":     {"خصم", "تنزيلات"},              // Discount
		"عميل":      {"عملاء", "زبون"},               // Client
		"جديد":      {"جديدة", "حديث"},               // New
		"سرعة":      {"سريع", "فائق السرعة"},         // Speed
		"غير محدود": {"لا محدود", "بلا حدود"},        // Unlimited
	}

	// Build expanded query
	expanded := query

	// Normalize query for matching
	normalizedQuery := normalizeArabic(query)

	// Add related terms
	for term, expansions := range arabicExpansions {
		normalizedTerm := normalizeArabic(term)
		if strings.Contains(normalizedQuery, normalizedTerm) {
			// Add top 2 most relevant expansions
			for i := 0; i < 2 && i < len(expansions); i++ {
				expanded += " " + expansions[i]
			}
		}
	}

	return expanded
}

// normalizeArabic performs basic normalization for Arabic text by removing diacritics and standardizing characters.
// This is a simplified version and might need more comprehensive rules for production use.
func normalizeArabic(text string) string {
	// Remove Tatweel (U+0640)
	text = strings.ReplaceAll(text, "\u0640", "")
	// Remove diacritics (tashkeel)
	text = regexp.MustCompile(`[\u064B-\u0652]`).ReplaceAllString(text, "")
	// Standardize Alef variants to simple Alef (U+0627)
	text = strings.ReplaceAll(text, "\u0623", "\u0627") // Alef with Hamza Above
	text = strings.ReplaceAll(text, "\u0625", "\u0627") // Alef with Hamza Below
	text = strings.ReplaceAll(text, "\u0622", "\u0627") // Alef with Madda Above
	// Standardize Yeh variants to simple Yeh (U+064A)
	text = strings.ReplaceAll(text, "\u0649", "\u064A") // Alef Maksura to Yeh
	// Standardize Teh Marbuta to Heh (U+0647) if needed, but often kept distinct for meaning
	// For search, sometimes it's useful to treat them similarly. Let's keep it for now.
	// text = strings.ReplaceAll(text, "\u0629", "\u0647") // Teh Marbuta to Heh

	// Remove extra spaces
	text = strings.Join(strings.Fields(text), " ")
	return strings.TrimSpace(text)
}

// containsArabic checks if text contains Arabic characters
func containsArabic(text string) bool {
	for _, r := range text {
		// Arabic Unicode range: U+0600 to U+06FF
		if r >= '\u0600' && r <= '\u06FF' {
			return true
		}
	}
	return false
}

// ProcessFileWithMistral processes files using Mistral API
func (c *MistralClient) ProcessFileWithMistral(ctx context.Context, filePath string) (string, error) {
	// For text files, read directly
	ext := strings.ToLower(filepath.Ext(filePath))
	if ext == ".txt" || ext == ".md" {
		content, err := os.ReadFile(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to read text file: %w", err)
		}
		return string(content), nil
	}

	// Read file content
	fileContent, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Prepare base64 content for Mistral
	base64Content := base64.StdEncoding.EncodeToString(fileContent)
	mimeType := getMimeType(ext)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Content)

	// Create messages for Mistral with Arabic-optimized instructions
	messages := []MistralMessage{
		{
			Role:    "system",
			Content: "You are an expert multilingual document parser specializing in Arabic (العربية), French, and English. Extract all content with perfect accuracy.",
		},
		{
			Role: "user",
			Content: fmt.Sprintf(`Extract ALL text from this %s document ("%s") FROM START TO END.

CRITICAL INSTRUCTIONS:
- Extract EVERY word, number, symbol, table cell, header, footer, caption
- Process the ENTIRE document from first page to last page
- Do NOT stop early - continue extraction until you reach the end
- Support ALL languages: Arabic (العربية), French (Français), English, etc.
- For ARABIC text: preserve right-to-left (RTL) content exactly as it appears
- For MIXED LANGUAGES: keep all languages in their original form
- Do NOT summarize or paraphrase ANY content
- Do NOT skip any content - include everything you can see
- For TABLES: preserve ALL rows and columns in markdown format
- For LISTS: include all items
- For IMAGES/CHARTS: describe what you see in brackets like [Chart showing XYZ]
- Maintain document structure with markdown headers (# ## ###)
- Include page numbers if visible

ARABIC LANGUAGE SPECIFIC (تعليمات خاصة باللغة العربية):
- Extract Arabic text exactly as written (استخرج النص العربي تمامًا كما هو مكتوب)
- Include ALL Arabic diacritics/tashkeel if present (شكل، تنوين، إلخ)
- Preserve Arabic numerals (١٢٣) and Western numerals (123) as they appear
- For Arabic tables: extract right-to-left, preserving all cells
- For Arabic headers: use markdown # with Arabic text
- For Arabic lists: include all bullet points and numbering (أ، ب، ج or ١، ٢، ٣)
- Extract footnotes and references in Arabic completely
- Common Arabic terms to ensure extraction: عرض، سعر، تاريخ، معلومات، خدمات، منتجات

MULTILINGUAL HANDLING:
- If document contains Arabic (العربية), extract it completely from start to finish
- If document contains French, extract it completely from start to finish
- If document is mixed language, extract ALL languages from start to finish
- Preserve numerical values in original format (Arabic numerals, etc.)

IMPORTANT: Extract until you reach the END of the document. Do not stop partway through.

Return ONLY the extracted text in clean markdown format.
Extract as much as physically possible - more is better than less.

Document:`, ext, filepath.Base(filePath)),
		},
	}

	// Add document as base64
	if mimeType != "" {
		messages = append(messages, MistralMessage{
			Role: "user",
			Content: fmt.Sprintf(`Here is the document content in base64 format (MIME type: %s):
%s`, mimeType, dataURL),
		})
	}

	// Determine which model to use
	model := c.model
	if isOCRFile(ext) {
		model = c.ocrModel
	}

	reqBody := MistralChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.0,
		SafePrompt:  false,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("mistral API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		// Try alternative approach - use file upload
		log.Printf("Mistral chat parsing failed (status %d), trying file upload", resp.StatusCode)
		return c.parseViaFileUpload(ctx, filePath)
	}

	var mistralResp MistralChatResponse
	if err := json.Unmarshal(body, &mistralResp); err != nil {
		return "", fmt.Errorf("failed to parse mistral response: %w", err)
	}

	if len(mistralResp.Choices) == 0 {
		return "", errors.New("no content returned from mistral")
	}

	extractedJSON := mistralResp.Choices[0].Message.Content

	// Convert JSON extraction to searchable text
	// We'll keep the JSON for metadata but also create a comprehensive text version
	comprehensiveText := convertJSONExtractionToText(extractedJSON)

	return comprehensiveText, nil
}

// parseViaFileUpload uploads file to Mistral and parses it
func (c *MistralClient) parseViaFileUpload(ctx context.Context, filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	// Create multipart request
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file
	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return "", fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return "", fmt.Errorf("failed to copy file data: %w", err)
	}

	// Add purpose
	err = writer.WriteField("purpose", "batch")
	if err != nil {
		return "", fmt.Errorf("failed to add purpose field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return "", fmt.Errorf("failed to close writer: %w", err)
	}

	// Upload file
	uploadReq, err := http.NewRequest("POST", c.baseURL+"/files", body)
	if err != nil {
		return "", fmt.Errorf("failed to create upload request: %w", err)
	}

	uploadReq.Header.Set("Content-Type", writer.FormDataContentType())
	uploadReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	uploadResp, err := c.client.Do(uploadReq)
	if err != nil {
		return "", fmt.Errorf("upload request failed: %w", err)
	}
	defer uploadResp.Body.Close()

	uploadBody, err := io.ReadAll(uploadResp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read upload response: %w", err)
	}

	if uploadResp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("file upload failed (status %d): %s", uploadResp.StatusCode, string(uploadBody))
	}

	var fileResp MistralFileResponse
	if err := json.Unmarshal(uploadBody, &fileResp); err != nil {
		return "", fmt.Errorf("failed to parse upload response: %w", err)
	}

	log.Printf("File uploaded to Mistral with ID: %s", fileResp.ID)

	// Use chat API with file reference
	chatMessages := []MistralMessage{
		{
			Role:    "user",
			Content: "Analyze this uploaded document. Extract ALL content including text, images, and tables. Convert tables to Markdown format. Preserve all numerical data and structure. Return ONLY the extracted content in Markdown.",
		},
	}

	model := c.model
	if isOCRFile(filepath.Ext(filePath)) {
		model = c.ocrModel
	}

	chatReqBody := MistralChatRequest{
		Model:       model,
		Messages:    chatMessages,
		Temperature: 0.0,
		SafePrompt:  false,
	}

	chatJson, err := json.Marshal(chatReqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal chat request: %w", err)
	}

	chatReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/chat/completions", bytes.NewBuffer(chatJson))
	if err != nil {
		return "", fmt.Errorf("failed to create chat request: %w", err)
	}

	chatReq.Header.Set("Content-Type", "application/json")
	chatReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	chatReq.Header.Set("X-File-ID", fileResp.ID) // Custom header for file reference

	chatResp, err := c.client.Do(chatReq)
	if err != nil {
		return "", fmt.Errorf("chat request failed: %w", err)
	}
	defer chatResp.Body.Close()

	chatBody, err := io.ReadAll(chatResp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read chat response: %w", err)
	}

	if chatResp.StatusCode != http.StatusOK {
		// Fallback to local text extraction
		return extractTextFallback(filePath)
	}

	var mistralChatResp MistralChatResponse
	if err := json.Unmarshal(chatBody, &mistralChatResp); err != nil {
		return extractTextFallback(filePath)
	}

	if len(mistralChatResp.Choices) == 0 {
		return extractTextFallback(filePath)
	}

	return mistralChatResp.Choices[0].Message.Content, nil
}

// convertJSONExtractionToText converts the JSON extraction to comprehensive searchable text
func convertJSONExtractionToText(jsonStr string) string {
	// Try to parse the JSON
	var extraction struct {
		DocumentSummary    string                   `json:"document_summary"`
		Entities           []map[string]interface{} `json:"entities"`
		Lines              []map[string]interface{} `json:"lines"`
		MissingExtractions []string                 `json:"missing_extractions"`
		NotesOnUncertainty string                   `json:"notes_on_uncertainty"`
	}

	// If JSON parsing fails, return the raw content
	if err := json.Unmarshal([]byte(jsonStr), &extraction); err != nil {
		log.Printf("Failed to parse JSON extraction, using raw content: %v", err)
		return jsonStr
	}

	var result strings.Builder

	// Add document summary
	if extraction.DocumentSummary != "" {
		result.WriteString("DOCUMENT SUMMARY:\n")
		result.WriteString(extraction.DocumentSummary)
		result.WriteString("\n\n")
	}

	// Add all line content in order
	result.WriteString("FULL TEXT CONTENT:\n")
	for _, line := range extraction.Lines {
		if text, ok := line["text"].(string); ok {
			result.WriteString(text)
			result.WriteString("\n")
		}

		// Add extracted facts from each line
		if facts, ok := line["extracted_facts"].([]interface{}); ok {
			for _, fact := range facts {
				if factStr, ok := fact.(string); ok {
					result.WriteString("  [FACT: " + factStr + "]\n")
				}
			}
		}
	}
	result.WriteString("\n")

	// Add structured entities
	result.WriteString("EXTRACTED ENTITIES:\n")
	for _, entity := range extraction.Entities {
		if name, ok := entity["name"].(string); ok {
			if value, ok := entity["value"].(string); ok {
				entityType := "unknown"
				if t, ok := entity["type"].(string); ok {
					entityType = t
				}
				result.WriteString(fmt.Sprintf("- %s (%s): %s\n", name, entityType, value))
				if context, ok := entity["context"].(string); ok && context != "" {
					result.WriteString(fmt.Sprintf("  Context: %s\n", context))
				}
			}
		}
	}
	result.WriteString("\n")

	// Add missing extractions if any
	if len(extraction.MissingExtractions) > 0 {
		result.WriteString("POTENTIALLY MISSING CONTENT:\n")
		for _, missing := range extraction.MissingExtractions {
			result.WriteString("- " + missing + "\n")
		}
		result.WriteString("\n")
	}

	// Add uncertainty notes
	if extraction.NotesOnUncertainty != "" {
		result.WriteString("NOTES ON UNCERTAINTY:\n")
		result.WriteString(extraction.NotesOnUncertainty)
		result.WriteString("\n")
	}

	return result.String()
}

func getMimeType(ext string) string {
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".doc":
		return "application/msword"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".txt":
		return "text/plain"
	default:
		return "application/octet-stream"
	}
}

func isOCRFile(ext string) bool {
	ext = strings.ToLower(ext)
	switch ext {
	// PDF and Images require OCR or vision capabilities
	case ".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif", ".webp":
		return true
	default:
		return false
	}
}

func extractTextFallback(filePath string) (string, error) {
	// Simple fallback for text files
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Try to extract as text
	str := string(content)

	// Remove null bytes and non-printable characters
	var result strings.Builder
	for _, r := range str {
		if r >= 32 || r == '\n' || r == '\t' {
			result.WriteRune(r)
		}
	}

	text := result.String()
	if len(strings.TrimSpace(text)) < 10 {
		return "", errors.New("could not extract meaningful text from file")
	}

	return text, nil
}

// ============================
// ModelArts API (DeepSeek) for Chat Completion
// ============================

type ModelArtsClient struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

func NewModelArtsClient(apiKey, model string) *ModelArtsClient {
	return &ModelArtsClient{
		apiKey:  apiKey,
		baseURL: "https://api.modelarts-maas.com/v2",
		model:   model,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// Chat Completion API
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionRequest struct {
	Model     string        `json:"model"`
	Messages  []ChatMessage `json:"messages"`
	Stream    bool          `json:"stream"`
	MaxTokens int           `json:"max_tokens,omitempty"`
}

type ChatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

func (c *ModelArtsClient) CreateChatCompletion(ctx context.Context, messages []ChatMessage, maxTokens int) (string, error) {
	url := c.baseURL + "/chat/completions"

	reqBody := ChatCompletionRequest{
		Model:     c.model,
		Messages:  messages,
		Stream:    false,
		MaxTokens: maxTokens,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ModelArts API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ModelArts API error (%d): %s", resp.StatusCode, string(body))
	}

	var chatResp ChatCompletionResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", errors.New("no completion choices in response")
	}

	return chatResp.Choices[0].Message.Content, nil
}

// ============================
// RAG Engine
// ============================

type RAGEngine struct {
	modelArtsClient *ModelArtsClient
	mistralClient   *MistralClient
	vectorStore     *VectorStore
	uploadTempDir   string
	chunker         *TextChunker
}

func NewRAGEngine(modelArtsClient *ModelArtsClient, mistralClient *MistralClient) *RAGEngine {
	tempDir := "uploads"
	os.MkdirAll(tempDir, 0755)

	return &RAGEngine{
		modelArtsClient: modelArtsClient,
		mistralClient:   mistralClient,
		vectorStore:     NewVectorStore(),
		uploadTempDir:   tempDir,
		chunker:         NewTextChunker(),
	}
}

func (r *RAGEngine) AddTextDocument(ctx context.Context, id, text string, metadata map[string]interface{}) error {
	// Parse metadata if present in frontmatter
	parsedMeta, content := parseMetadata(text)

	// Merge metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	for k, v := range parsedMeta {
		metadata[k] = v
	}

	// Calculate document-level embedding (summary embedding)
	// We use the summary + title for the doc-level embedding if available, or first 1000 chars
	summaryText := content
	if summary, ok := metadata["summary"].(string); ok {
		summaryText = fmt.Sprintf("%s: %s", metadata["title"], summary)
	} else if len(content) > 1000 {
		summaryText = content[:1000]
	}

	docEmbedding, err := r.mistralClient.CreateEmbedding(ctx, summaryText)
	if err != nil {
		return fmt.Errorf("failed to create doc embedding: %w", err)
	}

	// Split detailed content into chunks
	chunks := splitTextIntoChunks(content, 1000) // ~1000 chars per chunk
	docChunks := make([]DocumentChunk, 0, len(chunks))

	for i, chunkText := range chunks {
		chunkEmbedding, err := r.mistralClient.CreateEmbedding(ctx, chunkText)
		if err != nil {
			log.Printf("Failed to embed chunk %d: %v", i, err)
			continue
		}

		docChunks = append(docChunks, DocumentChunk{
			ID:        fmt.Sprintf("%s-chunk-%d", id, i),
			Text:      chunkText,
			StartChar: 0, // Simplified for now
			EndChar:   0,
			Vector:    chunkEmbedding,
		})
	}

	doc := Document{
		ID:       id,
		Text:     content,
		Metadata: metadata,
		Vector:   docEmbedding,
		Chunks:   docChunks,
	}
	r.vectorStore.AddDocument(doc)
	log.Printf("Added text document %s with %d chunks", id, len(docChunks))
	return nil
}

// splitTextIntoChunks splits text by headers or size
func splitTextIntoChunks(text string, maxChars int) []string {
	var chunks []string
	lines := strings.Split(text, "\n")
	currentChunk := strings.Builder{}

	for _, line := range lines {
		// If line is a header or adding it exceeds max chars, start new chunk
		if (strings.HasPrefix(line, "#") || currentChunk.Len()+len(line) > maxChars) && currentChunk.Len() > 0 {
			chunks = append(chunks, currentChunk.String())
			currentChunk.Reset()
		}
		currentChunk.WriteString(line + "\n")
	}
	if currentChunk.Len() > 0 {
		chunks = append(chunks, currentChunk.String())
	}
	return chunks
}

// parseMetadata extracts YAML frontmatter
func parseMetadata(text string) (map[string]interface{}, string) {
	meta := make(map[string]interface{})
	content := text

	if strings.HasPrefix(strings.TrimSpace(text), "---") {
		parts := strings.SplitN(text, "---", 3)
		if len(parts) >= 3 {
			yamlPart := parts[1]
			content = parts[2]

			// Simple line-based YAML parser
			lines := strings.Split(yamlPart, "\n")
			for _, line := range lines {
				if strings.Contains(line, ":") {
					kv := strings.SplitN(line, ":", 2)
					key := strings.TrimSpace(kv[0])
					val := strings.TrimSpace(kv[1])
					// Handle basic types
					if strings.HasPrefix(val, "[") && strings.HasSuffix(val, "]") {
						// list
						meta[key] = strings.Split(strings.Trim(val, "[]"), ",")
					} else {
						meta[key] = val
					}
				}
			}
		}
	}
	return meta, strings.TrimSpace(content)
}

func (r *RAGEngine) AddFileDocument(ctx context.Context, id, filePath string, metadata map[string]interface{}) error {
	log.Printf("Processing file with Mistral API: %s", filePath)

	// Extract text using Mistral API
	text, err := r.mistralClient.ProcessFileWithMistral(ctx, filePath)
	if err != nil {
		return fmt.Errorf("failed to extract text with Mistral: %w", err)
	}

	log.Printf("✓ Extracted %d characters from %s", len(text), filepath.Base(filePath))

	// Display parsed content in terminal
	log.Println("========================================")
	log.Printf("PARSED CONTENT FROM: %s", filepath.Base(filePath))
	log.Println("========================================")

	// Show full content
	fmt.Println(text)

	log.Println("========================================")
	log.Printf("END OF PARSED CONTENT")
	log.Println("========================================")

	// Add metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	metadata["source_file"] = filepath.Base(filePath)
	metadata["file_type"] = filepath.Ext(filePath)
	metadata["extraction_date"] = time.Now().Format(time.RFC3339)
	metadata["parsed_with"] = "Mistral API"

	// Get file size
	if info, err := os.Stat(filePath); err == nil {
		metadata["file_size"] = info.Size()
	}

	// Add to vector store
	return r.AddTextDocument(ctx, id, text, metadata)
}

func (r *RAGEngine) Query(ctx context.Context, question string, topK int) (string, error) {
	// Create embedding for the question with Arabic enhancement if applicable
	var queryEmbedding []float64
	var err error

	if containsArabic(question) {
		// Use Arabic-enriched embedding with query expansion
		queryEmbedding, err = r.mistralClient.CreateArabicEnrichedEmbedding(ctx, question)
		log.Printf("Using Arabic-enriched embedding for query: %s", question)
	} else {
		queryEmbedding, err = r.mistralClient.CreateEmbedding(ctx, question)
	}

	if err != nil {
		return "", fmt.Errorf("failed to create query embedding: %w", err)
	}

	// Search for relevant documents
	relevantDocs := r.vectorStore.Search(queryEmbedding, topK)

	// Build context
	var contextBuilder strings.Builder
	contextBuilder.WriteString("You are a helpful assistant. Answer the question based ONLY on the provided context. If the context doesn't contain relevant information, say 'I don't have enough information to answer this question based on the provided context.'\n\n")

	if len(relevantDocs) == 0 {
		contextBuilder.WriteString("Context: No relevant documents found.\n\n")
	} else {
		contextBuilder.WriteString("Context documents:\n")
		for i, doc := range relevantDocs {
			metaInfo := ""
			if title, ok := doc.Metadata["title"].(string); ok && title != "" {
				metaInfo = fmt.Sprintf(" (Title: %s)", title)
			} else if source, ok := doc.Metadata["source_file"].(string); ok && source != "" {
				metaInfo = fmt.Sprintf(" (Source: %s)", source)
			}

			text := doc.Text
			if len(text) > 2000 {
				text = text[:2000] + "... [truncated]"
			}

			contextBuilder.WriteString(fmt.Sprintf("Document %d%s: %s\n\n", i+1, metaInfo, text))
		}
	}

	contextBuilder.WriteString(fmt.Sprintf("Question: %s\n\nAnswer based on the context above:", question))

	// Generate answer using ModelArts (DeepSeek) API
	messages := []ChatMessage{
		{
			Role:    "system",
			Content: contextBuilder.String(),
		},
	}

	answer, err := r.modelArtsClient.CreateChatCompletion(ctx, messages, 1000)
	if err != nil {
		return "", fmt.Errorf("failed to generate answer: %w", err)
	}

	return answer, nil
}

// ============================
// HTTP Handlers
// ============================

type AddTextDocumentRequest struct {
	ID       string                 `json:"id"`
	Text     string                 `json:"text"`
	Metadata map[string]interface{} `json:"metadata"`
}

type AddFileDocumentRequest struct {
	ID       string                 `json:"id"`
	FilePath string                 `json:"file_path"`
	Metadata map[string]interface{} `json:"metadata"`
}

type QueryRequest struct {
	Question string `json:"question"`
	TopK     int    `json:"top_k"`
}

type QueryResponse struct {
	Answer string `json:"answer"`
}

type ExtractRequest struct {
	FilePath string `json:"file_path"`
}

type ExtractResponse struct {
	Text     string                 `json:"text"`
	Length   int                    `json:"length"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type DocumentResponse struct {
	ID       string                 `json:"id"`
	Metadata map[string]interface{} `json:"metadata"`
	Text     string                 `json:"text,omitempty"`
}

type StatusResponse struct {
	Status         string `json:"status"`
	Documents      int    `json:"documents"`
	Service        string `json:"service"`
	ModelArtsModel string `json:"modelarts_model"`
	MistralModel   string `json:"mistral_model"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Failed to write JSON response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, ErrorResponse{Error: message})
}

// Batch Question Processing Structures
type BatchQuestionRequest struct {
	Equipe   string                       `json:"equipe"`
	Question map[string]map[string]string `json:"question"` // category_id -> question_id -> question
}

type BatchQuestionResponse struct {
	Equipe   string                       `json:"equipe"`
	Reponses map[string]map[string]string `json:"reponses"` // offer_name -> question_id -> answer
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	config, err := loadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting RAG API with ModelArts (%s) and Mistral (%s)", config.ModelName, config.MistralModel)

	// Initialize API clients
	modelArtsClient := NewModelArtsClient(config.ModelArtsAPIKey, config.ModelName)
	mistralClient := NewMistralClient(config.MistralAPIKey, config.MistralModel, config.MistralOCRModel)

	// Test ModelArts API
	log.Println("Testing ModelArts API connection...")
	testCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	testMessages := []ChatMessage{
		{Role: "system", Content: "You are a helpful assistant."},
		{Role: "user", Content: "Say 'API test successful' if you can read this."},
	}

	response, err := modelArtsClient.CreateChatCompletion(testCtx, testMessages, 50)
	if err != nil {
		log.Printf("ModelArts API test warning: %v", err)
		log.Printf("ModelArts API may not be responding, but server will still start")
	} else {
		log.Printf("ModelArts API connection successful! Response: %s", response)
	}

	ragEngine := NewRAGEngine(modelArtsClient, mistralClient)

	// HTTP Handlers
	http.HandleFunc("/health", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		docs := ragEngine.vectorStore.GetAllDocuments()
		writeJSON(w, http.StatusOK, StatusResponse{
			Status:         "healthy",
			Documents:      len(docs),
			Service:        "rag-api",
			ModelArtsModel: config.ModelName,
			MistralModel:   config.MistralModel,
		})
	}))

	http.HandleFunc("/documents/text", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req AddTextDocumentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
			return
		}

		if req.ID == "" || req.Text == "" {
			writeError(w, http.StatusBadRequest, "ID and Text are required")
			return
		}

		if err := ragEngine.AddTextDocument(r.Context(), req.ID, req.Text, req.Metadata); err != nil {
			log.Printf("Error adding text document: %v", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"message": "Text document added successfully",
			"id":      req.ID,
			"length":  len(req.Text),
		})
	}))

	// New endpoint for file uploads from frontend
	http.HandleFunc("/upload", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Upload endpoint called: Method=%s, Path=%s", r.Method, r.URL.Path)
		if r.Method != "POST" {
			log.Printf("Method not allowed: %s", r.Method)
			writeError(w, http.StatusMethodNotAllowed, fmt.Sprintf("Method not allowed: %s. Expected POST.", r.Method))
			return
		}

		// Parse multipart form (max 50MB)
		err := r.ParseMultipartForm(50 << 20) // 50MB
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to parse multipart form: %v", err))
			return
		}

		// Get the file from the form
		file, handler, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Failed to get file: %v", err))
			return
		}
		defer file.Close()

		// Get optional metadata
		id := r.FormValue("id")
		if id == "" {
			id = fmt.Sprintf("doc-%d-%s", time.Now().Unix(), handler.Filename)
		}

		// Create uploads directory if it doesn't exist
		uploadDir := "uploads"
		os.MkdirAll(uploadDir, 0755)

		// Save file to uploads folder
		filePath := filepath.Join(uploadDir, handler.Filename)
		
		// Handle duplicate filenames
		if _, err := os.Stat(filePath); err == nil {
			// File exists, add timestamp
			ext := filepath.Ext(handler.Filename)
			name := strings.TrimSuffix(handler.Filename, ext)
			filePath = filepath.Join(uploadDir, fmt.Sprintf("%s_%d%s", name, time.Now().Unix(), ext))
		}

		dst, err := os.Create(filePath)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create file: %v", err))
			return
		}
		defer dst.Close()

		// Copy uploaded file to destination
		_, err = io.Copy(dst, file)
		if err != nil {
			writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to save file: %v", err))
			return
		}

		log.Printf("File uploaded successfully: %s", filePath)

		// Parse metadata if provided
		var metadata map[string]interface{}
		metadataStr := r.FormValue("metadata")
		if metadataStr != "" {
			if err := json.Unmarshal([]byte(metadataStr), &metadata); err != nil {
				log.Printf("Warning: Failed to parse metadata: %v", err)
				metadata = make(map[string]interface{})
			}
		} else {
			metadata = make(map[string]interface{})
		}

		// Add file info to metadata
		metadata["source_file"] = handler.Filename
		metadata["file_type"] = filepath.Ext(handler.Filename)
		metadata["file_size"] = handler.Size
		metadata["uploaded_at"] = time.Now().Format(time.RFC3339)

		// Process the file using existing RAG engine
		ctx, cancel := context.WithTimeout(r.Context(), 180*time.Second)
		defer cancel()

		if err := ragEngine.AddFileDocument(ctx, id, filePath, metadata); err != nil {
			log.Printf("Error processing uploaded file: %v", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"message":  "File uploaded and processed successfully",
			"id":       id,
			"file":     filePath,
			"filename": handler.Filename,
			"parser":   "Mistral API",
		})
	}))

	http.HandleFunc("/documents/file", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req AddFileDocumentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
			return
		}

		if req.ID == "" || req.FilePath == "" {
			writeError(w, http.StatusBadRequest, "ID and FilePath are required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 180*time.Second)
		defer cancel()

		if err := ragEngine.AddFileDocument(ctx, req.ID, req.FilePath, req.Metadata); err != nil {
			log.Printf("Error adding file document: %v", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"message": "File document processed and added successfully",
			"id":      req.ID,
			"file":    req.FilePath,
			"parser":  "Mistral API",
		})
	}))

	http.HandleFunc("/extract", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req ExtractRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
			return
		}

		if req.FilePath == "" {
			writeError(w, http.StatusBadRequest, "FilePath is required")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 180*time.Second)
		defer cancel()

		text, err := mistralClient.ProcessFileWithMistral(ctx, req.FilePath)
		if err != nil {
			log.Printf("Mistral extraction failed: %v", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		// Get file info
		fileInfo, _ := os.Stat(req.FilePath)
		metadata := map[string]interface{}{
			"file_path": req.FilePath,
			"file_name": filepath.Base(req.FilePath),
			"file_type": filepath.Ext(req.FilePath),
			"parser":    "Mistral API",
		}

		if fileInfo != nil {
			metadata["file_size"] = fileInfo.Size()
		}

		writeJSON(w, http.StatusOK, ExtractResponse{
			Text:     text,
			Length:   len(text),
			Metadata: metadata,
		})
	}))

	http.HandleFunc("/documents", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			docs := ragEngine.vectorStore.GetAllDocuments()
			includeText := r.URL.Query().Get("include_text") == "true"

			response := make([]DocumentResponse, len(docs))
			for i, doc := range docs {
				resp := DocumentResponse{
					ID:       doc.ID,
					Metadata: doc.Metadata,
				}
				if includeText && len(doc.Text) > 0 {
					if len(doc.Text) > 500 {
						resp.Text = doc.Text[:500] + "..."
					} else {
						resp.Text = doc.Text
					}
				}
				response[i] = resp
			}
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"documents": response,
				"count":     len(docs),
			})

		case "DELETE":
			ragEngine.vectorStore = NewVectorStore()
			writeJSON(w, http.StatusOK, map[string]interface{}{
				"message": "All documents deleted",
				"count":   0,
			})

		default:
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		}
	}))

	http.HandleFunc("/query", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req QueryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
			return
		}

		if req.Question == "" {
			writeError(w, http.StatusBadRequest, "Question is required")
			return
		}

		if req.TopK <= 0 {
			req.TopK = 3
		}

		ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
		defer cancel()

		answer, err := ragEngine.Query(ctx, req.Question, req.TopK)
		if err != nil {
			log.Printf("Error processing query: %v", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		writeJSON(w, http.StatusOK, QueryResponse{Answer: answer})
	}))
	http.HandleFunc("/", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"service":  "RAG API Server",
			"version":  "1.0.0",
			"deepseek": config.ModelName,
			"mistral":  config.MistralModel,
			"endpoints": map[string]string{
				"GET /health":           "Health check",
				"GET /documents":        "List all documents",
				"POST /documents/text":  "Add a text document",
				"POST /documents/file":  "Add a file document (parsed with Mistral)",
				"POST /upload":          "Upload file from frontend (multipart/form-data)",
				"POST /extract":         "Extract text from file using Mistral",
				"POST /query":           "Query the RAG system (uses DeepSeek)",
				"POST /batch-questions": "Process batch questions and group by offer",
				"DELETE /documents":     "Delete all documents",
			},
		})
	}))

	// Batch Questions endpoint
	http.HandleFunc("/batch-questions", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
			return
		}

		var req BatchQuestionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
			return
		}

		if req.Equipe == "" {
			writeError(w, http.StatusBadRequest, "Equipe is required")
			return
		}

		// Process all questions and group by offer
		reponses := make(map[string]map[string]string)

		for categoryID, questions := range req.Question {
			log.Printf("Processing category %s with %d questions", categoryID, len(questions))

			for questionID, question := range questions {
				// Query the RAG engine
				answer, err := ragEngine.Query(r.Context(), question, 3)
				if err != nil {
					log.Printf("Error answering question %s: %v", questionID, err)
					answer = "Une erreur s'est produite lors du traitement de cette question."
				}

				// Extract offer name from context
				offerName := extractOfferName(answer, question)

				// Initialize offer map if needed
				if reponses[offerName] == nil {
					reponses[offerName] = make(map[string]string)
				}

				// Store answer
				reponses[offerName][questionID] = answer
			}
		}

		// Build response
		response := BatchQuestionResponse{
			Equipe:   req.Equipe,
			Reponses: reponses,
		}

		writeJSON(w, http.StatusOK, response)
	}))

	addr := ":" + config.ServerPort
	log.Printf("Server starting on http://localhost%s", addr)
	log.Printf("DeepSeek Model: %s", config.ModelName)
	log.Printf("Mistral Model: %s", config.MistralModel)

	server := &http.Server{
		Addr:         addr,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}


// extractOfferName attempts to identify the offer name from answer or question context
func extractOfferName(answer, question string) string {
// Common Algerian telecom offers
offers := []string{
"Idoom ADSL",
"Idoom Fibre",
"Idoom 4G LTE",
"Fléxy",
"Mobilis",
"Djezzy",
}

// Check answer and question for offer mentions
combined := strings.ToLower(answer + " " + question)

for _, offer := range offers {
if strings.Contains(combined, strings.ToLower(offer)) {
return offer
}
}

// Check for keywords
if strings.Contains(combined, "fibre") || strings.Contains(combined, "fibr") {
return "Idoom Fibre"
}
if strings.Contains(combined, "adsl") {
return "Idoom ADSL"
}
if strings.Contains(combined, "4g") || strings.Contains(combined, "lte") {
return "Idoom 4G LTE"
}
if strings.Contains(combined, "fléxy") || strings.Contains(combined, "flexy") {
return "Fléxy"
}

// Default offer
return "Offre Générale"
}
