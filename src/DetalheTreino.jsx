import { useMemo, useState } from 'react'
import { supabase } from './supabase'
import EditorTreino from './EditorTreino'
import NotasTreino from './NotasTreino'
import Numero from './Numero'
import { estadoVoltas, letraExercicio, normalizarTreino, numerarBlocos, tituloBloco } from './blocos'
import {
  calcular1RM,
  calcularVolume,
  formatarDataExtenso,
  formatarHora,
  formatarMinutos,
  formatarPeso,
  melhorSerie,
} from './formatar'

// Detalhe de um treino terminado, organizado por blocos. "Editar" abre o EditorTreino (modo
// 'editar'). O treino pertence ao componente pai; as alterações chegam por onAlterar(atualizar).
export default function DetalheTreino({ treino: treinoRecebido, onVoltar, onAlterar, onApagado }) {
  const treino = useMemo(() => normalizarTreino(treinoRecebido), [treinoRecebido])
  const [aEditar, setAEditar] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)
  const [erro, setErro] = useState('')

  async function guardarTreino(campos) {
    const { error } = await supabase.from('treinos').update(campos).eq('id', treino.id)
    if (error) return error.message
    onAlterar((t) => ({ ...t, ...campos }))
    return null
  }

  async function apagarTreino() {
    setAApagar(true)
    setErro('')
    const { error } = await supabase.from('treinos').delete().eq('id', treino.id)
    setAApagar(false)
    if (error) return setErro(error.message)
    onApagado()
  }

  if (aEditar) {
    return (
      <div>
        <div className="detalhe-topo">
          <button className="botao-voltar" onClick={() => setAEditar(false)}>
            ‹ Concluir edição
          </button>
        </div>
        <EditorTreino
          modo="editar"
          treino={treinoRecebido}
          onAlterar={onAlterar}
          onConcluido={() => {
            setAEditar(false)
            window.scrollTo(0, 0)
          }}
          onApagado={onApagado}
        />
      </div>
    )
  }

  const numeros = numerarBlocos(treino.blocos)
  // Séries sem bloco conhecido (não devia acontecer depois da migração) aparecem num cartão à parte
  const idsBlocos = new Set(treino.blocos.map((b) => b.id))
  const semBloco = treino.series.filter((s) => !idsBlocos.has(s.bloco_id))

  return (
    <div>
      <div className="detalhe-topo">
        <button className="botao-voltar" onClick={onVoltar}>
          ‹ Voltar
        </button>
        <button
          className="botao-editar"
          onClick={() => {
            setAEditar(true)
            window.scrollTo(0, 0)
          }}
        >
          Editar
        </button>
      </div>

      <div className="cartao treino-cabecalho">
        <p className="treino-data">
          {formatarDataExtenso(treino.data)} · {formatarHora(treino.data)}
        </p>
        <div className="numeros">
          <Numero valor={formatarMinutos(treino.duracao_min ?? 0)} rotulo="Duração" />
          <Numero valor={`${formatarPeso(calcularVolume(treino.series))} kg`} rotulo="Volume" />
        </div>
      </div>

      {treino.blocos.length === 0 && semBloco.length === 0 && (
        <p className="subtitulo">Este treino não tem blocos. Toca em Editar para os adicionar.</p>
      )}

      {treino.blocos.map((bloco, i) => (
        <BlocoLeitura
          key={bloco.id}
          bloco={bloco}
          titulo={tituloBloco(bloco, numeros[i])}
          series={treino.series.filter((s) => s.bloco_id === bloco.id)}
        />
      ))}

      {semBloco.length > 0 && (
        <BlocoLeitura
          bloco={{ id: 'sem-bloco', tipo: 'serie', voltas: 1, bloco_exercicios: [] }}
          titulo="Séries sem bloco"
          series={semBloco}
        />
      )}

      <NotasTreino key={treino.id} treino={treino} onGuardar={guardarTreino} />

      {erro && <p className="erro">{erro}</p>}

      {confirmarApagar ? (
        <div className="cartao confirmacao">
          <p>Apagar este treino? Os blocos e as séries serão apagados e não é possível desfazer.</p>
          <button className="botao-perigo-cheio" onClick={apagarTreino} disabled={aApagar}>
            {aApagar ? 'A apagar...' : 'Apagar treino'}
          </button>
          <button className="botao-secundario" onClick={() => setConfirmarApagar(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <button className="botao-perigo" onClick={() => setConfirmarApagar(true)}>
          Apagar treino
        </button>
      )}
    </div>
  )
}

// Um bloco em modo de leitura: os exercícios (com o 1RM da melhor série) e as voltas feitas,
// com a melhor série de cada exercício destacada
function BlocoLeitura({ bloco, titulo, series }) {
  // Os exercícios do bloco, mais algum que tenha séries sem estar na lista
  const exercicios = [...bloco.bloco_exercicios]
  for (const s of series) {
    if (!exercicios.some((be) => be.exercicio_id === s.exercicio_id)) {
      exercicios.push({ id: `s-${s.exercicio_id}`, exercicio_id: s.exercicio_id, exercicios: s.exercicios })
    }
  }
  const varios = exercicios.length > 1
  const aquecimento = bloco.tipo === 'aquecimento'
  // A melhor série de cada exercício (maior 1RM); sem destaque nos exercícios feitos sem peso
  const melhores = new Map(
    exercicios.map((be) => {
      const melhor = melhorSerie(series.filter((s) => s.exercicio_id === be.exercicio_id))
      return [be.exercicio_id, melhor && calcular1RM(melhor.repeticoes, melhor.peso_kg) > 0 ? melhor : null]
    })
  )
  const voltas = estadoVoltas(bloco, series).filter((v) => v.feita)

  return (
    <div className={`cartao bloco bloco-${bloco.tipo}`}>
      <div className="bloco-topo">
        <h2>{titulo}</h2>
      </div>

      <ul className="bloco-exercicios">
        {exercicios.map((be, i) => {
          const melhor = melhores.get(be.exercicio_id)
          return (
            <li key={be.id}>
              {varios && <span className="letra">{letraExercicio(i)}</span>}
              <span className="bloco-exercicio-texto">
                <span className="bloco-exercicio-nome">{be.exercicios?.nome ?? '—'}</span>
                {melhor && (
                  <span className="bloco-exercicio-alvo">
                    1RM estimado: {formatarPeso(Math.round(calcular1RM(melhor.repeticoes, melhor.peso_kg) * 10) / 10)} kg
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      {voltas.length === 0 ? (
        <p className="nota">Nenhuma volta feita.</p>
      ) : (
        <ul className="series">
          {voltas.flatMap((v) =>
            exercicios
              .map((be, i) => ({ be, i, serie: v.series.get(be.exercicio_id) }))
              .filter(({ serie }) => serie)
              .map(({ i, serie }, j) => {
                const destaque = !aquecimento && serie === melhores.get(serie.exercicio_id)
                return (
                  <li key={serie.id} className={destaque ? 'serie-melhor' : undefined}>
                    <span
                      className={`serie-num${aquecimento ? ' aquecimento' : ''}${j > 0 ? ' vazio' : ''}`}
                      aria-label={`Volta ${v.volta}`}
                    >
                      {j === 0 ? v.volta : ''}
                    </span>
                    {varios && <span className="letra">{letraExercicio(i)}</span>}
                    <span className="serie-valor">{serie.repeticoes} reps</span>
                    <span className="serie-valor">{formatarPeso(serie.peso_kg)} kg</span>
                    {destaque && <span className="etiqueta-melhor">Melhor</span>}
                  </li>
                )
              })
          )}
        </ul>
      )}

      {bloco.notas && <p className="nota">{bloco.notas}</p>}
    </div>
  )
}
