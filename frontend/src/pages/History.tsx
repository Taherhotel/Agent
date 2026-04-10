import { useEffect } from 'react'

import { useNavigate } from 'react-router-dom'

import { motion } from 'framer-motion'

import { Clock, BarChart3, ChevronRight } from 'lucide-react'

import { useIRISStore } from '../store/irisStore'

import QuantWorkspace from '../components/QuantWorkspace'



export default function History() {

  const { historyItems, historyLoading, loadHistory } = useIRISStore()

  const navigate = useNavigate()



  useEffect(() => {

    loadHistory()

  }, [loadHistory])



  return (

    <QuantWorkspace>

      <div className="main-stack">

        <div className="card-header">

          <Clock size={18} color="var(--teal)" />

          <h1 className="font-mono">Run History</h1>

        </div>



        {historyLoading && (

          <div className="stack gap-sm">

            {Array.from({ length: 4 }).map((_, i) => (

              <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />

            ))}

          </div>

        )}



        {!historyLoading && historyItems.length === 0 && (

          <div className="iris-card" style={{ textAlign: 'center', padding: '3rem' }}>

            <BarChart3 size={40} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />

            <p className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>

              No runs yet. Head to Strategy Lab to run your first backtest.

            </p>

          </div>

        )}



        {!historyLoading && historyItems.length > 0 && (

          <div className="stack gap-sm">

            {historyItems.map((item, i) => (

              <motion.div

                key={item.run_id}

                initial={{ opacity: 0, y: 8 }}

                animate={{ opacity: 1, y: 0 }}

                transition={{ delay: i * 0.05, duration: 0.3 }}

                className="history-card"

                onClick={() => navigate(`/history/${item.run_id}`)}

              >

                <div className="hc-col">

                  <span className="label">RUN ID</span>

                  <span className="value accent">{item.run_id.slice(0, 8)}</span>

                </div>

                <div className="hc-col">

                  <span className="label">ASSET</span>

                  <span className="value">{item.asset}</span>

                </div>

                <div className="hc-col grow">

                  <span className="label">PERIOD</span>

                  <span className="value">{item.start_date} → {item.end_date}</span>

                </div>

                {item.sharpe != null && (

                  <div className="hc-col">

                    <span className="label">SHARPE</span>

                    <span className={`value ${item.sharpe > 0 ? 'pos' : 'neg'}`}>{item.sharpe.toFixed(2)}</span>

                  </div>

                )}

                {item.cagr != null && (

                  <div className="hc-col">

                    <span className="label">CAGR</span>

                    <span className={`value ${item.cagr > 0 ? 'pos' : 'neg'}`}>{(item.cagr * 100).toFixed(1)}%</span>

                  </div>

                )}

                <ChevronRight size={18} color="var(--text-secondary)" />

              </motion.div>

            ))}

          </div>

        )}

      </div>

    </QuantWorkspace>

  )

}

