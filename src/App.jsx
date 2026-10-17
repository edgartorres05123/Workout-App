import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Treino from './Treino'

// Só o ecrã de treino vai no ficheiro principal, para abrir depressa no ginásio; os outros
// separadores (e o Chart.js) são descarregados quando são abertos. Sem rede também abrem,
// porque o service worker guarda todos estes ficheiros.
const Historico = lazy(() => import('./Historico'))
const Exercicios = lazy(() => import('./Exercicios'))
const PaginaEstatisticas = lazy(() => import('./PaginaEstatisticas'))
const Perfil = lazy(() => import('./Perfil'))

export default function App() {
  const [session, setSession] = useState(null)
  const [aCarregar, setACarregar] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setACarregar(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSession(novaSessao)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <>
      <AvisoSemLigacao />
      {aCarregar ? (
        <p>A carregar...</p>
      ) : !session ? (
        <Login />
      ) : (
        <Principal email={session.user.email} utilizadorId={session.user.id} />
      )}
    </>
  )
}

// Faixa no topo enquanto o telemóvel estiver sem rede. A interface continua a abrir (o service
// worker guarda o esqueleto da app) e os pedidos que falham mostram a mesma mensagem.
function AvisoSemLigacao() {
  const [ligado, setLigado] = useState(() => navigator.onLine)

  useEffect(() => {
    const aoLigar = () => setLigado(true)
    const aoDesligar = () => setLigado(false)
    window.addEventListener('online', aoLigar)
    window.addEventListener('offline', aoDesligar)
    return () => {
      window.removeEventListener('online', aoLigar)
      window.removeEventListener('offline', aoDesligar)
    }
  }, [])

  if (ligado) return null
  return (
    <div className="aviso-sem-ligacao" role="status">
      Sem ligação à internet. Os dados aparecem quando voltares a estar online.
    </div>
  )
}

const SEPARADORES = [
  { id: 'treino', nome: 'Treino', icone: IconeTreino },
  { id: 'historico', nome: 'Histórico', icone: IconeHistorico },
  { id: 'exercicios', nome: 'Exercícios', icone: IconeExercicios },
  { id: 'estatisticas', nome: 'Estatísticas', icone: IconeEstatisticas },
  { id: 'perfil', nome: 'Perfil', icone: IconePerfil },
]

function Principal({ email, utilizadorId }) {
  const [separador, setSeparador] = useState('treino')
  // Opções para o separador aberto (por exemplo, { soSemMusculos: true } nos Exercícios)
  const [opcoes, setOpcoes] = useState({})

  function irPara(id, novasOpcoes = {}) {
    setSeparador(id)
    setOpcoes(novasOpcoes)
    window.scrollTo(0, 0)
  }

  return (
    <div className="com-navegacao">
      {/* O Treino fica sempre montado para não perder os exercícios ainda sem séries ao mudar de separador */}
      <div hidden={separador !== 'treino'}>
        <Treino />
      </div>
      {/* Os outros separadores são montados de novo sempre que se abrem, para recarregar os dados */}
      <Suspense fallback={<p className="subtitulo">A carregar...</p>}>
        {separador === 'historico' && <Historico />}
        {separador === 'exercicios' && (
          <Exercicios soSemMusculosInicial={Boolean(opcoes.soSemMusculos)} />
        )}
        {separador === 'estatisticas' && <PaginaEstatisticas onIrPara={irPara} />}
        {separador === 'perfil' && <Perfil email={email} utilizadorId={utilizadorId} />}
      </Suspense>

      <nav className="navegacao">
        {SEPARADORES.map(({ id, nome, icone: Icone }) => (
          <button
            key={id}
            className={separador === id ? 'ativo' : ''}
            onClick={() => irPara(id)}
            aria-current={separador === id ? 'page' : undefined}
          >
            <Icone />
            <span>{nome}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function IconeTreino() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
    </svg>
  )
}

function IconeHistorico() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function IconeExercicios() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </svg>
  )
}

function IconeEstatisticas() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
    </svg>
  )
}

function IconePerfil() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
