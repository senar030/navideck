import { Empty } from './DashboardParts'
import { sectionById } from './DashboardRegistry'

/*
 * The page behind a start-page "Weitere laden…" tile. It is a component that
 * only looks a section up by id, so it stands apart from the registry it reads
 * — which has to stay free of component exports for fast refresh to work.
 */
export function SectionPage({ id }: { id: string }) {
  const def = sectionById(id)

  if (!def?.Page) {
    return (
      <div className="view">
        <header className="view-head">
          <h2>Unbekannte Kategorie</h2>
        </header>
        <Empty>Diese Kategorie gibt es nicht (mehr).</Empty>
      </div>
    )
  }

  const Page = def.Page
  return (
    <div className="view">
      <header className="view-head">
        <h2>{def.pageTitle}</h2>
      </header>
      <Page />
    </div>
  )
}
