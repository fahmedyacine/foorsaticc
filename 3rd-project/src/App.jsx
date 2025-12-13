import { useState } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import NavBar from './components/NavBar'
import MainView from './components/MainView'
import Sidebar from './components/Sidebar'
import SearchPage from './components/SearchPage'
import JsonConsole from './components/JsonConsole'
import Login from './components/Login'
import Signup from './components/Signup'
import { AuthProvider, useAuth } from './context/AuthContext'
import './App.css'

function AppContent() {
  const [theme, setTheme] = useState('dark')
  const [language, setLanguage] = useState('FR')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [chatId, setChatId] = useState(0)
  const [filters, setFilters] = useState({
    period: '',
    activity: '',
    partner: '',
  })
  const { user, loading } = useAuth();

  const handleNewChat = () => {
    setChatId(prev => prev + 1)
    setFilters({ period: '', activity: '', partner: '' })
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false)
    }
  }

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const toggleLanguage = () => {
    const langs = ['FR', 'EN', 'AR']
    setLanguage(prev => {
      const idx = langs.indexOf(prev)
      return langs[(idx + 1) % langs.length]
    })
  }

  if (loading) return <div className="h-screen bg-[#080c17] text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''}`}>
       <Routes>
          <Route path="/login" element={<Login theme={theme} />} />
          <Route path="/signup" element={<Signup theme={theme} />} />
          <Route path="*" element={
             user ? (
              <div
                className={`h-screen flex overflow-hidden transition-colors duration-500 ${
                  theme === 'dark'
                    ? 'bg-[#080c17] text-slate-100'
                    : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 text-slate-900'
                }`}
              >
                
                <Sidebar 
                  isOpen={isSidebarOpen} 
                  onClose={() => setIsSidebarOpen(false)}
                  filters={filters}
                  setFilters={setFilters}
                  theme={theme}
                  onNewChat={handleNewChat}
                />
        
                <div className="flex-1 flex flex-col relative min-w-0 transition-all duration-300">
                    <div className="relative z-20 w-full max-w-4xl mx-auto px-4 pt-4">
                        <NavBar
                          theme={theme}
                          language={language}
                          onToggleTheme={toggleTheme}
                          onToggleLanguage={toggleLanguage}
                          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        />
                    </div>
        
                    <main className="flex-1 overflow-hidden relative px-4 pb-4 w-full">
                      <div className="h-full max-w-7xl mx-auto">
                          <Routes>
                            <Route path="/" element={<MainView key={chatId} theme={theme} filters={filters} setFilters={setFilters} isSidebarOpen={isSidebarOpen} language={language} />} />
                            <Route path="/search" element={<SearchPage theme={theme} />} />
                            <Route path="/sandbox" element={<JsonConsole />} />
                          </Routes>
                      </div>
                    </main>
                </div>
              </div>
             ) : (
                <Navigate to="/login" replace />
             )
          } />
       </Routes>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App

