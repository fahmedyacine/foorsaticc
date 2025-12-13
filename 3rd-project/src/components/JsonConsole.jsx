import { useState, useMemo } from 'react'
import { Upload, Download, MessageSquare, Loader2 } from 'lucide-react'
import { api } from '../services/api'

function JsonConsole() {
  const [inputJson, setInputJson] = useState(
    `{
  "equipe": "IA_Team",
  "question": {
    "categorie_01": {
      "1": "Donnez une description du projet",
      "2": "Quelles sont les technologies utilisées ?"
    }
  }
}`
  )
  const [outputJson, setOutputJson] = useState(
    `{
  "equipe": "IA_Team",
  "reponses": {
    "Offre_01": {
      "1": "Le projet vise à développer une solution innovante…",
      "2": "Les technologies utilisées incluent Python, FastAPI, et un modèle IA…"
    }
  }
}`
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const prettyInput = useMemo(() => inputJson, [inputJson])
  const prettyOutput = useMemo(() => outputJson, [outputJson])

  const sendToBackend = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Parse input JSON
      const payload = JSON.parse(inputJson)
      
      // Send to Go backend
      const response = await api.sendBatchQuestions(payload)
      
      // Format and display response
      setOutputJson(JSON.stringify(response, null, 2))
    } catch (err) {
      console.error('Batch processing error:', err)
      setError(err.message || 'Failed to process batch questions')
      setOutputJson(JSON.stringify({
        error: err.message || 'Failed to process batch questions',
        message: 'Veuillez vérifier que le backend est démarré sur http://localhost:8080'
      }, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  const downloadJson = () => {
    const blob = new Blob([outputJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reponses.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-surface/70 backdrop-blur-lg shadow-glow p-5 space-y-4">
      <div className="flex items-center gap-2 text-white">
        <Upload className="h-5 w-5" />
        <div>
          <div className="text-lg font-semibold">Pipeline JSON (Backend Intégré)</div>
          <div className="text-sm text-slate-300">
            Envoi du JSON conforme au format d&apos;évaluation vers le backend Go.
          </div>
        </div>
      </div>
      
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <strong>Erreur:</strong> {error}
        </div>
      )}
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Entrée (questions)</label>
          <textarea
            value={prettyInput}
            onChange={(e) => setInputJson(e.target.value)}
            className="min-h-[320px] w-full rounded-2xl bg-white/5 border border-white/10 text-sm text-slate-100 p-3 font-mono"
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Sortie (réponses)</label>
          <textarea
            value={prettyOutput}
            readOnly
            className="min-h-[320px] w-full rounded-2xl bg-white/5 border border-white/10 text-sm text-slate-100 p-3 font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={sendToBackend}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white shadow-glow text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Envoyer au Backend
                </>
              )}
            </button>
            <button 
              onClick={downloadJson}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-slate-200 text-sm hover:bg-white/20 transition"
            >
              <Download className="h-4 w-4" />
              Télécharger JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JsonConsole
