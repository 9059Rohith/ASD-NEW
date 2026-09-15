import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="app-recovery" role="alert"><span lang="ta">மீண்டும் தொடங்கலாம்.</span><h1>Let’s get you back to learning.</h1><p>This page could not finish loading. Reload to try again, or return home and choose an activity.</p><div><button type="button" onClick={() => window.location.reload()}>Reload page</button><a href="/">Return home</a></div></main>
  }
}
