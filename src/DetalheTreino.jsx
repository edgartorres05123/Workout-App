import { useMemo, useState } from 'react'
import { ChevronLeft, Pencil, Star, Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import AvisoPesoCorporal from './AvisoPesoCorporal'
import Confirmar from './Confirmar'
import { useCarga } from './contextoPesoCorporal'
import EditorTreino from './EditorTreino'
import IconeBloco from './IconeBloco'
import NomeFavorito from './NomeFavorito'
import NotasTreino from './NotasTreino'
import Numero from './Numero'
import { estadoVoltas, letraExercicio, normalizarTreino, numerarBlocos, sugerirNomeFavorito, tituloBloco } from './blocos'
import {
  calcular1RM,
  calcularVolume,
  formatarDataExtenso,
  formatarHora,
  formatarMinutos,
  formatarPeso,
  melhorSerie,
} from './formatar'
import { seriePorTempo, textoSegundos } from './condicionamento'
import { textoCarga } from './pesoCorporal'

// Detalhe de um treino terminado, organizado por blocos. "Editar" abre o EditorTreino (modo
// 'editar'). O treino pertence ao componente pai; as alterações chegam por onAlterar(atualizar).
export default function DetalheTreino({ treino: treinoRecebido, onVoltar, onAlterar, onApagado }) {
  const treino = useMemo(() => normalizarTreino(treinoRecebido), [treinoRecebido])
  const [aEditar, setAEditar] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [aApagar, setAApagar] = useState(false)
  const [erro, setErro] = useState('')
  const [aNomearFavorito, setANomearFavorito] = useState(false)
  const avisar = useAvisos()
  const carga = useCarga()
  const cargaDaSerie = (s) => carga(s, treino.data)

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
    avisar('Treino apagado')
    onApagado()
  }

  // ⭐: marcar pede um nome; tocar outra vez tira dos favoritos
  async function guardarFavorito(nome) {
    const mensagem = await guardarTreino({ favorito: true, nome_favorito: nome })
    if (mensagem) return mensagem
    setANomearFavorito(false)
    avisar('Guardado nos favoritos')
    return null
  }

  async function alternarFavorito() {
    if (!treino.favorito) return setANomearFavorito(true)
    const mensagem = await guardarTreino({ favorito: false, nome_favorito: null })
    if (mensagem) return avisar(mensagem, 'erro')
    avisar('Removido dos favoritos')
  }

  if (aEditar) {
    return (
      <div className="vista-detalhe">
        <div className="detalhe-topo">
          <button className="botao-voltar com-icone" onClick={() => setAEditar(false)}>
            <ChevronLeft size={20} />
            Concluir edição
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
    <div className="vista-detalhe">
      <div className="detalhe-topo">
        <button className="botao-voltar com-icone" onClick={onVoltar}>
          <ChevronLeft size={20} />
          Voltar
        </button>
        <div className="detalhe-topo-acoes">
          <button
            className={treino.favorito ? 'botao-favorito ativo' : 'botao-favorito'}
            onClick={alternarFavorito}
            aria-pressed={Boolean(treino.favorito)}
            aria-label={treino.favorito ? `Tirar dos favoritos (${treino.nome_favorito ?? ''})` : 'Guardar nos favoritos'}
            title={treino.favorito ? treino.nome_favorito ?? 'Favorito' : 'Guardar nos favoritos'}
          >
            <Star size={20} />
          </button>
          <button
            className="botao-editar com-icone"
            onClick={() => {
              setAEditar(true)
              window.scrollTo(0, 0)
            }}
          >
            <Pencil size={16} />
            Editar
          </button>
        </div>
      </div>

      {treino.favorito && treino.nome_favorito && (
        <p className="nota nota-favorito com-icone">
          <Star size={14} className="estrela-favorito" aria-hidden="true" />
          Favorito: {treino.nome_favorito}
        </p>
      )}

      <div className="cartao treino-cabecalho">
        <p className="treino-data">
          {formatarDataExtenso(treino.data)} · {formatarHora(treino.data)}
        </p>
        <div className="numeros">
          <Numero valor={formatarMinutos(treino.duracao_min ?? 0)} rotulo="Duração" />
          <Numero valor={`${formatarPeso(calcularVolume(treino.series, cargaDaSerie))} kg`} rotulo="Volume" />
        </div>
        <AvisoPesoCorporal mostrar={treino.series.some((s) => s.exercicios?.peso_corporal)} />
      </div>

      {treino.blocos.length === 0 && semBloco.length === 0 && (
        <p className="subtitulo">Este treino não tem blocos. Toca em Editar para os adicionar.</p>
      )}

      {treino.blocos.map((bloco, i) => (
        <BlocoLeitura
          key={bloco.id}
          bloco={bloco}
          titulo={tituloBloco(bloco, numeros[i], treino.series.filter((s) => s.bloco_id === bloco.id))}
          series={treino.series.filter((s) => s.bloco_id === bloco.id)}
          carga={cargaDaSerie}
        />
      ))}

      {semBloco.length > 0 && (
        <BlocoLeitura
          bloco={{ id: 'sem-bloco', tipo: 'serie', voltas: 1, bloco_exercicios: [] }}
          titulo="Séries sem bloco"
          series={semBloco}
          carga={cargaDaSerie}
        />
      )}

      <NotasTreino key={treino.id} treino={treino} onGuardar={guardarTreino} />

      {erro && <p className="erro">{erro}</p>}

      <button className="botao-perigo com-icone" onClick={() => setConfirmarApagar(true)}>
        <Trash2 size={18} />
        Apagar treino
      </button>

      {confirmarApagar && (
        <Confirmar
          titulo="Apagar treino?"
          textoConfirmar="Apagar treino"
          aProcessar={aApagar}
          onConfirmar={apagarTreino}
          onCancelar={() => setConfirmarApagar(false)}
        >
          <p>Os blocos e as séries deste treino serão apagados. Não é possível desfazer.</p>
          {treino.favorito && <p>Este treino é um favorito: também sai dos favoritos.</p>}
          {erro && <p className="erro">{erro}</p>}
        </Confirmar>
      )}

      {aNomearFavorito && (
        <NomeFavorito
          titulo="Guardar nos favoritos"
          inicial={sugerirNomeFavorito(treino)}
          textoBotao="Guardar nos favoritos"
          onGuardar={guardarFavorito}
          onFechar={() => setANomearFavorito(false)}
        />
      )}
    </div>
  )
}

// Um bloco em modo de leitura: os exercícios (com o 1RM da melhor série) e as voltas feitas,
// com a melhor série de cada exercício destacada. carga(serie): a carga efetiva (peso corporal incluído).
function BlocoLeitura({ bloco, titulo, series, carga }) {
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
      const melhor = melhorSerie(series.filter((s) => s.exercicio_id === be.exercicio_id), carga)
      return [be.exercicio_id, melhor && calcular1RM(melhor.repeticoes, carga(melhor)) > 0 ? melhor : null]
    })
  )
  const voltas = estadoVoltas(bloco, series).filter((v) => v.feita)

  return (
    <div className={`cartao bloco bloco-${bloco.tipo}`}>
      <div className="bloco-topo">
        <h2 className="etiqueta-bloco">
          <IconeBloco tipo={bloco.tipo} />
          {titulo}
        </h2>
      </div>

      <ul className="bloco-exercicios">
        {exercicios.map((be, i) => {
          const melhor = melhores.get(be.exercicio_id)
          return (
            <li key={be.id}>
              {varios && <span className="letra">{letraExercicio(i)}</span>}
              <span className="bloco-exercicio-texto">
                <span className="bloco-exercicio-nome">
                  {be.exercicios?.nome ?? '—'}
                  {be.exercicios?.peso_corporal && <span className="etiqueta etiqueta-pc">PC</span>}
                </span>
                {melhor && (
                  <span className="bloco-exercicio-alvo">
                    1RM estimado: {formatarPeso(Math.round(calcular1RM(melhor.repeticoes, carga(melhor)) * 10) / 10)} kg
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
                    <span className="serie-valor">
                      {seriePorTempo(serie) ? textoSegundos(serie.duracao_seg) : `${serie.repeticoes} reps`}
                    </span>
                    {/* Nas séries por tempo sem peso (e sem PC), não há peso a mostrar */}
                    {!(seriePorTempo(serie) && Number(serie.peso_kg) === 0 && !serie.exercicios?.peso_corporal) && (
                      <span className="serie-valor">{textoCarga(serie.peso_kg, serie.exercicios?.peso_corporal)}</span>
                    )}
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
