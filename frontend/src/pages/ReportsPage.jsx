import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, Printer, Mic, ScanFace, BookOpen, CalendarDays,
  CalendarRange, TrendingUp, Star, Clock, Target, Award,
} from 'lucide-react'
import {
  BarChart, Bar, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import toast from 'react-hot-toast'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '../components/layout/DashboardLayout'
import { Card, StatCard, SectionTitle, Badge } from '../components/ui'
import { useAuthStore } from '../store/authStore'
import { progressAPI, analysisAPI } from '../services/api'
import TamilDoctorReports from '../features/reports/TamilDoctorReports'

/* ------------------------------------------------------------------ */
/*  Empty report templates; measured values come from saved API history. */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'speech', label: 'Speech', icon: Mic, color: 'primary' },
  { id: 'tongue', label: 'Tongue', icon: ScanFace, color: 'secondary' },
  { id: 'letters', label: 'Letter Accuracy', icon: BookOpen, color: 'accent' },
  { id: 'weekly', label: 'Weekly', icon: CalendarDays, color: 'gold' },
  { id: 'monthly', label: 'Monthly', icon: CalendarRange, color: 'coral' },
]

const REPORTS = Object.fromEntries(TABS.map(tab => [tab.id, {
  stats: [
    { icon: Target, title: 'Avg Accuracy', value: '?', sub: 'No measurements yet', color: 'primary' },
    { icon: Mic, title: 'Sessions Logged', value: '0', sub: 'Saved attempts', color: 'secondary' },
    { icon: Star, title: 'Stars Earned', value: '0', sub: 'From saved practice', color: 'gold' },
    { icon: Clock, title: 'Practice Time', value: '?', sub: 'No measurements yet', color: 'accent' },
  ],
  chartType: tab.id === 'letters' ? 'bar' : ['weekly', 'monthly'].includes(tab.id) ? 'area' : 'radar',
  radar: [], bar: [], area: [], table: [],
}]))

/* ------------------------------------------------------------------ */
/*  Chart tooltip                                                      */
/* ------------------------------------------------------------------ */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-100 dark:border-neutral-700 px-3 py-2 text-xs">
      <p className="font-bold text-neutral-900 dark:text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-neutral-600 dark:text-neutral-300">
          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function StarRow({ count }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < count ? 'text-gold-500 fill-gold-500' : 'text-neutral-300 dark:text-neutral-600'}`} />
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('speech')

  const { data: summaryResp } = useQuery({
    queryKey: ['progressSummary', user?.email],
    queryFn: () => progressAPI.getProgressSummary(user?.email),
    enabled: !!user?.email,
  })
  const summary = summaryResp?.data

  const { data: analysisResp } = useQuery({
    queryKey: ['analysis', user?.email],
    queryFn: () => analysisAPI.getAnalysis('me'),
    enabled: !!user?.email,
  })
  const analysis = analysisResp?.data

  const { data: historyResp, isLoading, isError } = useQuery({
    queryKey: ['report-history', user?.email],
    queryFn: () => progressAPI.history('me', { limit: 100 }),
    enabled: Boolean(user?.email),
  })
  const report = useMemo(() => {
    const base = REPORTS[activeTab]
    let rows = historyResp?.data?.items || []
    const days = activeTab === 'weekly' ? 7 : activeTab === 'monthly' ? 30 : null
    if (days) rows = rows.filter(row => Date.now() - new Date(row.created_at).getTime() <= days * 86400000)
    if (activeTab === 'letters') rows = rows.filter(row => row.lesson_id <= 12)
    if (activeTab === 'tongue') rows = []
    const average = rows.length ? rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length : null
    const groups = new Map()
    for (const row of rows) {
      const key = row.phoneme || `Lesson ${row.lesson_id}`
      const values = groups.get(key) || []
      values.push(row.accuracy)
      groups.set(key, values)
    }
    const sounds = Array.from(groups, ([key, values]) => ({
      letter: key, skill: key, accuracy: values.reduce((a, b) => a + b, 0) / values.length,
      score: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    const minutes = rows.reduce((sum, row) => sum + (row.duration_ms || 0), 0) / 60000
    return { ...base,
      stats: base.stats.map((stat, index) => ({ ...stat,
        value: [average == null ? '?' : `${Math.round(average)}%`, String(rows.length),
          String(rows.reduce((sum, row) => sum + (row.stars_earned || 0), 0)), `${minutes.toFixed(1)} min`][index],
        sub: activeTab === 'tongue' ? 'No stored tongue measurements' : 'From the latest 100 saved attempts',
      })),
      bar: sounds, radar: sounds,
      area: [...rows].reverse().map(row => ({ day: new Date(row.created_at).toLocaleDateString(), accuracy: row.accuracy })),
      table: rows.map(row => ({ date: new Date(row.created_at).toLocaleDateString(),
        lesson: row.phoneme || `Lesson ${row.lesson_id}`, accuracy: Math.round(row.accuracy),
        stars: row.stars_earned || 0, duration: `${((row.duration_ms || 0) / 1000).toFixed(1)} sec`,
      })),
    }
  }, [activeTab, historyResp])

  const handleDownload = () => {
    toast('Choose “Save as PDF” in the browser print dialog.', { icon: '📄' })
    setTimeout(() => window.print?.(), 100)
  }
  const handlePrint = () => {
    toast('🖨️ Preparing print view…', { icon: '🖨️' })
    setTimeout(() => window.print?.(), 400)
  }

  const headerActions = (
    <>
      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur text-white text-sm font-semibold transition"
      >
        <Download className="w-4 h-4" /> Save as PDF
      </button>
      <button
        onClick={handlePrint}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary-700 hover:bg-white/90 text-sm font-semibold transition shadow-md"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
    </>
  )

  return (
    <DashboardLayout
      title="Reports Center"
      subtitle={`Detailed performance reports for ${user?.child_name || user?.full_name || 'your learner'}`}
      icon={FileText}
      actions={headerActions}
    >
      {['user', 'admin'].includes(user?.role) && <TamilDoctorReports />}
      {isLoading && <p role="status">Loading saved attempts?</p>}
      {isError && <p role="alert">Reports could not be loaded. Please refresh and retry.</p>}
      {!isLoading && !isError && report.table.length === 0 && <p className="mb-4">No saved measurements for this report yet.</p>}
      {/* Segmented tab control */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white dark:bg-neutral-900 rounded-2xl shadow-md border border-neutral-100 dark:border-neutral-800 mb-8 w-fit">
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                active
                  ? 'text-white'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="report-tab-pill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-500 to-secondary-500 shadow-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <tab.icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
            {report.stats.map((s, i) => (
              <StatCard key={s.title} {...s} delay={i * 0.05} />
            ))}
          </div>

          {/* Chart */}
          <Card className="p-6 mb-8">
            <SectionTitle
              title={
                report.chartType === 'bar' ? 'Letter Accuracy Breakdown'
                  : report.chartType === 'area' ? 'Performance Trend'
                  : 'Skills Breakdown'
              }
              subtitle="Saved practice measurements"
              icon={TrendingUp}
              action={<Badge color="primary">Live preview</Badge>}
            />
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {report.chartType === 'bar' ? (
                  <BarChart data={report.bar} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" strokeOpacity={0.4} vertical={false} />
                    <XAxis dataKey="letter" tick={{ fontSize: 14 }} stroke="#a3a3a3" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                    <Bar dataKey="accuracy" name="Accuracy %" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                ) : report.chartType === 'area' ? (
                  <AreaChart data={report.area} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366F1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" strokeOpacity={0.4} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#a3a3a3" />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#6366F1" strokeWidth={3} fill="url(#areaGrad)" />
                  </AreaChart>
                ) : (
                  <RadarChart data={report.radar} outerRadius="78%">
                    <PolarGrid stroke="#e5e5e5" strokeOpacity={0.5} />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: '#737373' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#a3a3a3' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.35} strokeWidth={2} />
                  </RadarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Session table */}
          <Card className="p-6">
            <SectionTitle title="Session Details" subtitle="Most recent sessions in this report" icon={FileText} />
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-neutral-400 dark:text-neutral-500 uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-3 font-semibold">Date</th>
                    <th className="py-3 px-3 font-semibold">Lesson</th>
                    <th className="py-3 px-3 font-semibold">Accuracy</th>
                    <th className="py-3 px-3 font-semibold">Stars</th>
                    <th className="py-3 px-3 font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {report.table.map((row, i) => (
                    <motion.tr
                      key={`${row.date}-${i}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="border-t border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition"
                    >
                      <td className="py-3.5 px-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{row.date}</td>
                      <td className="py-3.5 px-3 font-semibold text-neutral-800 dark:text-neutral-100">{row.lesson}</td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${row.accuracy >= 85 ? 'bg-accent-500' : row.accuracy >= 70 ? 'bg-gold-500' : 'bg-coral-500'}`}
                              style={{ width: `${row.accuracy}%` }}
                            />
                          </div>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-200 w-10">{row.accuracy}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3"><StarRow count={row.stars} /></td>
                      <td className="py-3.5 px-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{row.duration}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  )
}
