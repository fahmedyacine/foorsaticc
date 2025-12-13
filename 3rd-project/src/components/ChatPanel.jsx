import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Loader2, Upload, X } from 'lucide-react'
import { api } from '../services/api'

const categoriesData = {
  FR: [
    { label: 'Offres', id: 'categorie_01' },
    { label: 'Offres en Arabe', id: 'categorie_02' },
    { label: 'Guide NGBSS', id: 'categorie_03' },
    { label: 'Dépot Vente', id: 'categorie_04' },
    { label: 'Convention', id: 'categorie_05' },
  ],
  EN: [
    { label: 'Offers', id: 'categorie_01' },
    { label: 'Offers in Arabic', id: 'categorie_02' },
    { label: 'NGBSS Guide', id: 'categorie_03' },
    { label: 'Consignment', id: 'categorie_04' },
    { label: 'Convention', id: 'categorie_05' },
  ],
  AR: [
    { label: 'عروض', id: 'categorie_01' },
    { label: 'عروض بالعربية', id: 'categorie_02' },
    { label: 'دليل NGBSS', id: 'categorie_03' },
    { label: 'إيداع وبيع', id: 'categorie_04' },
    { label: 'اتفاقية', id: 'categorie_05' },
  ]
}

function ChatPanel({ theme, language = 'FR' }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  const t = {
    badge: { FR: 'Chatbot IA', EN: 'AI Chatbot', AR: 'المساعد الذكي' },
    status: { FR: 'Prêt', EN: 'Ready', AR: 'جاهز' },
    generating: { FR: 'Génération...', EN: 'Generating...', AR: 'جاري التوليد...' },
    uploading: { FR: 'Téléchargement...', EN: 'Uploading...', AR: 'جاري الرفع...' },
    placeholder: { 
      FR: 'Posez votre question…', 
      EN: 'Ask your question…', 
      AR: 'اطرح سؤالك...' 
    },
    uploadSuccess: {
      FR: 'Fichier téléchargé avec succès',
      EN: 'File uploaded successfully',
      AR: 'تم رفع الملف بنجاح'
    },
    uploadError: {
      FR: 'Erreur lors du téléchargement',
      EN: 'Upload error',
      AR: 'خطأ في الرفع'
    }
  }

  const currentCategories = categoriesData[language] || categoriesData['FR']
  const isRTL = language === 'AR'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await api.getHistory();
        if (history && Array.isArray(history)) {
          setMessages(history);
        }
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    };
    loadHistory();
  }, []); // Run once on mount

  const toggleCategory = (catId) => {
    setSelectedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(c => c !== catId)
        : [...prev, catId]
    )
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    
    try {
      // Generate a unique ID for the document
      const fileName = selectedFile.name
      const docId = `doc-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9]/g, '-')}`
      
      // Extract file extension for category
      const fileExt = fileName.split('.').pop().toLowerCase()
      const category = fileExt === 'pdf' ? 'document' : fileExt === 'docx' || fileExt === 'doc' ? 'document' : 'file'
      
      // Upload the actual file
      const response = await api.uploadFile(selectedFile, docId, {
        title: fileName,
        category: category,
        file_type: fileExt,
      })

      // Show success message
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: `${t.uploadSuccess[language] || t.uploadSuccess['FR']}: ${fileName}\n${response.message || 'Document ajouté au système RAG'}`,
        },
      ])
      
      // Clear selected file
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (error) {
      console.error("Upload Error:", error)
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: `${t.uploadError[language] || t.uploadError['FR']}: ${error.message}`,
        },
      ])
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const newMessage = { from: 'user', text: input.trim() }
    
    // Optimistic UI update
    setMessages((m) => [...m, newMessage])
    setInput('')
    setIsSending(true)

    try {
      // Send question to Go backend with top_k parameter
      const data = await api.sendMessage({ 
        question: input.trim(),
        top_k: 3
      });
      
      const botText = data.answer || data.reponse || data.text || "Réponse reçue (structure inconnue)"

      const botMessage = { from: 'bot', text: botText };
      
      // Update UI with bot response
      setMessages((m) => [...m, botMessage])

    } catch (error) {
      console.error("API Error:", error)
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: "Désolé, je ne peux pas joindre le serveur pour le moment. Veuillez vérifier que le backend est démarré sur http://localhost:8080",
        },
      ])
    } finally {
       setIsSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto transition-colors" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-3 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-sm bg-white/10 text-slate-500 border border-slate-200 dark:text-slate-100 dark:border-white/10">
            {t.badge[language] || t.badge['FR']}
          </span>
        </div>
        <span className="text-sm text-slate-400">{t.status[language] || t.status['FR']}</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth">
        {messages.length === 0 && (
            <div className={`text-center py-10 opacity-50 ${isRTL ? 'font-arabic' : ''}`}>
                {language === 'AR' ? 'ابدأ محادثة جديدة...' : 'Start a new conversation...'}
            </div>
        )}
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.03 }}
            className={`max-w-[90%] text-base leading-relaxed px-4 py-3 rounded-2xl ${
              msg.from === 'user'
                ? 'ml-auto bg-brand text-white shadow-sm'
                : theme === 'dark'
                  ? 'bg-white/5 border border-white/10 text-slate-100'
                  : 'bg-slate-100 border border-slate-200 text-slate-800'
            }`}
          >
            {msg.text}
          </motion.div>
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-slate-400 text-sm px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.generating[language] || t.generating['FR']}
          </div>
        )}
        {isUploading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.uploading[language] || t.uploading['FR']}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 justify-center">
          {currentCategories.map((cat) => {
            const isSelected = selectedCategories.includes(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  isSelected 
                    ? 'bg-brand text-white border-brand shadow-glow'
                    : theme === 'dark' 
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 text-slate-300'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                {cat.label}
              </button>
            )
          })}
        </div>

        {/* File upload section */}
        {selectedFile && (
          <div className={`flex items-center gap-2 p-3 rounded-xl border ${
            theme === 'dark'
              ? 'bg-white/5 border-white/10'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {selectedFile.name}
              </p>
              <p className={`text-xs ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button
              onClick={handleFileUpload}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? t.uploading[language] || t.uploading['FR'] : 'Upload'}
            </button>
            <button
              onClick={handleRemoveFile}
              disabled={isUploading}
              className={`p-2 rounded-lg ${
                theme === 'dark'
                  ? 'hover:bg-white/10 text-slate-400'
                  : 'hover:bg-slate-200 text-slate-600'
              } transition disabled:opacity-50`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <div className="relative flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.txt,.md"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`p-2 rounded-xl cursor-pointer transition ${
                theme === 'dark'
                  ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300'
                  : 'bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <Upload className="h-5 w-5" />
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t.placeholder[language] || t.placeholder['FR']}
              className={`flex-1 rounded-2xl py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/60 border shadow-sm ${
                theme === 'dark'
                  ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
              style={{ 
                  paddingLeft: isRTL ? '3rem' : '1rem', 
                  paddingRight: isRTL ? '1rem' : '3rem' 
              }}
            />
            <button
              onClick={handleSend}
              disabled={isSending}
              className={`p-2 rounded-xl bg-brand text-white hover:opacity-90 transition disabled:opacity-50 ${
                  isRTL ? 'order-first' : ''
              }`}
            >
              <MessageSquare className="h-5 w-5" />
            </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
