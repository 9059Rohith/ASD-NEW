import { useEffect, useState } from 'react'
import { Download, FileText, Send, ShieldCheck } from 'lucide-react'
import api from '../../services/api'
import './TamilDoctorReports.css'

const EMPTY = { doctor_name: '', doctor_email: '', doctor_phone: '', channel: 'email', timezone: 'Asia/Kolkata', enabled: false, consent: false }

export default function TamilDoctorReports() {
  const [config, setConfig] = useState(EMPTY)
  const [summary, setSummary] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const refresh = async () => {
    setLoading(true); setError('')
    try {
      const [settings, preview, previous] = await Promise.all([
        api.get('/tamil-reports/config'), api.get('/tamil-reports/preview'), api.get('/tamil-reports/history'),
      ])
      setConfig({ ...EMPTY, ...settings.data })
      setSummary(preview.data)
      setHistory(previous.data.reports || [])
    } catch (cause) { setError(cause.response?.data?.detail || 'Daily Tamil reports could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  const update = (key, value) => setConfig(previous => ({ ...previous, [key]: value }))
  const save = async event => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const payload = Object.fromEntries(Object.keys(EMPTY).map(key => [key, config[key]]))
      payload.doctor_email ||= null; payload.doctor_phone ||= null
      const response = await api.put('/tamil-reports/config', payload)
      setConfig({ ...EMPTY, ...response.data })
      setNotice(response.data.enabled ? 'Doctor report settings saved. Daily delivery begins when the provider is configured.' : 'Settings saved. Automatic delivery is off.')
    } catch (cause) { setError(cause.response?.data?.detail || 'Report settings could not be saved.') }
    finally { setSaving(false) }
  }
  const download = async () => {
    setError('')
    try {
      const response = await api.get('/tamil-reports/pdf', { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url; link.download = `tamil-learning-${summary?.day || 'daily'}.pdf`
      document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('The Tamil PDF could not be downloaded.') }
  }
  const send = async () => {
    if (!summary?.day) return
    setSaving(true); setError(''); setNotice('')
    try {
      const result = await api.post(`/tamil-reports/send/${summary.day}`)
      setNotice(result.data.status === 'accepted' ? 'The provider accepted the report. Delivery confirmation may follow later.' : `Report status: ${result.data.status}.`)
      const previous = await api.get('/tamil-reports/history')
      setHistory(previous.data.reports || [])
    } catch (cause) { setError(cause.response?.data?.detail || 'The report could not be sent.') }
    finally { setSaving(false) }
  }
  return <section className="doctor-report-panel" aria-labelledby="doctor-report-heading"><header><div><p>CAREGIVER CONTROL · TAMIL LEARNING</p><h2 id="doctor-report-heading">Daily doctor report</h2><span>Preview a real Tamil PDF, then decide whether to enable a daily update.</span></div><FileText size={38} aria-hidden="true" /></header>
    {loading ? <p role="status">Loading report settings…</p> : <>
      <div className="doctor-report-stats"><div><strong>{summary?.practice_attempts || 0}</strong><span>Practice attempts · {summary?.day}</span></div><div><strong>{summary?.game_rounds || 0}</strong><span>Saved game rounds</span></div><div><strong>{config.delivery_status || 'Not configured'}</strong><span>Delivery state</span></div></div>
      <div className="doctor-report-actions"><button type="button" onClick={download}><Download size={17} /> Download Tamil PDF</button>{config.enabled && config.provider_ready && <button type="button" disabled={saving} onClick={send}><Send size={17} /> Send this report to doctor</button>}</div>
      <form onSubmit={save}><h3>Doctor and delivery preferences</h3><div className="doctor-report-fields"><label>Doctor’s name<input value={config.doctor_name || ''} onChange={event => update('doctor_name', event.target.value)} required minLength={2} maxLength={100} /></label><label>Channel<select value={config.channel || 'email'} onChange={event => update('channel', event.target.value)}><option value="email">Email PDF</option><option value="whatsapp">Official WhatsApp Business PDF</option></select></label><label>Doctor’s email<input type="email" value={config.doctor_email || ''} onChange={event => update('doctor_email', event.target.value)} required={config.channel === 'email' && config.enabled} /></label><label>Doctor’s phone (international)<input type="tel" value={config.doctor_phone || ''} onChange={event => update('doctor_phone', event.target.value)} placeholder="+919876543210" required={config.channel === 'whatsapp' && config.enabled} /></label><label>Timezone<input value={config.timezone || 'Asia/Kolkata'} onChange={event => update('timezone', event.target.value)} required /></label></div><label className="doctor-report-check"><input type="checkbox" checked={Boolean(config.consent)} onChange={event => update('consent', event.target.checked)} /><span>I am the caregiver and authorize sharing this child’s daily learning PDF with this doctor through the chosen channel.</span></label><label className="doctor-report-check"><input type="checkbox" checked={Boolean(config.enabled)} onChange={event => update('enabled', event.target.checked)} /><span>Enable one daily report after 7:00 a.m. in the selected timezone.</span></label><p className="doctor-report-note"><ShieldCheck size={16} /> Delivery requires provider credentials. Changing the doctor or channel pauses sending until you consent again. A calendar event is a reminder, not PDF delivery.</p><button className="doctor-report-save" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save doctor report settings'}</button></form>
      {history.length > 0 && <div className="doctor-report-history"><h3>Previous reports</h3><ul>{history.slice(0, 5).map(row => <li key={`${row.day}-${row.channel}`}><span>{row.day}</span><span>{row.channel}</span><strong>{row.status}</strong></li>)}</ul></div>}
    </>}
    {error && <p role="alert" className="doctor-report-error">{error}</p>}{notice && <p role="status" className="doctor-report-notice">{notice}</p>}
  </section>
}
