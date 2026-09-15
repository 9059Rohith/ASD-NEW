import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  CalendarDays,
  FileClock,
  History,
  Mic,
  MonitorCheck,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../components/layout/DashboardLayout'
import { clinicalNotesAPI, progressAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { buildCaregiverOverview } from '../features/dashboard/caregiverOverview'
import { useTamilProgress } from '../features/tamil/useTamilLearning'
import { tamilApi } from '../features/tamil/tamilApi'


function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}


export default function UserDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const tamil = useTamilProgress()
  const { data: tamilInsights } = useQuery({
    queryKey: ['tamil-insights', user?.id], queryFn: () => tamilApi.insights(),
    enabled: Boolean(user?.id), retry: false,
  })

  const { data: summaryResponse, isLoading } = useQuery({
    queryKey: ['progress-summary', user?.email],
    queryFn: () => progressAPI.getProgressSummary(user?.email),
    enabled: Boolean(user?.email),
  })
  const { data: notesResponse } = useQuery({
    queryKey: ['caregiver-clinical-notes', user?.id],
    queryFn: () => clinicalNotesAPI.list(user.id),
    enabled: Boolean(user?.id),
    retry: false,
  })

  const overview = buildCaregiverOverview({ progress: summaryResponse?.data, user })
  const latestNote = notesResponse?.data?.notes?.[0]
  const caregiverName = (user?.full_name || 'Caregiver').split(' ')[0]
  const childName = user?.child_name || 'Your child'

  return (
    <DashboardLayout maxWidth="max-w-[1180px]" variant="care">
      <section className="care-welcome" aria-labelledby="care-dashboard-title">
        <div>
          <h1 id="care-dashboard-title">{greeting()}, {caregiverName}</h1>
          <p>{childName} is ready for a short Tamil practice.</p>
        </div>
        <div className="care-actions">
          <button className="care-primary-action" onClick={() => navigate('/training')}>
            <Mic aria-hidden="true" /> Start practice
          </button>
          <button className="care-link-action" onClick={() => navigate('/progress')}>
            <History aria-hidden="true" /> View session history
          </button>
        </div>
      </section>

      <section className="care-tamil-summary" aria-label="Tamil learning analytics">
        <div><span>Tamil lessons</span><strong>{tamil.loading ? '…' : `${tamil.progress?.completed_total || 0} / ${tamil.progress?.lesson_total || 0}`}</strong></div>
        <div><span>Practice attempts</span><strong>{tamil.loading ? '…' : tamil.progress?.total_attempts || 0}</strong></div>
        <div><span>Game rounds</span><strong>{tamil.loading ? '…' : tamil.progress?.game_total_attempts || 0}</strong></div>
        <div><span>Reviews due</span><strong>{tamil.loading ? '…' : tamil.progress?.review_due_items?.length || 0}</strong></div>
        {tamil.error && <p role="alert">Tamil analytics are unavailable. <button onClick={tamil.refresh}>Retry</button></p>}
      </section>

      <section className="care-plan" aria-labelledby="today-plan-heading">
        <h2 id="today-plan-heading">Today’s plan</h2>
        <ol>
          {['Listen', 'Record', 'Review'].map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </li>
          ))}
        </ol>
        {tamilInsights?.report?.next_step_item_id && <button className="care-next-tamil" onClick={() => navigate(`/tamil/practice/${encodeURIComponent(tamilInsights.report.next_step_item_id)}`)}>Open your next Tamil lesson <ArrowRight size={17} /></button>}
        {tamilInsights?.game?.recommended_game && <button className="care-next-tamil" onClick={() => navigate('/games')}>Recommended game: {tamilInsights.game.recommended_game.replaceAll('-', ' ')} <ArrowRight size={17} /></button>}
      </section>

      <div className="care-grid">
        <section className="care-frame care-progress" aria-labelledby="progress-month-heading">
          <div className="care-section-heading">
            <div>
              <h2 id="progress-month-heading">Progress this month</h2>
              <p>{overview.hasData ? 'Accuracy across recent scored attempts' : 'Scored attempts will appear here after practice.'}</p>
            </div>
            <TrendingUp aria-hidden="true" />
          </div>

          <div className="care-chart" role="img" aria-label={overview.hasData ? `Recent accuracy trend, average ${overview.overallAccuracy} percent` : 'No scored attempts yet'}>
            {isLoading ? (
              <div className="care-empty" role="status">Loading progress…</div>
            ) : overview.chart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview.chart} margin={{ top: 12, right: 18, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#d6ddeb" />
                  <XAxis dataKey="date" tick={{ fill: '#53617a', fontSize: 13 }} tickLine={false} axisLine={{ stroke: '#d6ddeb' }} />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fill: '#53617a', fontSize: 13 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ border: '1px solid #d6ddeb', borderRadius: 10, boxShadow: 'none' }} formatter={(value) => [`${value}%`, 'Accuracy']} />
                  <Area type="monotone" dataKey="accuracy" stroke="#078a86" strokeWidth={3} fill="#e5f5f3" dot={{ r: 4, fill: '#078a86', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="care-empty"><FileClock aria-hidden="true" /> Complete a guided practice to begin the trend.</div>
            )}
          </div>

          <div className="care-progress-summary">
            <div><CalendarDays aria-hidden="true" /><span>Average accuracy<strong>{overview.hasData ? `${overview.overallAccuracy}%` : '—'}</strong></span></div>
            <div><TrendingUp aria-hidden="true" /><span>Practice sessions<strong>{overview.sessions}</strong></span></div>
          </div>
        </section>

        <div className="care-side-column">
          <section className="care-frame care-targets" aria-labelledby="sounds-heading">
            <div className="care-section-heading">
              <div><h2 id="sounds-heading">Sounds to practise</h2><p>Tamil target · best accuracy</p></div>
            </div>
            {overview.targets.length > 0 ? (
              <ul>
                {overview.targets.map((target) => (
                  <li key={target.lessonId}>
                    <button onClick={() => navigate(`/therapy/${target.lessonId}`)} aria-label={`Practise ${target.symbol}, ${target.accuracy} percent accuracy`}>
                      <span className="care-tamil">{target.symbol}</span>
                      <span className={target.accuracy < 70 ? 'needs-focus' : ''}>{target.accuracy}%</span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="care-empty compact">No focus sound yet. Start with today’s practice.</p>
            )}
          </section>

          <section className="care-frame care-note" aria-labelledby="care-note-heading">
            <div className="care-section-heading"><div><h2 id="care-note-heading">Care team note</h2></div><UserRound aria-hidden="true" /></div>
            {latestNote ? (
              <article>
                <strong>{latestNote.therapist_name}</strong>
                <p>{latestNote.text}</p>
                {latestNote.next_target && <span>Next target: {latestNote.next_target}</span>}
              </article>
            ) : (
              <article>
                <strong>Your care team</strong>
                <p>A therapist’s next-practice guidance will appear here after review.</p>
              </article>
            )}
          </section>

          <div className="care-local-status" role="status">
            <MonitorCheck aria-hidden="true" />
            <span>Voice processing:<strong>On this device when available</strong></span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
