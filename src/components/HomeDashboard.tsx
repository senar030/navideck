import { DashboardBoard } from './DashboardBoard'

/** v3: the categories changed again — one new, two gone and two swapped — so old
 * saved orders are not carried over. */
const DASH_KEY = 'navideck.dashboard.v3'

export function HomeDashboard() {
  return (
    <div className="view dashboard">
      <DashboardBoard
        storageKey={DASH_KEY}
        scope="music"
        renderHead={({ edit, toggle }) => (
          <header className="view-head">
            <h2>Musik</h2>
            <button type="button" className={`chip ${edit ? 'is-on' : ''}`} onClick={toggle}>
              {edit ? 'Fertig' : 'Anpassen'}
            </button>
          </header>
        )}
      />
    </div>
  )
}
