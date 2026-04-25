type Theme = 'dark' | 'light' | 'system'

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const effective = theme === 'system' ? getSystemTheme() : theme
  if (effective === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

export function initTheme() {
  const saved = (localStorage.getItem('theme') as Theme) || 'dark'
  applyTheme(saved)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = (localStorage.getItem('theme') as Theme) || 'dark'
    if (current === 'system') applyTheme('system')
  })
}

export function setTheme(theme: Theme) {
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

export function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'dark'
}
