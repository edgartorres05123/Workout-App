import { useState } from 'react'

// Notas do treino: sempre editáveis, gravadas em treinos.notas ao sair do campo.
// onGuardar({ notas }) devolve uma mensagem de erro, ou null se correu bem.
export default function NotasTreino({ treino, onGuardar }) {
  const [texto, setTexto] = useState(treino.notas ?? '')
  const [estado, setEstado] = useState('') // '' | 'A gravar...' | 'Gravado'
  const [erro, setErro] = useState('')

  async function guardar() {
    const valor = texto.trim() === '' ? null : texto.trim()
    if (valor === (treino.notas ?? null)) return
    setEstado('A gravar...')
    const mensagem = await onGuardar({ notas: valor })
    setEstado(mensagem ? '' : 'Gravado')
    setErro(mensagem ?? '')
  }

  return (
    <div className="cartao notas">
      <div className="notas-topo">
        <h2>Notas</h2>
        {estado && <span className="notas-estado">{estado}</span>}
      </div>
      <textarea
        rows={3}
        placeholder="Como correu o treino?"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value)
          setEstado('')
        }}
        onBlur={guardar}
      />
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
