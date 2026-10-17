import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Login from './Login'

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
  return <TesteLigacao email={session.user.email} />
}

// Ecrã temporário só para testar a base de dados
function TesteLigacao({ email }) {
  const [exercicios, setExercicios] = useState([])
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data, error } = await supabase
      .from('exercicios')
      .select('*')
      .order('nome')
    if (error) setErro(error.message)
    else setExercicios(data)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar(e) {
    e.preventDefault()
    if (!nome.trim()) return
    const { error } = await supabase
      .from('exercicios')
      .insert({ nome: nome.trim() })
    if (error) {
      setErro(error.message)
    } else {
      setNome('')
      setErro('')
      carregar()
    }
  }

  return (
    <div>
      <h1>Olá!</h1>
      <p className="subtitulo">Entraste como {email}</p>

      <div className="cartao">
        <h2>Os meus exercícios</h2>
        <form className="linha" onSubmit={adicionar}>
          <input
            placeholder="Ex: Supino plano"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <button type="submit">+</button>
        </form>
        {erro && <p className="erro">{erro}</p>}
        <ul className="lista">
          {exercicios.map((ex) => (
            <li key={ex.id}>{ex.nome}</li>
          ))}
        </ul>
        {exercicios.length === 0 && (
          <p className="subtitulo">Ainda não tens exercícios.</p>
        )}
      </div>

      <button className="botao-secundario" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>
    </div>
  )
}