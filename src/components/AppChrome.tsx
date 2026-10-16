import { useEffect, useRef, useState } from 'react'
import { useNav } from '../state/NavContext'
import { usePrefs } from '../state/PrefsContext'
import { useTheme } from '../state/ThemeContext'
import {
  IconBack,
  IconClose,
  IconDesktop,
  IconGamepad,
  IconMoon,
  IconMore,
  IconSearch,
  IconSettings,
  IconSun,
} from './Icons'
import { SearchResults } from './SearchResults'

type Props = {
  onOpenSettings: () => void
  scrolled?: boolean
}

export function AppChrome({ onOpenSettings, scrolled = false }: Props) {
  const { view, back, canBack } = useNav()
  const { theme, toggleTheme } = useTheme()
  const { uiMode, toggleUiMode } = usePrefs()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [moreOpen])

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    setSearchOpen(false)
    setQuery('')
    setMoreOpen(false)
  }, [view])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        setSearchOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function closeSearch() {
    setSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      <header className={`chrome ${searchOpen ? 'is-search' : ''} ${scrolled && !searchOpen ? 'is-scrolled' : ''}`}>
        <div className="chrome-start">
          {canBack ? (
            <button type="button" className="back-btn" onClick={back}>
              <IconBack /> Zurück
            </button>
          ) : null}
        </div>
        <label className="chrome-search">
          <IconSearch />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Alben, Künstler, Titel"
            autoComplete="off"
            spellCheck={false}
            tabIndex={searchOpen ? 0 : -1}
          />
          <button type="button" className="icon-btn" aria-label="Suche schließen" onClick={closeSearch} tabIndex={searchOpen ? 0 : -1}>
            <IconClose />
          </button>
        </label>
        <div className="chrome-end">
          <button
            type="button"
            className="icon-btn"
            aria-label="Suche"
            data-tip="Suche"
            onClick={() => {
              setMoreOpen(false)
              setSearchOpen(true)
            }}
          >
            <IconSearch />
          </button>
          <div className="chrome-more" ref={moreRef}>
            <button
              type="button"
              className={`icon-btn ${moreOpen ? 'is-on' : ''}`}
              aria-label="Weitere Optionen"
              data-tip="Weitere Optionen"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
            >
              <IconMore />
            </button>
            {moreOpen ? (
              <div className="chrome-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMoreOpen(false)
                    onOpenSettings()
                  }}
                >
                  <IconSettings />
                  Einstellungen
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    toggleTheme()
                    setMoreOpen(false)
                  }}
                >
                  {theme === 'dark' ? <IconSun /> : <IconMoon />}
                  {theme === 'dark' ? 'Hellmodus' : 'Dunkelmodus'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    toggleUiMode()
                    setMoreOpen(false)
                  }}
                >
                  {uiMode === 'deck' ? <IconDesktop /> : <IconGamepad />}
                  {uiMode === 'deck' ? 'Desktop-Ansicht' : 'Deck-Ansicht'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {searchOpen ? (
        <div className="search-overlay">
          <SearchResults query={query} onPick={closeSearch} />
        </div>
      ) : null}
    </>
  )
}
