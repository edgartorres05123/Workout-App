import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './fonte.css'
import './index.css'
import App from './App.jsx'

// Regista o service worker da PWA. Com registerType 'autoUpdate', quando há uma versão nova
// publicada no Vercel a página recarrega sozinha. Os blocos e as voltas marcadas já estão gravados
// no Supabase; só os números escritos numa volta ainda não marcada voltariam ao pré-preenchimento.
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
