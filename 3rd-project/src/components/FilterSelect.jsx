function FilterSelect({ label, options, value, onSelect, theme }) {
  return (
    <div className="space-y-1">
      <div className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = value === opt
          return (
            <button
              key={opt}
              onClick={() => onSelect(isActive ? '' : opt)}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                isActive
                  ? 'bg-brand text-white border-brand shadow-glow'
                  : theme === 'dark'
                    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default FilterSelect
