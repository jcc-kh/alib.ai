import { useEffect, useState } from 'react'
import { CaseProvider } from './state/caseStore'
import ProApp from './ui/pro/ProApp'

function parse(): { view: string } {
  const [, , view] = window.location.hash.split('/')
  return { view: view ?? '' }
}

/** One dashboard over one case store: #/pro/<view>. */
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
    document.documentElement.dataset.skin = 'pro'
    document.documentElement.dataset.theme = theme
  }, [theme])

  const go = (view: string) => {
    window.location.hash = `/pro/${view}`
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
      <ProApp view={route.view} go={go} theme={theme} toggleTheme={toggleTheme} />
    </CaseProvider>
  )
}
