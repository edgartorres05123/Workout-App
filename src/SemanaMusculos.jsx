import { useMemo, useState } from 'react'
import { Check, ChevronRight, Play, Plus, TriangleAlert } from 'lucide-react'
import { useAvisos } from './avisos'
import { useSemana } from './contextoSemana'
import Janela from './Janela'
import { formatarDataCurta, formatarPeso } from './formatar'
import { nomeMusculo } from './musculos'
import { exerciciosDoMusculo, mapaMusculos, progressoSemana, resumoEmFalta, seriesDaSemana } from './semana'
import { historicoExercicios } from './sugestoes'

// Secção "Esta semana": as séries de cada músculo face ao objetivo semanal, numa grelha compacta.
// treinos: os terminados (com as séries); exercicios: com os músculos; treinoEmCurso: o treino ao vivo
// (as voltas já feitas também contam). Tocar num músculo abre os exercícios que o trabalham:
// com onAdicionar(exercicio, reps) (há um treino em curso) dá para os pôr no treino; sem ele, há o
// atalho para uma sugestão de treino focada nesse músculo.
export default function SemanaMusculos({ treinos, exercicios, agora, treinoEmCurso = null, titulo = 'Esta semana', onAdicionar }) {
  const { objetivos, abrirIdeias, abrirSemMusculos } = useSemana()
  const [aberto, setAberto] = useState(null) // id do músculo com a janela aberta
  const musculosPorExercicio = useMemo(() => mapaMusculos(exercicios), [exercicios])
  const { valores, semMusculos } = useMemo(
    () => seriesDaSemana(treinos, musculosPorExercicio, agora, treinoEmCurso),
    [treinos, musculosPorExercicio, agora, treinoEmCurso]
  )
  const progresso = progressoSemana(valores, objetivos)
  if (progresso.length === 0) return null // nenhum músculo acompanhado (todos com objetivo 0)
  const resumo = resumoEmFalta(progresso)

  return (
    <section className="semana-musculos" aria-label="Séries por músculo esta semana">
      <div className="semana-musculos-topo">
        <h2 className="rotulo-pequeno">{titulo}</h2>
        {resumo && <p className="semana-musculos-resumo">{resumo}</p>}
      </div>

      <div className="cartao grelha-musculos">
        {progresso.map((p) => (
          <button
            key={p.id}
            className={`musculo-progresso ${p.estado}`}
            onClick={() => setAberto(p.id)}
            aria-label={`${p.nome}: ${formatarPeso(p.feitas)} de ${p.objetivo} séries`}
          >
            <span className="musculo-progresso-topo">
              <span className="musculo-progresso-nome">{p.nome}</span>
              <span className="musculo-progresso-numero">
                {p.estado === 'completo' && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                {formatarPeso(p.feitas)}/{p.objetivo}
              </span>
            </span>
            <span className="musculo-progresso-barra" aria-hidden="true">
              <span style={{ width: `${Math.round(p.fracao * 100)}%` }} />
            </span>
          </button>
        ))}
      </div>

      {semMusculos.size > 0 && (
        <p className="nota semana-sem-musculos com-icone">
          <TriangleAlert size={14} aria-hidden="true" />
          <span>
            {semMusculos.size === 1 ? '1 exercício desta semana não tem' : `${semMusculos.size} exercícios desta semana não têm`}{' '}
            músculos e não conta{semMusculos.size === 1 ? '' : 'm'}.{' '}
            {abrirSemMusculos && (
              <button className="botao-link" onClick={abrirSemMusculos}>
                Completar
              </button>
            )}
          </span>
        </p>
      )}

      {aberto && (
        <JanelaMusculo
          musculo={aberto}
          treinos={treinos}
          exercicios={exercicios}
          onAdicionar={onAdicionar}
          onComecar={
            abrirIdeias
              ? () => {
                  setAberto(null)
                  abrirIdeias({ musculos: [aberto] })
                }
              : null
          }
          onFechar={() => setAberto(null)}
        />
      )}
    </section>
  )
}

// Os meus exercícios que trabalham o músculo (primeiro os de músculo principal), pela última vez que os fiz
function JanelaMusculo({ musculo, treinos, exercicios, onAdicionar, onComecar, onFechar }) {
  const historico = useMemo(() => historicoExercicios(treinos), [treinos])
  const lista = useMemo(() => exerciciosDoMusculo(exercicios, musculo, historico), [exercicios, musculo, historico])
  const [adicionados, setAdicionados] = useState(() => new Set())
  const [aAdicionar, setAAdicionar] = useState(null)
  const [erro, setErro] = useState('')
  const avisar = useAvisos()
  const nome = nomeMusculo(musculo)

  async function adicionar(exercicio) {
    setAAdicionar(exercicio.id)
    setErro('')
    const mensagem = await onAdicionar(exercicio, historico.get(exercicio.id)?.repsUltima ?? null)
    setAAdicionar(null)
    if (mensagem) return setErro(mensagem)
    setAdicionados((atuais) => new Set(atuais).add(exercicio.id))
    avisar(`${exercicio.nome} adicionado ao treino`)
  }

  return (
    <Janela titulo={nome} onFechar={onFechar}>
      <div className="sheet-lista">
        {lista.length === 0 ? (
          <p className="nota sem-margem-topo">
            Ainda não tens exercícios com {nome}. Marca os músculos na página de cada exercício, no separador
            Exercícios.
          </p>
        ) : (
          <ul className="lista lista-exercicios-musculo">
            {lista.map(({ exercicio, principal, ultima }) => (
              <li key={exercicio.id} className="exercicio-musculo">
                <span className="exercicio-musculo-textos">
                  <span className="exercicio-musculo-nome">{exercicio.nome}</span>
                  <span className="exercicio-musculo-info">
                    <span className={principal ? 'etiqueta etiqueta-principal' : 'etiqueta etiqueta-secundario'}>
                      {principal ? 'Principal' : 'Secundário'}
                    </span>
                    {exercicio.peso_corporal && <span className="etiqueta etiqueta-pc">PC</span>}
                    {ultima ? `Última vez a ${formatarDataCurta(ultima)}` : 'Ainda não foi feito'}
                  </span>
                </span>
                {onAdicionar &&
                  (adicionados.has(exercicio.id) ? (
                    <span className="exercicio-musculo-feito com-icone">
                      <Check size={16} aria-hidden="true" />
                      No treino
                    </span>
                  ) : (
                    <button
                      className="botao-pequeno botao-secundario com-icone"
                      onClick={() => adicionar(exercicio)}
                      disabled={aAdicionar !== null}
                      aria-label={`Adicionar ${exercicio.nome} ao treino`}
                    >
                      <Plus size={16} />
                      {aAdicionar === exercicio.id ? 'A adicionar...' : 'Adicionar'}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
        {erro && <p className="erro">{erro}</p>}
        {onAdicionar && lista.length > 0 && (
          <p className="nota">Cada exercício entra num bloco Série com 3 voltas e as reps da última vez.</p>
        )}
      </div>
      {!onAdicionar && onComecar && (
        <button className="botao-criar-bloco com-icone" onClick={onComecar}>
          <Play size={18} />
          Começar treino com estes
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      )}
    </Janela>
  )
}
