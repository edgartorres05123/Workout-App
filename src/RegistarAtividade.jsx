import { useState } from 'react'
import { CalendarPlus, Play } from 'lucide-react'
import CamposCardio from './CamposCardio'
import IconeAtividade from './IconeAtividade'
import Janela from './Janela'
import ListaAtividades from './ListaAtividades'
import { nomeAtividade } from './atividades'
import { campoCalculadoDoEstado, editarCampo, estadoInicialIntervalo, validarIntervalo } from './cardio'
import { dataParaInput } from './formatar'

// Registar uma atividade sozinha (sem ginásio): primeiro a atividade, depois a data, a hora de início e
// os campos. Guardar cria um treino terminado só com esse bloco de cardio; "Começar agora" começa um
// treino ao vivo com a atividade, para a cronometrar.
// onRegistar({ data, atividade, dados }) e onComecarAgora(atividade) devolvem uma mensagem de erro, ou null.
export default function RegistarAtividade({ onRegistar, onComecarAgora, onFechar }) {
  const [agora] = useState(() => new Date())
  const [atividade, setAtividade] = useState(null)
  const [data, setData] = useState(() => {
    const inicio = new Date(agora)
    inicio.setHours(inicio.getHours() - 1, 0, 0, 0)
    return dataParaInput(inicio)
  })
  const [estado, setEstado] = useState(null)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState('')

  function escolher(id) {
    setAtividade(id)
    setEstado(estadoInicialIntervalo({ duracao_seg: 0 }, id))
    setErro('')
  }

  async function guardar(e) {
    e.preventDefault()
    const inicio = new Date(data)
    if (!data || Number.isNaN(inicio.getTime())) return setErro('Indica a data e a hora de início.')
    if (inicio > new Date()) return setErro('A hora de início não pode ser no futuro.')
    const { dados, erro: mensagem } = validarIntervalo(atividade, estado.valores)
    if (mensagem) return setErro(mensagem)
    setErro('')
    setAGravar(true)
    const falha = await onRegistar({ data: inicio.toISOString(), atividade, dados })
    setAGravar(false)
    if (falha) setErro(falha)
  }

  async function comecar() {
    setAGravar(true)
    setErro('')
    const falha = await onComecarAgora(atividade)
    setAGravar(false)
    if (falha) setErro(falha)
  }

  return (
    <Janela titulo={atividade ? nomeAtividade(atividade) : 'Registar atividade'} onFechar={onFechar}>
      <div className="sheet-lista tipo-cardio">
        {!atividade ? (
          <ListaAtividades onEscolher={escolher} />
        ) : (
          <form onSubmit={guardar}>
            <div className="atividade-atual">
              <span className="com-icone">
                <IconeAtividade atividade={atividade} size={18} />
                {nomeAtividade(atividade)}
              </span>
              <button type="button" className="botao-link" onClick={() => setAtividade(null)}>
                Mudar
              </button>
            </div>

            <button type="button" className="botao-secundario com-icone" onClick={comecar} disabled={aGravar}>
              <Play size={18} />
              Começar agora (cronometrar)
            </button>
            <p className="nota">Ou regista uma atividade que já fizeste:</p>

            <label className="campo-cardio">
              <span>Data e hora de início</span>
              <input type="datetime-local" value={data} max={dataParaInput(agora)} onChange={(e) => setData(e.target.value)} />
            </label>
            <CamposCardio
              atividadeId={atividade}
              estado={estado}
              calculado={campoCalculadoDoEstado(estado, atividade)}
              onMudar={(campo, texto) => setEstado((atual) => editarCampo(atual, campo, texto, atividade))}
              onSair={() => {}}
            />
            {erro && <p className="erro">{erro}</p>}
            <button type="submit" className="botao-criar-bloco com-icone" disabled={aGravar}>
              <CalendarPlus size={18} />
              {aGravar ? 'A gravar...' : 'Guardar atividade'}
            </button>
          </form>
        )}
      </div>
    </Janela>
  )
}
