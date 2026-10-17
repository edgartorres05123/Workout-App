import { useState } from 'react'
import { NotebookPen } from 'lucide-react'
import { useAvisos } from './avisos'

// Notas do treino: sempre editáveis, gravadas em treinos.notas ao sair do campo.
// onGuardar({ notas }) devolve uma mensagem de erro, ou null se correu bem.
export default function NotasTreino({ treino, onGuardar }) {
  const [texto, setTexto] = useState(treino.notas ?? '')
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const avisar = useAvisos()

  async function guardar() {
    const valor = texto.trim() === '' ? null : texto.trim()
    if (valor === (treino.notas ?? null)) return
    setAGravar(true)
    const mensagem = await onGuardar({ notas: valor })
    setAGravar(false)
    setErro(mensagem ?? '')
    if (!mensagem) avisar('Notas gravadas')
  }

  return (
    <div className="cartao notas">
      <div className="notas-topo">
        <h2 className="com-icone">
          <NotebookPen size={18} aria-hidden="true" />
          Notas
        </h2>
        {aGravar && <span className="notas-estado">A gravar...</span>}
      </div>
      <textarea
        rows={3}
        placeholder="Como correu o treino?"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={guardar}
      />
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
