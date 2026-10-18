import { useId } from 'react'

// Visto "Peso corporal" de um exercício: nesses exercícios, o peso registado em cada série é o extra
// e as contas somam-lhe o peso do corpo. nota: frase pequena por baixo (por exemplo, que a mudança
// vale para o exercício em todos os treinos).
export default function VistoPesoCorporal({ ativo, onMudar, desativado = false, nota }) {
  const id = useId()
  return (
    <div className="visto-pc">
      <label className="visto" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={ativo}
          disabled={desativado}
          onChange={(e) => onMudar(e.target.checked)}
        />
        <span>
          Peso corporal <span className="etiqueta etiqueta-pc">PC</span>
        </span>
      </label>
      {nota && <p className="nota visto-nota">{nota}</p>}
    </div>
  )
}
