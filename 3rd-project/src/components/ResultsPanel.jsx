import { useState, useMemo, useEffect, useRef } from 'react'
import { Bot, Search, Filter, Download, X, MessageSquare, Send, User } from 'lucide-react'
import OfferGrid from './OfferGrid'
import FilterSelect from './FilterSelect'

const mockOffers = [
  {
    id: 'offre-01',
    name: 'Fibre Pro 200M',
    partner: 'Algérie Télécom',
    sector: 'Entreprise',
    validity: 'Q1 2026',
    tags: ['Fibre', 'SLA', 'Support 24/7'],
    language: 'FR',
    summary:
      'Accès fibre 200 Mbps avec SLA, IP fixe, support dédié et options voix.',
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
  {
    id: 'offre-02',
    name: 'Partenaire Campus',
    partner: 'AT x Universités',
    sector: 'Éducation',
    validity: '2025-2027',
    tags: ['Conventions', 'Tarifs préférentiels'],
    language: 'FR',
    summary:
      "Convention cadre pour campus : connectivité, sécurité réseau et pack voix.",
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
]

function ResultsPanel({ theme, filters, setFilters, language }) {
  const [searchTags, setSearchTags] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const messagesEndRef = useRef(null)

  const topKeywords = ['Fibre', 'PME', 'Sécurité', 'Cloud', 'VoIP']

  const handleAddTag = (tag) => {
    if (tag && !searchTags.includes(tag)) {
      setSearchTags([...searchTags, tag])
    }
    setInputValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddTag(inputValue.trim())
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setSearchTags(searchTags.filter((tag) => tag !== tagToRemove))
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
      scrollToBottom()
  }, [messages])

  const handleSendChat = () => {
      if (!chatInput.trim()) return
      const newUserMsg = { role: 'user', text: chatInput.trim() }
      setMessages(prev => [...prev, newUserMsg])
      setChatInput('')
      
      // Simuler réponse bot variée
      const randomResponses = [
          "D'après les documents, cette offre inclut bien ces services.",
          "Je peux confirmer que le SLA est de 99.5% sur cette offre.",
          "C'est une excellente question. Les détails techniques sont dans le PDF joint.",
          "Pour ce secteur, cette offre est effectivement la plus recommandée."
      ]
      const response = randomResponses[Math.floor(Math.random() * randomResponses.length)]

      setTimeout(() => {
          setMessages(prev => [...prev, { role: 'bot', text: response }])
      }, 600)
  }

  const filteredOffers = useMemo(() => {
    return mockOffers.filter((offer) => {
      // Filter by Tags (AND logic: needs to match all tags roughly, or at least one? User said "5 mot clee". Usually tags refine. I will use loose matching.)
      // Strategy: Offer must match ALL tags provided.
      const matchTags = searchTags.length === 0 || searchTags.every(tag => {
         const t = tag.toLowerCase()
         return (
             offer.name.toLowerCase().includes(t) ||
             offer.summary.toLowerCase().includes(t) ||
             offer.tags.some(ot => ot.toLowerCase().includes(t)) ||
             offer.partner.toLowerCase().includes(t) ||
             offer.sector.toLowerCase().includes(t)
         )
      })

      const matchPeriod = !filters.period || offer.validity.includes(filters.period)
      const matchActivity = !filters.activity || offer.sector === filters.activity
      const matchPartner = !filters.partner || offer.partner === filters.partner

      return matchTags && matchPeriod && matchActivity && matchPartner
    })
  }, [searchTags, filters])

  const containerClasses =
    theme === 'dark'
      ? 'rounded-3xl border border-white/10 bg-surface/70 backdrop-blur-lg shadow-glow p-5'
      : 'rounded-3xl border border-slate-200 bg-white shadow-xl p-5'

  const mutedText = theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
  const inputTheme = theme === 'dark' 
     ? 'bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500 focus:bg-white/10' 
     : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-500 focus:bg-slate-50'

  return (
    <div className={`flex flex-col min-h-[600px] ${containerClasses}`}>
      
      {/* 1. Header & Filters */}
      <div className="space-y-4 border-b pb-4 mb-4 border-dashed border-slate-200 dark:border-white/10">
         <div className="flex items-center justify-between">
            <h2 className={`text-lg font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
               <Search className="h-5 w-5 text-brand" />
               Deep Research
            </h2>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand bg-brand text-white shadow-glow text-sm hover:opacity-90">
                <Download className="h-4 w-4" />
                Export
            </button>
         </div>

         {/* 3 Criteria Selects */}
         <div className="flex flex-wrap items-center gap-3">
              <FilterSelect 
                 label="Période"
                 options={['Q1 2026', '2025-2027', '2026+']}
                 value={filters.period}
                 onSelect={(v) => setFilters(prev => ({...prev, period: v}))}
                 theme={theme}
              />
              <FilterSelect 
                 label="Secteur"
                 options={['Entreprise', 'Éducation', 'Public', 'Santé']}
                 value={filters.activity}
                 onSelect={(v) => setFilters(prev => ({...prev, activity: v}))}
                 theme={theme}
              />
               <FilterSelect 
                 label="Partenaire"
                 options={['Algérie Télécom', 'AT x Universités', 'Santé Plus']}
                 value={filters.partner}
                 onSelect={(v) => setFilters(prev => ({...prev, partner: v}))}
                 theme={theme}
              />
         </div>

         {/* Keywords / Tags Input */}
         <div className="space-y-3">
             <div className={`flex flex-wrap gap-2 p-2 rounded-xl border ${inputTheme} min-h-[42px]`}>
                {searchTags.map(tag => (
                   <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-brand/10 text-brand border border-brand/20 text-sm">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-brand-dark"><X className="h-3 w-3" /></button>
                   </span>
                ))}
                <input 
                   className="flex-1 bg-transparent border-none outline-none min-w-[120px] text-sm"
                   placeholder={searchTags.length === 0 ? "Entrez des mots-clés..." : ""}
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   onKeyDown={handleKeyDown}
                />
             </div>
             {/* 5 Suggestion Keywords */}
             <div className="flex flex-wrap gap-2">
                {topKeywords.map(k => (
                   <button 
                     key={k} 
                     onClick={() => handleAddTag(k)}
                     className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                        theme === 'dark' 
                        ? 'border-white/10 hover:bg-white/10 text-slate-400 hover:text-slate-200' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700'
                     }`}
                   >
                     + {k}
                   </button>
                ))}
             </div>
         </div>
      </div>

      {/* 2. Chat / Results Area */}
      <div className="flex-1 space-y-6">
         {/* Initial Bot Result */}
         <div className="flex gap-4">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center flex-none">
                <Bot className="h-5 w-5 text-white" />
             </div>
             <div className="flex-1 space-y-4">
                 <div className={`text-base font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-800'}`}>
                    J'ai analysé les offres basées sur vos critères ({searchTags.length} mots-clés, {Object.values(filters).filter(Boolean).length} filtres). Voici les résultats pertinents :
                 </div>
                 <OfferGrid offers={filteredOffers} theme={theme} emptyLabel={mutedText} />
             </div>
         </div>

         {/* User & Bot turn history */}
         {messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-none ${
                    msg.role === 'user' 
                    ? 'bg-slate-200 text-slate-600' 
                    : 'bg-gradient-to-br from-brand to-accent text-white'
                 }`}>
                    {msg.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                 </div>
                 <div className={`px-4 py-3 rounded-2xl text-base max-w-[80%] ${
                    msg.role === 'user'
                    ? 'bg-brand text-white'
                    : theme === 'dark' ? 'bg-white/5 border border-white/10 text-slate-200' : 'bg-slate-100 text-slate-800'
                 }`}>
                    {msg.text}
                 </div>
            </div>
         ))}
         <div ref={messagesEndRef} />
      </div>

      {/* 3. Deep Chat Input */}
      <div className={`sticky bottom-0 -mx-5 -mb-5 p-5 mt-4 backdrop-blur-md border-t ${
          theme === 'dark' ? 'border-white/10 bg-[#080c17]/80' : 'border-slate-200 bg-white/80'
      }`}>
          <div className="relative">
             <input 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Posez une question sur ces résultats..."
                className={`w-full rounded-xl pl-4 pr-12 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/50 border ${inputTheme}`}
             />
             <button 
               onClick={handleSendChat}
               className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-brand text-white hover:opacity-90 transition">
                <Send className="h-4 w-4" />
             </button>
          </div>
      </div>
    </div>
  )
}

export default ResultsPanel
