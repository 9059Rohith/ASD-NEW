import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, ArrowLeft, CalendarDays, ChevronRight, ClipboardList,
  Save, Search, ShieldCheck, Stethoscope, UserPlus, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'

import DashboardLayout from '../components/layout/DashboardLayout'
import { noteDraftToPayload, validateNoteDraft } from '../features/clinicalNotes/noteState'
import { buildEvidenceRows, reviewSignalFor } from '../features/dashboard/therapistReview'
import { clinicalNotesAPI, therapistAPI } from '../services/api'


function fmtDate(iso) {
  if (!iso) return 'No sessions yet'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}


function childLabel(child) {
  return child.child_name || child.full_name || child.email
}


export default function TherapistDashboard() {
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [query, setQuery] = useState('')
  const [assignEmail, setAssignEmail] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [notes, setNotes] = useState([])
  const [noteDraft, setNoteDraft] = useState({ text: '', nextTarget: '', caregiverVisible: true })
  const [noteSaving, setNoteSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    therapistAPI.getChildren()
      .then((response) => {
        setChildren(response.data.children || [])
        setForbidden(false)
      })
      .catch((error) => {
        if (error.response?.status === 403) setForbidden(true)
        else toast.error('Could not load the caseload.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => load(), [load])

  const visibleChildren = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return children
    return children.filter((child) => `${childLabel(child)} ${child.email}`.toLowerCase().includes(normalized))
  }, [children, query])

  const openDetail = async (child) => {
    setDetail({ child, analysis: null })
    setNotes([])
    setNoteDraft({ text: '', nextTarget: child.weakest?.phoneme || '', caregiverVisible: true })
    setDetailLoading(true)
    try {
      const [childResponse, notesResponse] = await Promise.all([
        therapistAPI.getChild(child.id),
        clinicalNotesAPI.list(child.id),
      ])
      setDetail(childResponse.data)
      setNotes(notesResponse.data.notes || [])
    } catch {
      toast.error('Could not load the child review.')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const assign = async (event) => {
    event.preventDefault()
    if (!assignEmail.trim()) return
    setAssigning(true)
    try {
      const response = await therapistAPI.assignChild(assignEmail.trim())
      toast.success(response.data.message || 'Child assigned')
      setAssignEmail('')
      load()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not assign the child.')
    } finally {
      setAssigning(false)
    }
  }

  const saveNote = async (event) => {
    event.preventDefault()
    const validation = validateNoteDraft(noteDraft)
    if (!validation.valid) {
      toast.error(validation.message)
      return
    }
    setNoteSaving(true)
    try {
      const response = await clinicalNotesAPI.create(detail.child.id, noteDraftToPayload(noteDraft))
      setNotes((current) => [response.data, ...current])
      setNoteDraft((current) => ({ ...current, text: '' }))
      toast.success('Clinical note saved for the care team.')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Could not save the clinical note.')
    } finally {
      setNoteSaving(false)
    }
  }

  if (forbidden) {
    return (
      <DashboardLayout variant="care" maxWidth="max-w-[1180px]">
        <section className="therapist-empty-state">
          <ShieldCheck aria-hidden="true" />
          <h1>Therapist access required</h1>
          <p>This workspace is limited to verified therapist and administrator accounts.</p>
        </section>
      </DashboardLayout>
    )
  }

  if (detail) {
    const rows = buildEvidenceRows(detail.analysis?.by_phoneme)
    const metrics = detail.analysis?.metrics
    const child = detail.child
    const weakest = detail.analysis?.weakest

    return (
      <DashboardLayout variant="care" maxWidth="max-w-[1180px]">
        <button className="therapist-back" onClick={() => setDetail(null)}>
          <ArrowLeft aria-hidden="true" /> All children
        </button>

        <header className="therapist-review-header">
          <div>
            <p>Speech review</p>
            <h1>{childLabel(child)}</h1>
            <span>{child.child_age ? `Age ${child.child_age} · ` : ''}{child.total_sessions || 0} recorded sessions</span>
          </div>
          <div className="therapist-review-meta">
            <span><ShieldCheck aria-hidden="true" /> Raw audio not retained</span>
            <span><CalendarDays aria-hidden="true" /> Last active {fmtDate(child.last_active)}</span>
          </div>
        </header>

        {detailLoading ? (
          <div className="therapist-loading" role="status">Loading speech evidence…</div>
        ) : !detail.analysis?.has_data ? (
          <section className="therapist-empty-state compact">
            <ClipboardList aria-hidden="true" />
            <h2>No scored speech evidence yet</h2>
            <p>The review table will populate after this child completes a scored practice.</p>
          </section>
        ) : (
          <>
            <section className="therapist-summary-grid" aria-label="Speech summary">
              {[
                ['Accuracy', metrics?.accuracy],
                ['Clarity (GOP)', metrics?.clarity],
                ['Sound match', metrics?.sound_match],
                ['Airflow', metrics?.airflow],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{Math.round(Number(value) || 0)}%</strong>
                </div>
              ))}
            </section>

            <div className="therapist-review-grid">
              <section className="therapist-evidence" aria-labelledby="phoneme-evidence-heading">
                <div className="therapist-section-heading">
                  <div><h2 id="phoneme-evidence-heading">Phoneme evidence</h2><p>Lowest-accuracy targets are placed first for review.</p></div>
                  {weakest && <span>Next review: <b className="tamil-text">{weakest.phoneme}</b></span>}
                </div>
                <div className="therapist-table-wrap">
                  <table>
                    <thead><tr><th>Target</th><th>Accuracy</th><th>Attempts</th><th>Review signal</th></tr></thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.phoneme}>
                          <td className="tamil-text">{row.phoneme}</td>
                          <td><div className="evidence-score"><span style={{ width: `${row.accuracy}%` }} /><b>{row.accuracy}%</b></div></td>
                          <td>{row.attempts}</td>
                          <td><span className={`review-signal signal-${row.signal.toLowerCase().replace(' ', '-')}`}>{row.signal}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <aside className="therapist-note-panel" aria-labelledby="clinical-note-heading">
                <div className="therapist-section-heading"><div><h2 id="clinical-note-heading">Care-team note</h2><p>Give one observation and one next cue.</p></div></div>
                <form onSubmit={saveNote}>
                  <label htmlFor="clinical-note-text">Observation</label>
                  <textarea id="clinical-note-text" rows={5} maxLength={2000} value={noteDraft.text} onChange={(event) => setNoteDraft((current) => ({ ...current, text: event.target.value }))} placeholder="What changed, and what should the caregiver notice?" />
                  <label htmlFor="clinical-note-target">Next target</label>
                  <input id="clinical-note-target" maxLength={64} value={noteDraft.nextTarget} onChange={(event) => setNoteDraft((current) => ({ ...current, nextTarget: event.target.value }))} />
                  <label className="therapist-checkbox"><input type="checkbox" checked={noteDraft.caregiverVisible} onChange={(event) => setNoteDraft((current) => ({ ...current, caregiverVisible: event.target.checked }))} />Visible to caregiver</label>
                  <button type="submit" disabled={noteSaving}><Save aria-hidden="true" /> {noteSaving ? 'Saving…' : 'Save note'}</button>
                </form>
                {notes.length > 0 && (
                  <div className="therapist-note-history">
                    <h3>Recent notes</h3>
                    {notes.slice(0, 2).map((note) => <article key={note.id}><p>{note.text}</p><span>{note.therapist_name}{note.next_target ? ` · Next: ${note.next_target}` : ''}</span></article>)}
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </DashboardLayout>
    )
  }

  const needsReview = children.filter((child) => (child.avg_accuracy || 0) < 50).length
  const totalSessions = children.reduce((sum, child) => sum + (child.total_sessions || 0), 0)

  return (
    <DashboardLayout variant="care" maxWidth="max-w-[1180px]">
      <header className="therapist-caseload-header">
        <div><p>Clinical workspace</p><h1>Caseload</h1><span>Review evidence, record guidance, and keep caregivers aligned.</span></div>
        <div className="therapist-caseload-summary"><span><Users aria-hidden="true" /><b>{children.length}</b> children</span><span><AlertCircle aria-hidden="true" /><b>{needsReview}</b> review next</span><span><ClipboardList aria-hidden="true" /><b>{totalSessions}</b> sessions</span></div>
      </header>

      <section className="therapist-assign" aria-labelledby="assign-child-heading">
        <div><UserPlus aria-hidden="true" /><span><h2 id="assign-child-heading">Assign a child</h2><p>Use the caregiver account email.</p></span></div>
        <form onSubmit={assign}><input type="email" required value={assignEmail} onChange={(event) => setAssignEmail(event.target.value)} placeholder="caregiver@example.com" aria-label="Caregiver account email" /><button disabled={assigning}>{assigning ? 'Assigning…' : 'Assign'}</button></form>
      </section>

      <section className="therapist-caseload" aria-labelledby="caseload-table-heading">
        <div className="therapist-section-heading">
          <div><h2 id="caseload-table-heading">Assigned children</h2><p>Ordered by the clinical rollup returned by the service.</p></div>
          <label className="therapist-search"><Search aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search children" /></label>
        </div>
        {loading ? <div className="therapist-loading" role="status">Loading caseload…</div> : visibleChildren.length === 0 ? (
          <div className="therapist-empty-state compact"><Stethoscope aria-hidden="true" /><h2>No assigned children</h2><p>Assign a caregiver account above to begin.</p></div>
        ) : (
          <div className="therapist-table-wrap"><table><thead><tr><th>Child</th><th>Last active</th><th>Sessions</th><th>Accuracy</th><th>Review signal</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visibleChildren.map((child) => { const signal = reviewSignalFor(child.avg_accuracy); return <tr key={child.id}><td><b>{childLabel(child)}</b><span>{child.email}</span></td><td>{fmtDate(child.last_active)}</td><td>{child.total_sessions || 0}</td><td>{Math.round(child.avg_accuracy || 0)}%</td><td><span className={`review-signal signal-${signal.toLowerCase().replace(' ', '-')}`}>{signal}</span></td><td><button className="therapist-open" onClick={() => openDetail(child)} aria-label={`Review ${childLabel(child)}`}>Review <ChevronRight aria-hidden="true" /></button></td></tr> })}</tbody></table></div>
        )}
      </section>
    </DashboardLayout>
  )
}
