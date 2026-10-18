import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Target } from 'lucide-react'
import { buscarExercicios, buscarTreinosTerminados } from './consultas'
import SemanaMusculos from './SemanaMusculos'

// "Músculos esta semana" dentro do treino ao vivo, fechado por omissão. Conta os treinos terminados
// desta semana e as voltas já feitas neste treino (que mudam a cada ✓). Os dados só são pedidos ao abrir.
// onAdicionar(exercicio, reps): cria um bloco Série com o exercício
export default function SemanaNoTreino({ treino, onAdicionar }) {
  const [aberta, setAberta] = useState(false)
  const [dados, setDados] = useState(null) // null = por carregar
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!aberta || dados) return
    let ativo = true
    Promise.all([buscarTreinosTerminados(), buscarExercicios()]).then(([treinos, exercicios]) => {
      if (!ativo) return
      const falhou = treinos.erro ?? exercicios.erro
      if (falhou) return setErro(falhou)
      setErro('')
      setDados({ treinos: treinos.linhas, exercicios: exercicios.linhas, agora: new Date() })
    })
    return () => {
      ativo = false
    }
  }, [aberta, dados])

  return (
    <div className="semana-no-treino">
      <button
        className="botao-secundario com-icone semana-no-treino-botao"
        onClick={() => setAberta((a) => !a)}
        aria-expanded={aberta}
      >
        <Target size={18} />
        Músculos esta semana
        {aberta ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>
      {aberta && erro && <p className="erro">{erro}</p>}
      {aberta && !dados && !erro && <p className="nota">A carregar...</p>}
      {aberta && dados && (
        <SemanaMusculos
          titulo="Com este treino"
          treinos={dados.treinos}
          exercicios={dados.exercicios}
          agora={dados.agora}
          treinoEmCurso={treino}
          onAdicionar={onAdicionar}
        />
      )}
    </div>
  )
}
