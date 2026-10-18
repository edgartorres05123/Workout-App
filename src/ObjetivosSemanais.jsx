import { useState } from 'react'
import { ChevronLeft, Minus, Plus, RotateCcw } from 'lucide-react'
import { useAvisos } from './avisos'
import { useSemana } from './contextoSemana'
import { MUSCULOS } from './musculos'
import { OBJETIVO_MAXIMO, OBJETIVO_PADRAO } from './semana'

// Página "Objetivos semanais" (aberta a partir do menu): as séries por semana que quero fazer para cada
// músculo, de 0 a 30 (0 = não acompanhar). Ficam na conta (user_metadata), só as diferentes do padrão.
export default function ObjetivosSemanais({ onVoltar }) {
  const { objetivos, guardarObjetivos } = useSemana()
  const [valores, setValores] = useState(objetivos)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')
  const avisar = useAvisos()

  const mudou = MUSCULOS.some(({ id }) => valores[id] !== objetivos[id])
  const tudoPadrao = MUSCULOS.every(({ id }) => valores[id] === OBJETIVO_PADRAO)

  function mudar(id, delta) {
    setValores((atuais) => ({ ...atuais, [id]: Math.min(OBJETIVO_MAXIMO, Math.max(0, atuais[id] + delta)) }))
  }

  function reporPadrao() {
    setValores(Object.fromEntries(MUSCULOS.map(({ id }) => [id, OBJETIVO_PADRAO])))
  }

  async function guardar() {
    setAGravar(true)
    setErro('')
    const mensagem = await guardarObjetivos(valores)
    setAGravar(false)
    if (mensagem) return setErro(mensagem)
    avisar('Objetivos gravados')
  }

  return (
    <div className="vista-detalhe">
      <div className="detalhe-topo">
        <button className="botao-voltar com-icone" onClick={onVoltar}>
          <ChevronLeft size={20} />
          Voltar
        </button>
      </div>

      <p className="nota nota-objetivos">
        Séries por semana para cada músculo (de segunda a domingo). O músculo principal de um exercício conta 1 série
        e cada secundário conta meia. Com 0, o músculo deixa de ser acompanhado.
      </p>

      <ul className="cartao lista lista-objetivos">
        {MUSCULOS.map(({ id, nome }) => {
          const valor = valores[id]
          return (
            <li key={id} className={valor === 0 ? 'objetivo-musculo desligado' : 'objetivo-musculo'}>
              <span className="objetivo-musculo-nome">{nome}</span>
              <button
                className="botao-redondo"
                onClick={() => mudar(id, -1)}
                disabled={valor <= 0}
                aria-label={`Menos uma série de ${nome}`}
              >
                <Minus size={18} />
              </button>
              <span className="objetivo-musculo-valor" aria-live="polite">
                {valor === 0 ? 'Não acompanhar' : `${valor} séries`}
              </span>
              <button
                className="botao-redondo"
                onClick={() => mudar(id, 1)}
                disabled={valor >= OBJETIVO_MAXIMO}
                aria-label={`Mais uma série de ${nome}`}
              >
                <Plus size={18} />
              </button>
            </li>
          )
        })}
      </ul>

      {erro && <p className="erro">{erro}</p>}

      <button className="botao-grande" onClick={guardar} disabled={!mudou || aGravar}>
        {aGravar ? 'A gravar...' : mudou ? 'Guardar' : 'Gravado'}
      </button>
      <button className="botao-terciario com-icone" onClick={reporPadrao} disabled={tudoPadrao || aGravar}>
        <RotateCcw size={16} />
        Repor padrão ({OBJETIVO_PADRAO} séries)
      </button>
    </div>
  )
}
