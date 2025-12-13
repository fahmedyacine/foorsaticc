import { useState } from 'react'
import { X, History, MessageSquare, Plus, Search } from 'lucide-react'

function Sidebar({ isOpen, onClose, theme, language, history = [], onNewChat }) {
  const [searchQuery, setSearchQuery] = useState('')

  const t = {
    newChat: {
      FR: 'Nouvelle discussion',
      EN: 'New chat',
      AR: 'محادثة جديدة'
    },
    searchHistory: {
      FR: 'Rechercher dans l\'historique',
      EN: 'Search history',
      AR: 'البحث في التاريخ'
    },
    historyTitle: {
      FR: 'Historique',
      EN: 'History',
      AR: 'التاريخ'
    },
    noHistory: {
      FR: 'Aucune conversation récente.',
      EN: 'No recent conversations.',
      AR: 'لا توجد محادثات حديثة.'
    }
  }

  const filteredHistory = history.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isRTL = language === 'AR'

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } md:hidden`}
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <div
        className={`fixed inset-y-0 left-0 z-50 
          md:static md:inset-auto md:translate-x-0
          transition-all duration-300 ease-in-out
          w-80 overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:w-0'}
          ${theme === 'dark'
            ? 'bg-[#080c17] border-r border-white/10'
            : 'bg-white border-r border-slate-200'}
        `}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="w-80 h-full flex flex-col">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5">
            <div className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              ForsaTic
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition md:hidden ${
                theme === 'dark'
                  ? 'hover:bg-white/10 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
             {/* New Chat Button */}
             <button 
                onClick={onNewChat}
                className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl border transition ${
                theme === 'dark'
                  ? 'bg-brand/10 border-brand/20 text-brand hover:bg-brand/20'
                  : 'bg-brand/5 border-brand/10 text-brand-dark hover:bg-brand/10'
             }`}>
                <Plus className="h-5 w-5" />
                <span className="text-base font-medium">{t.newChat[language] || t.newChat['FR']}</span>
             </button>

             {/* Search History */}
             <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500`} />
                <input 
                   type="text"
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder={t.searchHistory[language] || t.searchHistory['FR']}
                   className={`w-full bg-transparent border rounded-xl py-2 pl-9 pr-4 text-base focus:outline-none focus:ring-1 focus:ring-brand/50 ${
                      theme === 'dark'
                        ? 'border-white/10 text-slate-200 placeholder:text-slate-600'
                        : 'border-slate-200 text-slate-700 placeholder:text-slate-400'
                   }`}
                   style={{ paddingLeft: isRTL ? '1rem' : '2.5rem', paddingRight: isRTL ? '2.5rem' : '1rem' }} 
                />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
            {/* History Section */}
            <div className="space-y-3">
               <div className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                <History className="h-4 w-4" />
                {t.historyTitle[language] || t.historyTitle['FR']}
              </div>
              <div className="space-y-1">
                {filteredHistory.map((item, i) => (
                  <button
                    key={i}
                    className={`w-full text-left p-3 rounded-lg text-base transition flex items-center gap-2 ${
                      theme === 'dark'
                        ? 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 opacity-50 flex-none" />
                    <span className="truncate">{item}</span>
                  </button>
                ))}
                {filteredHistory.length === 0 && (
                    <div className={`text-sm italic ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                        {t.noHistory[language] || t.noHistory['FR']}
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
