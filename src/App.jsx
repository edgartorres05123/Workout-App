import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Treino from './Treino'
import Historico from './Historico'
import Exercicios from './Exercicios'

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
  // As Estatísticas vão entrar aqui, entre Exercícios e Perfil (a barra está preparada para 5)
  { id: 'perfil', nome: 'Perfil', icone: IconePerfil },
]

function Principal({ email }) {
  const [separador, setSeparador] = useState('treino')

  return (
    <div className="com-navegacao">
      {/* O Treino fica sempre montado para não perder os exercícios ainda sem séries ao mudar de separador */}
      <div hidden={separador !== 'treino'}>
        <Treino />
      </div>
      {/* O Histórico é montado de novo sempre que se abre o separador, para recarregar os treinos */}
      {separador === 'historico' && <Historico />}
      {separador === 'exercicios' && <Exercicios />}
      {separador === 'perfil' && <Perfil email={email} />}

      <nav className="navegacao">
        {SEPARADORES.map(({ id, nome, icone: Icone }) => (
          <button
            key={id}
            className={separador === id ? 'ativo' : ''}
            onClick={() => setSeparador(id)}
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

function IconePerfil() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  )
}
