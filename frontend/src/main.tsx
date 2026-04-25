import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const saved = localStorage.getItem('theme') || 'dark'
if (saved === 'light') document.documentElement.classList.add('light')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
