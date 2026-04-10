import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import TopNavigation from './components/TopNavigation'
import StrategyLab from './pages/StrategyLab'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'
import Settings from './pages/Settings'
import AutomateModal from './components/AutomateModal'
import { useIRISStore } from './store/irisStore'

export default function App() {
  const checkHealth = useIRISStore((s) => s.checkHealth)
  const fetchUser = useIRISStore((s) => s.fetchUser)
  const automateModalOpen = useIRISStore((s) => s.automateModalOpen)

  useEffect(() => {
    // Run health check and fetch user in parallel on mount
    checkHealth()
    fetchUser()
    const interval = setInterval(checkHealth, 15000)
    return () => clearInterval(interval)
  }, [checkHealth, fetchUser])

  return (
    <>
      <TopNavigation />
      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        <Routes>
          <Route path="/" element={<StrategyLab />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:runId" element={<HistoryDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      {automateModalOpen && <AutomateModal />}
    </>
  )
}
