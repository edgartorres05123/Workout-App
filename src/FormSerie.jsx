import { useState } from 'react'
import { lerNumero, pesoParaInput } from './formatar'

// Formulário para adicionar uma série (usado no treino em curso e no histórico).
// Os campos mostram a sugestão (por exemplo, a última série) até o utilizador escrever outro valor.
// onAdicionar({ repeticoes, peso_kg, aquecimento }) devolve uma mensagem de erro, ou null se correu bem.
export default function FormSerie({ sugestao, onAdicionar }) {
  const [reps, setReps] = useState(null) // null = usa a sugestão
  const [kg, setKg] = useState(null)
  const [aquecimento, setAquecimento] = useState(false)
  const [aEnviar, setAEnviar] = useState(false)
  const [erro, setErro] = useState('')

  const valorReps = reps ?? (sugestao ? String(sugestao.repeticoes) : '')
  const valorKg = kg ?? (sugestao ? pesoParaInput(sugestao.peso_kg) : '')

  async function submeter(e) {
    e.preventDefault()
    const repeticoes = Number(valorReps.trim())
    const peso = lerNumero(valorKg)

    if (!Number.isInteger(repeticoes) || repeticoes <= 0) return setErro('Indica as repetições.')
    if (peso === null || peso < 0 || peso > 9999.99) return setErro('Indica um peso válido.')

    setAEnviar(true)
    const mensagem = await onAdicionar({
      repeticoes,
      peso_kg: Math.round(peso * 100) / 100,
      aquecimento,
    })
    setAEnviar(false)
    setErro(mensagem ?? '')
    if (!mensagem) {
      // A série acabada de gravar passa a ser a sugestão
      setReps(null)
      setKg(null)
      // Volta a desmarcar para não gravar séries normais como aquecimento por esquecimento
      setAquecimento(false)
    }
  }

  return (
    <>
      <form className="serie-form" onSubmit={submeter}>
        <label>
          <span>Reps</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={valorReps}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        <label>
          <span>kg</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={valorKg}
            onChange={(e) => setKg(e.target.value)}
          />
        </label>
        <button type="submit" disabled={aEnviar} aria-label="Adicionar série">
          +
        </button>
      </form>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={aquecimento}
          onChange={(e) => setAquecimento(e.target.checked)}
        />
        Série de aquecimento
      </label>

      {erro && <p className="erro">{erro}</p>}
    </>
  )
}
