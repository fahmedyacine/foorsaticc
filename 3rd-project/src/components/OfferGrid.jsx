import { motion } from 'framer-motion'
import { FileDown } from 'lucide-react'

function OfferGrid({ offers, theme, emptyLabel = 'text-slate-500' }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {offers.length === 0 && (
        <div className={`col-span-2 text-sm ${emptyLabel}`}>
          Aucune offre ne correspond aux filtres actuels.
        </div>
      )}
      {offers.map((offer, idx) => (
        <motion.div
          key={offer.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: idx * 0.05 }}
          className={`rounded-2xl border p-4 hover:border-brand/50 hover:shadow-glow transition ${
            theme === 'dark'
              ? 'border-white/10 bg-white/5 text-slate-100'
              : 'border-slate-200 bg-white text-slate-900 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{offer.name}</div>
            <span className="text-xs px-2 py-1 rounded-full bg-brand/20 text-blue-100 border border-brand/40">
              {offer.sector}
            </span>
          </div>
          <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
            {offer.summary}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {offer.tags.map((tag) => (
              <span
                key={tag}
                className={`text-xs px-2 py-1 rounded-full border ${
                  theme === 'dark'
                    ? 'bg-white/10 border-white/10 text-slate-200'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          <div
            className={`mt-4 flex items-center justify-between text-xs ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{offer.partner}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>{offer.validity}</span>
              <span className="w-1 h-1 rounded-full bg-white/30" />
              <span>{offer.language}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={offer.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border ${
                  theme === 'dark'
                    ? 'bg-white/10 border-white/10 text-slate-100 hover:bg-white/20'
                    : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                }`}
              >
                <FileDown className="h-4 w-4" />
                PDF
              </a>
              <button className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs border border-brand/60 shadow-glow">
                Copier JSON
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default OfferGrid
