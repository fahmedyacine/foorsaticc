import { NavLink } from 'react-router-dom'
import { Bot, Search, Globe2, Moon, Sun, Menu } from 'lucide-react'

function NavBar({ theme, language, onToggleTheme, onToggleLanguage, onToggleSidebar }) {
  const t = {
    chatbot: { FR: 'Chatbot', EN: 'Chatbot', AR: 'المساعد' },
    search: { FR: 'Recherche', EN: 'Search', AR: 'بحث' },
    subtitle: { FR: 'ForsaTic Assistant', EN: 'ForsaTic Assistant', AR: 'مساعد ForsaTic' },
    title: { FR: 'Algerie Telecom AI Assistant', EN: 'Algerie Telecom AI Assistant', AR: 'مساعد اتصالات الجزائر' }
  }

  const links = [
    { to: '/', label: t.chatbot[language] || t.chatbot['FR'], icon: Bot },
    { to: '/search', label: t.search[language] || t.search['FR'], icon: Search },
  ]

  return (
    <header
      className={`sticky top-0 backdrop-blur-lg rounded-2xl border mt-6 mb-6 ${
        theme === 'dark'
          ? 'bg-surface/70 border-white/5 shadow-glow'
          : 'bg-white/80 border-slate-200 shadow-lg'
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className={`p-2 rounded-xl transition ${
              theme === 'dark' 
                ? 'hover:bg-white/10 text-slate-300' 
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <div
              className={`text-sm uppercase tracking-wide ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              {t.subtitle[language] || t.subtitle['FR']}
            </div>
            <div
              className={`text-lg font-bold leading-tight ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t.title[language] || t.title['FR']}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className={`px-3 py-2 rounded-xl border transition ${
               theme === 'dark' 
                 ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' 
                 : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={onToggleLanguage}
          >
            <div className="flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              <span className="hidden md:inline text-base">{language}</span>
            </div>
          </button>
          <button
            className={`px-3 py-2 rounded-xl border transition ${
               theme === 'dark' 
                 ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10' 
                 : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            onClick={onToggleTheme}
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
              <span className="hidden md:inline text-base">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </div>
          </button>
          <nav className="flex items-center gap-1 ml-2 md:ml-4">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-xl text-base transition ${
                    isActive
                  ? 'bg-brand text-white shadow-glow'
                  : `border border-transparent ${
                      theme === 'dark'
                        ? 'text-slate-200 hover:bg-white/10'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }`
                }
              >
                <link.icon className="h-5 w-5" />
                <span className="hidden md:inline">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}

export default NavBar
