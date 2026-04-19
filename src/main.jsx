import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../void-awakening.jsx'

// localStorage adapter for window.storage (used by the game for save/load)
window.storage = {
  set:    (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  get:    (key)        => Promise.resolve(localStorage.getItem(key) != null ? { value: localStorage.getItem(key) } : null),
  delete: (key)        => Promise.resolve(localStorage.removeItem(key)),
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
