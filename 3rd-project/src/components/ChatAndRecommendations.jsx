import ChatPanel from './ChatPanel'
import ResultsPanel from './ResultsPanel'

function ChatAndRecommendations({ theme }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <ChatPanel theme={theme} />
      </div>
      <div className="lg:col-span-3 space-y-4">
        <ResultsPanel theme={theme} />
      </div>
    </div>
  )
}

export default ChatAndRecommendations
