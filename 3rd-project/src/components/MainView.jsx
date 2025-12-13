import { useState, useEffect } from 'react'
import ChatPanel from './ChatPanel'
import ResultsPanel from './ResultsPanel'

function MainView({ theme, filters, setFilters, isSidebarOpen, language }) {
  const [viewMode, setViewMode] = useState('chat') // 'chat' | 'results'

  // Switch to results if filters are active (basic heuristic, can be improved)
  useEffect(() => {
    const hasActiveFilters = filters.period || filters.activity || filters.partner
    if (hasActiveFilters) {
      setViewMode('results')
    }
  }, [filters])

  return (
    <div className="relative flex flex-col h-full">
       <div className="flex justify-center mb-4 flex-none">
         <div className={`flex p-1 rounded-full border ${
            theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'
         }`}>
            <button
               onClick={() => setViewMode('chat')}
               className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                 viewMode === 'chat'
                   ? 'bg-brand text-white shadow-sm'
                   : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
               }`}
            >
              Discussion
            </button>
            <button
               onClick={() => setViewMode('results')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                 viewMode === 'results'
                    ? 'bg-brand text-white shadow-sm'
                   : theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-900'
               }`}
            >
              Deep Research
            </button>
         </div>
       </div>

      <div className="flex-1 overflow-hidden min-h-0">
        {viewMode === 'chat' && (
           <div className="h-full flex flex-col">
             <ChatPanel theme={theme} language={language} />
           </div>
        )}
        
        {viewMode === 'results' && (
           <div className="h-full overflow-y-auto pb-20">
             <ResultsPanel theme={theme} filters={filters} setFilters={setFilters} language={language} />
           </div>
        )}
      </div>
    </div>
  )
}

export default MainView
