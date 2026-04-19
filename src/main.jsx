import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../void-awakening.jsx'

// localStorage adapter for window.storage (used by the game for save/load)
if (!window.storage) {
  window.storage = {
    set:    (key, value) => { try { localStorage.setItem(key, value); } catch {} return Promise.resolve(); },
    get:    (key)        => { try { const v = localStorage.getItem(key); return Promise.resolve(v != null ? { value: v } : null); } catch { return Promise.resolve(null); } },
    delete: (key)        => { try { localStorage.removeItem(key); } catch {} return Promise.resolve(); },
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
