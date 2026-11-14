import { useEffect, useState } from 'react'
import { CaseProvider } from './state/caseStore'
import ProApp from './ui/pro/ProApp'
import NoirApp from './ui/noir/NoirApp'

export type Skin = 'pro' | 'noir'

function parse(): { skin: Skin; view: string } {
  const [, skin, view] = window.location.hash.split('/')
  return { skin: skin === 'noir' ? 'noir' : 'pro', view: view ?? '' }
}

/** Two UIs over one case store: #/pro/<step> and #/noir/<room>. */
export default function Root() {
  const [route, setRoute] = useState(parse)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('alibai-theme') as 'light' | 'dark') || 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.skin = route.skin
    document.documentElement.dataset.theme = route.skin === 'pro' ? theme : 'light'
  }, [route.skin, theme])

  const go = (skin: Skin, view: string) => {
    window.location.hash = `/${skin}/${view}`
  }
  const toggleTheme = () =>
    setTheme((t) => {
      const n = t === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem('alibai-theme', n)
      } catch {
        /* storage unavailable */
      }
      return n
    })

  return (
    <CaseProvider>
      {route.skin === 'pro' ? (
        <ProApp view={route.view} go={(v) => go('pro', v)} theme={theme} toggleTheme={toggleTheme} switchSkin={() => go('noir', '')} />
      ) : (
        <NoirApp view={route.view} go={(v) => go('noir', v)} switchSkin={() => go('pro', '')} />
      )}
    </CaseProvider>
  )
}
