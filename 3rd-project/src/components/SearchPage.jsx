import { Search, Filter } from 'lucide-react'
import OfferGrid from './OfferGrid'

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
    pdfUrl:
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
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
    pdfUrl:
      'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
  },
]

function SearchMini({ theme }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs text-slate-400">Mot-clé</label>
          <input
            className={`w-full mt-1 rounded-xl px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/60 border ${
              theme === 'dark'
                ? 'bg-white/5 border-white/10 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
            placeholder="Nom d'offre, partenaire, secteur..."
          />
        </div>
        <button className="mt-5 px-4 py-2 rounded-xl bg-brand text-white shadow-glow text-sm">
          Rechercher
        </button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <FilterPill label="Secteur" theme={theme} />
        <FilterPill label="Partenaire" theme={theme} />
        <FilterPill label="Validité" theme={theme} />
        <FilterPill label="Type d'offre" theme={theme} />
      </div>
      <div className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        Moteur de recherche à connecter au backend + filtres dynamiques.
      </div>
    </div>
  )
}

function FilterPill({ label, theme }) {
  return (
    <button
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm border ${
        theme === 'dark'
          ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
      }`}
    >
      <span>{label}</span>
      <Filter className="h-4 w-4 text-slate-400" />
    </button>
  )
}

function SearchPage({ theme }) {
  return (
    <div
      className={`rounded-3xl border p-5 space-y-4 ${
        theme === 'dark'
          ? 'border-white/10 bg-surface/70 backdrop-blur-lg shadow-glow'
          : 'border-slate-200 bg-white shadow-xl'
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}
      >
        <Search className="h-5 w-5" />
        <div>
          <div className="text-lg font-semibold">Recherche avancée</div>
          <div
            className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}
          >
            Mots-clés + filtres dynamiques (secteur, partenaire, validité, type)
          </div>
        </div>
      </div>
      <SearchMini theme={theme} />
      <OfferGrid offers={mockOffers} theme={theme} />
    </div>
  )
}

export default SearchPage
