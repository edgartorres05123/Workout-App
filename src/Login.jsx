import { useState } from 'react'
import { Dumbbell } from 'lucide-react'
import { supabase } from './supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modo, setModo] = useState('entrar')
  const [mensagem, setMensagem] = useState('')
  const [aEnviar, setAEnviar] = useState(false)

  async function submeter(e) {
    e.preventDefault()
    setAEnviar(true)
    setMensagem('')

    const { error } =
      modo === 'entrar'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    if (error) setMensagem(error.message)
    setAEnviar(false)
  }

  return (
    <div className="login">
      <span className="login-logo" aria-hidden="true">
        <Dumbbell size={36} strokeWidth={2.4} />
      </span>
      <h1>Workout App</h1>
      <p className="subtitulo">
        {modo === 'entrar' ? 'Entra na tua conta' : 'Cria a tua conta'}
      </p>

      <form className="cartao" onSubmit={submeter}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Palavra-passe (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {mensagem && <p className="erro">{mensagem}</p>}
        <button type="submit" disabled={aEnviar}>
          {aEnviar ? 'A enviar...' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>

      <button
        className="botao-secundario"
        onClick={() => setModo(modo === 'entrar' ? 'registar' : 'entrar')}
      >
        {modo === 'entrar' ? 'Ainda não tenho conta' : 'Já tenho conta'}
      </button>
    </div>
  )
}