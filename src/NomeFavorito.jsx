import { useState } from 'react'
import { Star } from 'lucide-react'
import Janela from './Janela'
import { limparNome } from './formatar'

// Janela para dar (ou mudar) o nome de um treino favorito.
// onGuardar(nome) devolve uma mensagem de erro, ou null se correu bem.
export default function NomeFavorito({ titulo, inicial, textoBotao = 'Guardar', onGuardar, onFechar }) {
  const [nome, setNome] = useState(inicial ?? '')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  async function guardar(e) {
    e.preventDefault()
    const limpo = limparNome(nome)
    if (!limpo) return setErro('Dá um nome ao favorito.')
    setAGravar(true)
    setErro('')
    const mensagem = await onGuardar(limpo)
    setAGravar(false)
    if (mensagem) setErro(mensagem)
  }

  return (
    <Janela titulo={titulo} onFechar={onFechar} baixa>
      <form className="sheet-lista" onSubmit={guardar}>
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input
            value={nome}
            maxLength={60}
            onChange={(e) => setNome(e.target.value)}
            autoFocus
            enterKeyHint="done"
            placeholder="Ex: Peito e costas"
          />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="com-icone" disabled={aGravar}>
          <Star size={18} />
          {aGravar ? 'A gravar...' : textoBotao}
        </button>
      </form>
    </Janela>
  )
}
