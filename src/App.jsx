import { lazy, Suspense, useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Treino from './Treino'
import Historico from './Historico'
import Exercicios from './Exercicios'

// As Estatísticas (e o Chart.js) só são descarregadas quando o separador é aberto,
// para o ecrã de treino abrir depressa no ginásio.
// A extensão .jsx é obrigatória: sem ela, no Windows (que ignora maiúsculas), './Estatisticas'
// podia resolver para o módulo de cálculos estatisticas.js.
const Estatisticas = lazy(() => import('./Estatisticas.jsx'))

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

  if (aCarregar) return <p>A carregar...</p>
  if (!session) return <Login />
  return <Principal email={session.user.email} />
}

const SEPARADORES = [
  { id: 'treino', nome: 'Treino', icone: IconeTreino },
  { id: 'historico', nome: 'Histórico', icone: IconeHistorico },
  { id: 'exercicios', nome: 'Exercícios', icone: IconeExercicios },
  { id: 'estatisticas', nome: 'Estatísticas', icone: IconeEstatisticas },
  { id: 'perfil', nome: 'Perfil', icone: IconePerfil },
]

function Principal({ email }) {
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
      {/* O Histórico é montado de novo sempre que se abre o separador, para recarregar os treinos */}
      {separador === 'historico' && <Historico />}
      {separador === 'exercicios' && (
        <Exercicios soSemMusculosInicial={Boolean(opcoes.soSemMusculos)} />
      )}
      {separador === 'estatisticas' && (
        <Suspense fallback={<p className="subtitulo">A carregar...</p>}>
          <Estatisticas onIrPara={irPara} />
        </Suspense>
      )}
      {separador === 'perfil' && <Perfil email={email} />}

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

function Perfil({ email }) {
  return (
    <div>
      <h1>Perfil</h1>
      <div className="cartao">
        <p className="subtitulo perfil-rotulo">Email</p>
        <p className="perfil-valor">{email}</p>
      </div>
      <button className="botao-secundario" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
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
