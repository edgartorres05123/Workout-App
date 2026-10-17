import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Regista o service worker da PWA. Com registerType 'autoUpdate', quando há uma versão nova
// publicada no Vercel a página recarrega sozinha. As séries já estão gravadas no Supabase; só um
// exercício adicionado ao treino e ainda sem séries teria de ser adicionado outra vez.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
