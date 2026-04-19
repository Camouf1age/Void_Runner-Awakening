import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../void-awakening.jsx'

if (!window.storage) {
  window.storage = {
    set:    (key, value) => { try { localStorage.setItem(key, value); } catch {} return Promise.resolve(); },
    get:    (key)        => { try { const v = localStorage.getItem(key); return Promise.resolve(v != null ? { value: v } : null); } catch { return Promise.resolve(null); } },
    delete: (key)        => { try { localStorage.removeItem(key); } catch {} return Promise.resolve(); },
  };
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: { background: '#07080f', color: '#ff4466', fontFamily: 'monospace', padding: '2rem', whiteSpace: 'pre-wrap', fontSize: '14px' }
      }, '[ VOID RUNNER — RENDER ERROR ]\n\n' + this.state.error.message + '\n\n' + this.state.error.stack);
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(ErrorBoundary, null, React.createElement(App))
)
