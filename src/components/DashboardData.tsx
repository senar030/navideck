import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { NavidromeClient } from '../api/client'
import type { Album, AlbumListType, Artist, Genre, SearchResult, Song } from '../api/types'
import { useAuth } from '../state/AuthContext'

/*
 * Loading for the start page. Everything here is either a plain fetch hook or,
 * for the strips that must not reshuffle on every visit, a module-level store
 * that survives leaving and re-entering the page.
 */

/** The random strips are deliberately short and have no "more" tile. */
const RANDOM_ALBUMS = 10
const RANDOM_ARTISTS = 10

/* ==========================================================================
   Data
   ========================================================================== */

export function useAlbums(type: AlbumListType, limit = 0) {
  const { client, selectedFolderIds } = useAuth()
  const [state, setState] = useState<{ key: string; albums: Album[] }>({ key: '', albums: [] })
  const key = `${type}|${limit}|${selectedFolderIds.join(',')}`
  /*
   * "Loading" is not a flag of its own here: the strip is still loading as long
   * as the albums it holds belong to a different request than the one the props
   * describe. That way the render that changes `type` already shows the spinner
   * instead of the previous list — an effect could only tell us one render late.
   */
  const loading = state.key !== key

  useEffect(() => {
    if (!client) return
    let alive = true
    void client
      .getAlbumList(type)
      .then((list) => {
        if (alive) setState({ key, albums: limit ? list.slice(0, limit) : list })
      })
      .catch(() => {
        if (alive) setState({ key, albums: [] })
      })
    return () => {
      alive = false
    }
  }, [client, key, limit, type])

  return { albums: state.albums, loading }
}

/*
 * The three favourite sections read the same starred list, so they share one
 * request while it is in flight. The result is not kept: starring something and
 * coming back to the start page has to show the new state.
 */
let starredInFlight: { key: string; data: Promise<SearchResult> } | null = null

function loadStarred(client: NavidromeClient, key: string): Promise<SearchResult> {
  if (starredInFlight?.key === key) return starredInFlight.data
  const entry = { key, data: client.getStarred() }
  starredInFlight = entry
  const clear = () => {
    if (starredInFlight === entry) starredInFlight = null
  }
  void entry.data.then(clear, clear)
  return entry.data
}

export function useStarred() {
  const { client, selectedFolderIds } = useAuth()
  const folderKey = selectedFolderIds.join(',')
  const [state, setState] = useState<{ key: string; data: SearchResult }>({ key: '', data: {} })
  /* Loading for as long as the favourites on screen are another library's. */
  const loading = state.key !== folderKey

  useEffect(() => {
    if (!client) return
    let alive = true
    void loadStarred(client, folderKey)
      .then((next) => {
        if (alive) setState({ key: folderKey, data: next })
      })
      .catch(() => {
        if (alive) setState({ key: folderKey, data: {} })
      })
    return () => {
      alive = false
    }
  }, [client, folderKey])

  return { data: state.data, loading }
}

/*
 * The random strips have to survive leaving and re-entering the start page, or
 * they reshuffle every time. A module-level store keeps them for the session
 * without touching local storage, and lets the reload button in the heading — a
 * different part of the tree than the tiles — drive the same state.
 */
type RandomStore<T> = {
  subscribe: (listener: () => void) => () => void
  snapshot: () => { items: T[]; loading: boolean; failed: boolean }
  refresh: (client: NavidromeClient) => void
  ensure: (client: NavidromeClient) => void
}

function createRandomStore<T>(fetch: (client: NavidromeClient) => Promise<T[]>, count: number): RandomStore<T> {
  let state = { items: [] as T[], loading: false, failed: false }
  let loaded = false
  let inFlight: Promise<void> | null = null
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const listener of listeners) listener()
  }

  const refresh = (client: NavidromeClient) => {
    if (inFlight) return
    state = { ...state, loading: true }
    emit()
    inFlight = fetch(client)
      .then((list) => {
        state = { items: list.slice(0, count), loading: false, failed: false }
        loaded = true
      })
      .catch(() => {
        state = { ...state, loading: false, failed: true }
      })
      .finally(() => {
        inFlight = null
        emit()
      })
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    snapshot: () => state,
    refresh,
    ensure: (client) => {
      if (!loaded) refresh(client)
    },
  }
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Artists the server has a picture for, so the strip is not mostly placeholders. */
async function randomArtistPool(client: NavidromeClient): Promise<Artist[]> {
  const groups = await client.getArtists()
  const all = groups.flatMap((group) => group.artist ?? [])
  const withArt = all.filter((artist) => artist.coverArt)
  return shuffle(withArt.length >= RANDOM_ARTISTS ? withArt : all)
}

export const randomAlbumStore = createRandomStore<Album>((client) => client.getAlbumList('random'), RANDOM_ALBUMS)
export const randomArtistStore = createRandomStore<Artist>(randomArtistPool, RANDOM_ARTISTS)

export function useRandom<T>(store: RandomStore<T>) {
  const { client } = useAuth()
  const { items, loading, failed } = useSyncExternalStore(store.subscribe, store.snapshot)

  useEffect(() => {
    if (client) store.ensure(client)
  }, [client, store])

  const refresh = useCallback(() => {
    if (client) store.refresh(client)
  }, [client, store])

  return { items, loading, failed, refresh }
}

export function useGenres() {
  const { client, selectedFolderIds } = useAuth()
  const [genres, setGenres] = useState<Genre[]>([])

  useEffect(() => {
    if (!client) return
    let alive = true
    void client.getGenres().then((list) => {
      if (alive) setGenres([...list].sort((a, b) => a.value.localeCompare(b.value)))
    })
    return () => {
      alive = false
    }
  }, [client, selectedFolderIds])

  return genres
}

/**
 * The songs that were really played, newest first. The queue a song came from
 * says nothing about whether it was listened to; the play date the server keeps
 * for it does.
 */
export function useRecentSongs(limit = 30) {
  const { client, selectedFolderIds } = useAuth()
  const key = `${limit}|${selectedFolderIds.join(',')}`
  const [state, setState] = useState<{ key: string; songs: Song[] }>({ key: '', songs: [] })
  const loading = state.key !== key

  useEffect(() => {
    if (!client) return
    let alive = true
    void client
      .getRecentSongs(limit)
      .then((list) => {
        if (alive) setState({ key, songs: list })
      })
      .catch(() => {
        if (alive) setState({ key, songs: [] })
      })
    return () => {
      alive = false
    }
  }, [client, key, limit])

  return { songs: state.songs, loading }
}
