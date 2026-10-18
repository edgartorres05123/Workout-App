import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Info, Play, RefreshCw, Shuffle, TriangleAlert, X } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import { buscarExercicios, buscarTreinoEmCurso, buscarTreinosTerminados } from './consultas'
import { useSemana } from './contextoSemana'
import Confirmar from './Confirmar'
import EscolherExercicio from './EscolherExercicio'
import Esqueleto from './Esqueleto'
import IconeBloco from './IconeBloco'
import Pilulas from './Pilulas'
import { letraExercicio, numerarBlocos, tituloBloco } from './blocos'
import { textoSegundos } from './condicionamento'
import { formatarPeso } from './formatar'
import { MODELOS, associarModelo, estruturaDoModelo, exerciciosDoModelo, exerciciosNovos, musculosParaCriar } from './modelos'
import { MUSCULOS, nomeMusculo } from './musculos'
import { juntarNomes } from './semana'
import { gerarSugestao, montarEstrutura, sementeDoDia, trocarExercicio } from './sugestoes'

const SEPARADORES = [
  { id: 'sugestao', nome: 'Sugestão automática' },
  { id: 'modelos', nome: 'Modelos prontos' },
]

// Os treinos terminados, os exercícios (com os músculos) e o treino em curso (as voltas feitas contam)
async function buscarDados() {
  const [treinos, exercicios, emCurso] = await Promise.all([
    buscarTreinosTerminados(),
    buscarExercicios(),
    buscarTreinoEmCurso(),
  ])
  const falhou = treinos.erro ?? exercicios.erro ?? emCurso.erro
  if (falhou) return { erro: falhou }
  return { treinos: treinos.linhas, exercicios: exercicios.linhas, emCurso: emCurso.treino, agora: new Date() }
}

// Página "Ideias de treino" (menu e cartão "Sugestão para hoje" do Início), com dois separadores:
// a sugestão automática e os modelos prontos. musculosIniciais: músculos já escolhidos (vindo de um
// músculo da secção "Esta semana"). onVerificar(): mensagem se não der para começar um treino agora;
// onComecar(modo, origem): começa ('aoVivo') ou regista ('passado') um treino com a estrutura de origem.
export default function PaginaIdeias({ musculosIniciais = null, onVerificar, onComecar, onVoltar }) {
  const [dados, setDados] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  const [separador, setSeparador] = useState('sugestao')
  const avisar = useAvisos()

  useEffect(() => {
    let ativo = true
    buscarDados().then((resultado) => {
      if (!ativo) return
      if (resultado.erro) return setErro(resultado.erro)
      setDados(resultado)
    })
    return () => {
      ativo = false
    }
  }, [])

  // Antes de começar: com um treino em curso (ou ainda a ver se há), não se começa outro
  function iniciar(modo, origem) {
    const motivo = onVerificar()
    if (motivo) return avisar(motivo, 'erro')
    onComecar(modo, origem)
  }

  return (
    <div className="vista-detalhe">
      <div className="detalhe-topo">
        <button className="botao-voltar com-icone" onClick={onVoltar}>
          <ChevronLeft size={20} />
          Voltar
        </button>
      </div>

      <Pilulas opcoes={SEPARADORES} valor={separador} onMudar={setSeparador} rotulo="Tipo de ideia" />

      {erro && <p className="erro">{erro}</p>}
      {dados?.emCurso && (
        <p className="nota com-icone nota-ideias">
          <Info size={14} aria-hidden="true" />
          Tens um treino em curso: as voltas já feitas contam, mas termina-o antes de começar outro.
        </p>
      )}

      {dados === null ? (
        !erro && <Esqueleto cartoes={3} linhas={3} />
      ) : (
        <>
          {/* Os dois separadores ficam montados, para não perder as escolhas ao mudar de um para o outro */}
          <div hidden={separador !== 'sugestao'}>
            <Sugestao
              dados={dados}
              musculosIniciais={musculosIniciais}
              onIniciar={iniciar}
              onVerModelos={() => setSeparador('modelos')}
            />
          </div>
          <div hidden={separador !== 'modelos'}>
            <Modelos exercicios={dados.exercicios} onVerificar={onVerificar} onIniciar={iniciar} />
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Sugestão automática ----------

function Sugestao({ dados, musculosIniciais, onIniciar, onVerModelos }) {
  const { objetivos } = useSemana()
  const [semente, setSemente] = useState(() => sementeDoDia(dados.agora))
  const [evitar, setEvitar] = useState(() => new Set()) // os exercícios da sugestão anterior
  const [musculos, setMusculos] = useState(musculosIniciais?.length ? musculosIniciais : null) // null = automático
  const [aEscolher, setAEscolher] = useState(Boolean(musculosIniciais?.length))
  const [superSeries, setSuperSeries] = useState(false)
  const avisar = useAvisos()

  const sugestao = useMemo(
    () =>
      gerarSugestao({
        treinos: dados.treinos,
        exercicios: dados.exercicios,
        objetivos,
        agora: dados.agora,
        treinoEmCurso: dados.emCurso,
        semente,
        evitar,
        musculos,
      }),
    [dados, objetivos, semente, evitar, musculos]
  )

  // Trocar e remover mexem numa cópia dos itens, que vale só para esta sugestão
  const [edicao, setEdicao] = useState({ base: null, itens: [] })
  const itens = edicao.base === sugestao ? edicao.itens : sugestao.itens
  const editar = (novos) => setEdicao({ base: sugestao, itens: novos })

  const nomesAlvos = juntarNomes(sugestao.alvos.map(nomeMusculo))
  const estrutura = useMemo(
    () => montarEstrutura(itens, sugestao.historico, { superSeries, titulo: `Ideia: ${nomesAlvos}`, agora: dados.agora }),
    [itens, sugestao.historico, superSeries, nomesAlvos, dados.agora]
  )

  function novaSugestao() {
    setEvitar(new Set(itens.map((i) => i.exercicio.id)))
    setSemente((s) => s + 1)
  }

  function alternarMusculo(id) {
    setMusculos((atuais) => {
      const lista = atuais ?? []
      const nova = lista.includes(id) ? lista.filter((m) => m !== id) : [...lista, id]
      return nova.length > 0 ? nova : null
    })
  }

  function trocar(exercicioId) {
    const indice = itens.findIndex((i) => i.exercicio.id === exercicioId)
    const novos = trocarExercicio(itens, indice, sugestao.porMusculo)
    if (!novos) return avisar(`Não há outro exercício de ${nomeMusculo(itens[indice].musculo)} para trocar.`, 'erro')
    editar(novos)
  }

  const progressoDe = new Map(sugestao.progresso.map((p) => [p.id, p]))

  return (
    <>
      <div className="cartao ideia-alvos">
        <div className="ideia-alvos-topo">
          <h2>Músculos-alvo</h2>
          <button className="botao-link" onClick={() => setAEscolher((a) => !a)} aria-expanded={aEscolher}>
            {aEscolher ? 'Fechar' : 'Escolher à mão'}
          </button>
        </div>
        {sugestao.alvos.length > 0 ? (
          <div className="etiquetas">
            {sugestao.alvos.map((id) => {
              const p = progressoDe.get(id)
              return (
                <span key={id} className="etiqueta etiqueta-principal">
                  {nomeMusculo(id)}
                  {p && ` · ${formatarPeso(p.feitas)}/${p.objetivo}`}
                </span>
              )
            })}
          </div>
        ) : (
          <p className="nota sem-margem-topo">
            Não acompanhas nenhum músculo (todos os objetivos estão a 0). Escolhe os músculos à mão.
          </p>
        )}
        <p className="nota">
          {sugestao.manual
            ? 'Escolhidos por ti.'
            : 'Os mais longe do objetivo semanal, sem os que treinaste como principais nas últimas 48 horas.'}
        </p>
        {sugestao.ignorouDescanso && (
          <p className="aviso com-icone aviso-descanso">
            <TriangleAlert size={14} aria-hidden="true" />
            Treinaste todos os músculos nas últimas 48 horas, por isso a regra do descanso foi ignorada.
          </p>
        )}
        {aEscolher && (
          <div className="escolher-musculos">
            {MUSCULOS.map((m) => {
              const ativo = Boolean(musculos?.includes(m.id))
              return (
                <button
                  key={m.id}
                  className={ativo ? 'filtro ativo' : 'filtro'}
                  onClick={() => alternarMusculo(m.id)}
                  aria-pressed={ativo}
                >
                  {m.nome}
                </button>
              )
            })}
            {musculos && (
              <button className="botao-link" onClick={() => setMusculos(null)}>
                Voltar ao automático
              </button>
            )}
          </div>
        )}
      </div>

      {sugestao.insuficiente && sugestao.alvos.length > 0 && (
        <div className="aviso-caixa">
          <TriangleAlert size={18} className="aviso-caixa-icone" aria-hidden="true" />
          <p>
            Ainda tens poucos exercícios feitos para {nomesAlvos} ({itens.length === 1 ? '1 exercício' : `${itens.length} exercícios`};
            uma sugestão precisa de 4). Experimenta um modelo pronto.
          </p>
          <button className="botao-link com-icone" onClick={onVerModelos}>
            Ver modelos prontos
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="ideia-controlos">
        <button className="botao-secundario com-icone" onClick={novaSugestao}>
          <Shuffle size={18} />
          Nova sugestão
        </button>
        <label className="visto interruptor">
          <input type="checkbox" checked={superSeries} onChange={(e) => setSuperSeries(e.target.checked)} />
          <span>Agrupar em super séries</span>
        </label>
      </div>

      {itens.length > 0 && (
        <PreVisualizacao
          estrutura={estrutura}
          acoes={(be, bloco) =>
            bloco.tipo !== 'aquecimento' && (
              <>
                <button
                  className="botao-icone"
                  onClick={() => trocar(be.exercicio_id)}
                  aria-label={`Trocar ${be.exercicios.nome}`}
                  title="Trocar"
                >
                  <RefreshCw size={17} />
                </button>
                <button
                  className="botao-icone perigo"
                  onClick={() => editar(itens.filter((i) => i.exercicio.id !== be.exercicio_id))}
                  aria-label={`Remover ${be.exercicios.nome}`}
                  title="Remover"
                >
                  <X size={18} />
                </button>
              </>
            )
          }
        />
      )}

      <BotoesComecar desativado={itens.length === 0} onComecar={(modo) => onIniciar(modo, estrutura)} />
    </>
  )
}

// ---------- Modelos prontos ----------

function Modelos({ exercicios, onVerificar, onIniciar }) {
  const [escolhido, setEscolhido] = useState(null)
  const modelo = MODELOS.find((m) => m.id === escolhido)

  if (modelo) {
    return (
      <PreModelo
        key={modelo.id}
        modelo={modelo}
        exercicios={exercicios}
        onVerificar={onVerificar}
        onIniciar={onIniciar}
        onVoltar={() => setEscolhido(null)}
      />
    )
  }

  return (
    <div className="lista-modelos">
      {MODELOS.map((m) => {
        const doModelo = exerciciosDoModelo(m)
        const novos = exerciciosNovos(m, associarModelo(m, exercicios)).length
        return (
          <button key={m.id} className="cartao cartao-modelo" onClick={() => setEscolhido(m.id)}>
            <span className="cartao-modelo-textos">
              <span className="cartao-modelo-nome">{m.nome}</span>
              <span className="cartao-modelo-descricao">{m.descricao}</span>
              <span className="cartao-modelo-detalhe">
                {m.blocos.length} blocos · {doModelo.length} exercícios
                {novos > 0 && ` · ${novos} ${novos === 1 ? 'novo' : 'novos'}`}
              </span>
            </span>
            <ChevronRight size={20} className="seta" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

function PreModelo({ modelo, exercicios, onVerificar, onIniciar, onVoltar }) {
  const [trocas, setTrocas] = useState(() => new Map()) // nome no modelo → exercício meu
  const [aTrocar, setATrocar] = useState(null) // nome no modelo
  const [confirmar, setConfirmar] = useState(null) // modo à espera da confirmação
  const [aCriar, setACriar] = useState(false)
  const [erro, setErro] = useState('')
  const avisar = useAvisos()

  const definicoes = useMemo(() => new Map(exerciciosDoModelo(modelo).map((d) => [d.nome, d])), [modelo])
  const associacoes = useMemo(() => {
    const mapa = associarModelo(modelo, exercicios)
    for (const [nome, exercicio] of trocas) mapa.set(nome, exercicio)
    return mapa
  }, [modelo, exercicios, trocas])
  const novos = exerciciosNovos(modelo, associacoes)

  // Para mostrar: os exercícios ainda por criar aparecem com o nome do modelo e marcados "novo"
  const estruturaVista = useMemo(() => {
    const paraMostrar = new Map(
      [...associacoes].map(([nome, e]) => [
        nome,
        e ?? { id: null, nome, peso_corporal: definicoes.get(nome).pesoCorporal, novo: true },
      ])
    )
    return estruturaDoModelo(modelo, paraMostrar)
  }, [modelo, associacoes, definicoes])

  function comecar(modo) {
    const motivo = onVerificar()
    if (motivo) return avisar(motivo, 'erro')
    if (novos.length > 0) return setConfirmar(modo)
    onIniciar(modo, estruturaDoModelo(modelo, associacoes))
  }

  // Cria os exercícios novos (com os músculos e o peso corporal) e começa o treino
  async function criarEComecar() {
    setACriar(true)
    setErro('')
    const { data: criados, error } = await supabase
      .from('exercicios')
      .insert(novos.map((n) => ({ nome: n.nome, peso_corporal: n.pesoCorporal })))
      .select('id, nome, peso_corporal')
    if (error) {
      setACriar(false)
      return setErro(
        error.code === '23505' ? 'Um destes exercícios já existe com outro nome. Troca-o por um dos teus.' : error.message
      )
    }
    const completas = new Map(associacoes)
    for (const n of novos) completas.set(n.nome, criados.find((c) => c.nome === n.nome))
    const musculos = novos.flatMap((n) => musculosParaCriar(n, completas.get(n.nome).id))
    const { error: erroMusculos } = musculos.length > 0 ? await supabase.from('exercicio_musculos').insert(musculos) : {}
    setACriar(false)
    if (erroMusculos) avisar(`Exercícios criados, mas sem todos os músculos: ${erroMusculos.message}`, 'erro')
    else avisar(novos.length === 1 ? '1 exercício criado' : `${novos.length} exercícios criados`)
    setConfirmar(null)
    onIniciar(confirmar, estruturaDoModelo(modelo, completas))
  }

  return (
    <>
      <button className="botao-voltar com-icone botao-voltar-modelos" onClick={onVoltar}>
        <ChevronLeft size={18} />
        Modelos
      </button>
      <h2 className="titulo-seccao">{modelo.nome}</h2>
      <p className="nota sem-margem-topo">
        {modelo.descricao}. Cada exercício é associado a um dos teus pelo nome; os que não tens aparecem marcados
        "novo" e são criados ao começar. Toca em ↻ para usar outro dos teus.
      </p>

      <PreVisualizacao
        estrutura={estruturaVista}
        acoes={(be) => (
          <button
            className="botao-icone"
            onClick={() => setATrocar(be.nome_modelo)}
            aria-label={`Trocar ${be.exercicios.nome} por um dos meus`}
            title="Trocar"
          >
            <RefreshCw size={17} />
          </button>
        )}
      />

      {erro && <p className="erro">{erro}</p>}
      <BotoesComecar onComecar={comecar} aProcessar={aCriar} />

      {aTrocar && (
        <EscolherExercicio
          titulo={`Trocar ${aTrocar}`}
          permitirCriar={false}
          onEscolher={(exercicio) => {
            setTrocas((atuais) => new Map(atuais).set(aTrocar, exercicio))
            setATrocar(null)
          }}
          onFechar={() => setATrocar(null)}
        />
      )}

      {confirmar && (
        <Confirmar
          titulo={novos.length === 1 ? 'Criar 1 exercício?' : `Criar ${novos.length} exercícios?`}
          textoConfirmar={confirmar === 'aoVivo' ? 'Criar e começar' : 'Criar e continuar'}
          perigo={false}
          aProcessar={aCriar}
          onConfirmar={criarEComecar}
          onCancelar={() => setConfirmar(null)}
        >
          <p>Estes exercícios ainda não existem e vão ser criados, já com os músculos:</p>
          <ul className="lista-novos">
            {novos.map((n) => (
              <li key={n.nome}>
                <strong>{n.nome}</strong>
                {n.pesoCorporal && <span className="etiqueta etiqueta-pc">PC</span>}
                <span className="lista-novos-musculos">
                  {juntarNomes(n.principais.map(nomeMusculo))}
                  {n.secundarios.length > 0 && ` (secundários: ${juntarNomes(n.secundarios.map(nomeMusculo))})`}
                </span>
              </li>
            ))}
          </ul>
          {erro && <p className="erro">{erro}</p>}
        </Confirmar>
      )}
    </>
  )
}

// ---------- Partes comuns ----------

// Os blocos e os exercícios de uma estrutura (ainda por criar). acoes(be, bloco): botões de cada exercício
function PreVisualizacao({ estrutura, acoes }) {
  const numeros = numerarBlocos(estrutura.blocos)
  return (
    <div className="previsualizacao">
      {estrutura.blocos.map((bloco, i) => (
        <div key={bloco.id} className={`cartao bloco-previsto tipo-${bloco.tipo}`}>
          <h3 className="bloco-previsto-titulo com-icone">
            <IconeBloco tipo={bloco.tipo} />
            {tituloBloco(bloco, numeros[i])}
          </h3>
          <ul className="lista">
            {bloco.bloco_exercicios.map((be, j) => (
              <li key={be.id} className="exercicio-previsto">
                {bloco.bloco_exercicios.length > 1 && <span className="letra">{letraExercicio(j)}</span>}
                <span className="exercicio-previsto-textos">
                  <span className="exercicio-previsto-nome">
                    {be.exercicios?.nome ?? '—'}
                    {be.exercicios?.peso_corporal && <span className="etiqueta etiqueta-pc">PC</span>}
                    {be.exercicios?.novo && <span className="etiqueta etiqueta-aviso">novo</span>}
                  </span>
                  <span className="exercicio-previsto-alvo">
                    {be.segundos_alvo ? textoSegundos(be.segundos_alvo) : `${be.reps_alvo} reps`}
                  </span>
                </span>
                {acoes(be, bloco)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function BotoesComecar({ desativado = false, aProcessar = false, onComecar }) {
  return (
    <div className="ideia-botoes">
      <button className="botao-grande com-icone" onClick={() => onComecar('aoVivo')} disabled={desativado || aProcessar}>
        <Play size={20} />
        {aProcessar ? 'A preparar...' : 'Começar treino'}
      </button>
      <button
        className="botao-secundario com-icone"
        onClick={() => onComecar('passado')}
        disabled={desativado || aProcessar}
      >
        <CalendarPlus size={18} />
        Registar passado
      </button>
    </div>
  )
}
