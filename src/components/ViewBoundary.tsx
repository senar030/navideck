import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  /* Changes when the user goes somewhere else; the next view starts clean. */
  resetKey: string
  children: ReactNode
}

type State = { error: Error | null; resetKey: string }

/*
 * A view that throws must not take the whole page with it. React unmounts the
 * tree on an uncaught render error, which looks like a white screen and hides
 * the one thing worth reading — the message. This keeps the rail and the space
 * switcher alive, names the error, and lets the user walk away from it.
 */
export class ViewBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null
    return { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The full stack stays in the console for a report; the page shows the message.
    console.error('Navideck: Ansicht abgestürzt –', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="view crash-view">
        <p className="eyebrow">Fehler</p>
        <h2>Diese Ansicht konnte nicht gezeichnet werden.</h2>
        <p className="muted">
          Alles andere läuft weiter – über die Navigation kommst du woanders hin. Die Meldung
          hilft beim Suchen:
        </p>
        <p className="crash-message">
          <code>{error.message || error.name}</code>
        </p>
        <div className="crash-actions">
          <button type="button" className="primary-btn" onClick={() => this.setState({ error: null })}>
            Erneut versuchen
          </button>
          <button type="button" className="text-btn" onClick={() => window.location.reload()}>
            Neu laden
          </button>
        </div>
      </div>
    )
  }
}
