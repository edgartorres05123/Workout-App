import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CalendarPlus,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  Layers,
  Lightbulb,
  Play,
  RotateCcw,
  Route,
  Star,
  Timer,
  Weight,
} from 'lucide-react'
import { buscarAtividadesCardio, buscarExercicios, buscarFavoritos, buscarTreino, buscarTreinosTerminados } from './consultas'
import { cardioDaSemana, resumoSessao, sessoesCardio, sessoesDoTreino, textoDistancia } from './cardio'
import { formatarTempo } from './condicionamento'
import IconeAtividade from './IconeAtividade'
import { useCarga } from './contextoPesoCorporal'
import { useSemana } from './contextoSemana'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import Numero from './Numero'
import SemanaMusculos from './SemanaMusculos'
import { estruturaParaCopiar, exerciciosDaEstrutura } from './blocos'
import {
  abreviarNumero,
  agruparPorExercicio,
  calcularVolume,
  formatarDataExtenso,
  formatarMinutos,
  formatarPeso,
} from './formatar'
import { diasDaSemanaAtual, primeiroNome, resumoSemana, saudacao, treinoMaisRecente } from './inicio'
import { nomeMusculo } from './musculos'
import { juntarNomes } from './semana'
import { gerarSugestao, sementeDoDia } from './sugestoes'

// O detalhe do último treino só é descarregado quando se toca no cartão
// (assim o ficheiro principal, que abre o ecrã de treino, fica mais leve)
const DetalheTreino = lazy(() => import('./DetalheTreino'))

const MAX_NOMES = 3
const MAX_FAVORITOS = 3

// Os treinos terminados (para a semana e a sequência), o último treino completo (com os blocos)
// os treinos favoritos e os exercícios com os músculos (para a semana por músculo e a sugestão).
// Os favoritos e os exercícios são um extra: se falharem, o início abre na mesma.
async function buscarInicio() {
  const [resultado, favoritos, exercicios, cardio] = await Promise.all([
    buscarTreinosTerminados(),
    buscarFavoritos(),
    buscarExercicios(),
    buscarAtividadesCardio(),
  ])
  if (resultado.erro) return { erro: resultado.erro }
  const recente = treinoMaisRecente(resultado.linhas)
  let ultimo = null
  if (recente) {
    const completo = await buscarTreino(recente.id)
    if (completo.erro) return { erro: completo.erro }
    ultimo = completo.treino
  }
  return {
    treinos: resultado.linhas,
    ultimo,
    favoritos: favoritos.favoritos ?? [],
    exercicios: exercicios.linhas ?? [],
    cardio: sessoesCardio(cardio.linhas ?? []),
    agora: new Date(),
  }
}

// Ecrã de início do separador Início, quando não há treino em curso.
// ativo: o separador está visível (recarrega ao voltar); recarregar: muda depois de um treino acabar.
// onCabecalho({ titulo, hero }): diz ao cabeçalho se há imagem por baixo (para ficar transparente).
export default function InicioTreino({
  nome,
  ativo,
  recarregar,
  resumo,
  aCriar,
  onComecar,
  onRepetir,
  onRegistar,
  onRegistarAtividade,
  onCabecalho,
  onVerFavoritos,
}) {
  const [agoraInicial] = useState(() => new Date())
  const [dados, setDados] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null) // treino aberto no detalhe
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    onCabecalho?.({ titulo: aberto ? 'Treino' : 'Início', hero: !aberto, emCurso: false })
  }, [aberto, onCabecalho])

  useEffect(() => {
    if (!ativo) return
    let vivo = true
    buscarInicio().then((resultado) => {
      if (!vivo) return
      if (resultado.erro) return setErro(resultado.erro)
      setErro('')
      setDados(resultado)
    })
    return () => {
      vivo = false
    }
  }, [ativo, recarregar, versao])

  function fecharDetalhe() {
    setAberto(null)
    setVersao((v) => v + 1) // o treino pode ter sido editado ou apagado
    window.scrollTo(0, 0)
  }

  if (aberto) {
    return (
      <Suspense fallback={<Esqueleto cartoes={3} linhas={3} />}>
        <DetalheTreino
          key={aberto.id}
          treino={aberto}
          onVoltar={fecharDetalhe}
          onAlterar={(atualizar) => setAberto((atual) => atualizar(atual))}
          onApagado={fecharDetalhe}
        />
      </Suspense>
    )
  }

  const agora = dados?.agora ?? agoraInicial
  const primeiro = primeiroNome(nome)
  const ultimo = dados?.ultimo
  const temEstrutura = ultimo?.blocos?.some(
    (b) => b.bloco_exercicios.length > 0 || (b.tipo === 'cardio' && b.atividades_cardio?.length > 0)
  )

  return (
    <div className="inicio">
      <ImagemInicio>
        <h2 className="hero-saudacao">
          {saudacao(agora)}
          {primeiro ? `, ${primeiro}` : ''}
        </h2>
        <p className="hero-data">{formatarDataExtenso(agora)}</p>
      </ImagemInicio>

      {resumo && (
        <div className="cartao resumo">
          <h2>{resumo.titulo}</h2>
          <div className="numeros">
            <Numero valor={formatarMinutos(resumo.duracao)} rotulo="Duração" />
            {(resumo.numSeries > 0 || !resumo.cardio) && (
              <Numero valor={`${formatarPeso(resumo.volume)} kg`} rotulo="Volume" destaque />
            )}
          </div>
          {(resumo.numSeries > 0 || !resumo.cardio) && (
            <p className="subtitulo resumo-detalhe">
              {resumo.numExercicios} {resumo.numExercicios === 1 ? 'exercício' : 'exercícios'} ·{' '}
              {resumo.numSeries} {resumo.numSeries === 1 ? 'série' : 'séries'}
            </p>
          )}
          {resumo.cardio && (
            <p className="subtitulo resumo-detalhe com-icone">
              <HeartPulse size={15} aria-hidden="true" />
              {resumo.cardio}
            </p>
          )}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}

      {dados === null ? (
        !erro && <Esqueleto numeros={3} cartoes={2} linhas={3} />
      ) : dados.treinos.length === 0 ? (
        <EstadoVazio
          icone={Dumbbell}
          titulo="Bem-vindo à Workout App"
          texto="Começa o primeiro treino: adicionas os blocos e os exercícios à medida que treinas."
        >
          <button className="botao-grande com-icone" onClick={onComecar} disabled={aCriar}>
            <Play size={20} />
            Começar treino
          </button>
          <button className="botao-secundario com-icone" onClick={onRegistarAtividade} disabled={aCriar}>
            <Activity size={18} />
            Registar atividade
          </button>
        </EstadoVazio>
      ) : (
        <>
          <Semana treinos={dados.treinos} agora={agora} />

          <CartaoCardioSemana sessoes={dados.cardio} agora={agora} />

          <SemanaMusculos treinos={dados.treinos} exercicios={dados.exercicios} agora={agora} />

          <CartaoSugestao treinos={dados.treinos} exercicios={dados.exercicios} agora={agora} />

          {ultimo && <CartaoUltimo treino={ultimo} onAbrir={() => setAberto(ultimo)} />}

          <Favoritos
            favoritos={dados.favoritos}
            desativado={aCriar}
            onComecar={(favorito) => onRepetir(estruturaParaCopiar(favorito))}
            onVerTodos={onVerFavoritos}
          />

          <div className="inicio-acoes">
            <div className="inicio-acoes-linha">
              <button className="botao-grande com-icone" onClick={onComecar} disabled={aCriar}>
                <Play size={20} />
                Começar treino
              </button>
              <button className="botao-secundario com-icone" onClick={onRegistarAtividade} disabled={aCriar}>
                <Activity size={18} />
                Registar atividade
              </button>
            </div>
            {temEstrutura && (
              <button
                className="botao-secundario com-icone"
                onClick={() => onRepetir(estruturaParaCopiar(ultimo))}
                disabled={aCriar}
              >
                <RotateCcw size={18} />
                Repetir último treino
              </button>
            )}
            <button className="botao-terciario com-icone" onClick={onRegistar} disabled={aCriar}>
              <CalendarPlus size={18} />
              Registar treino passado
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Faixa com a imagem no topo do início, a passar por baixo do cabeçalho e da barra de estado.
// O contentor tem altura fixa (sem saltos no layout) e uma cor escura enquanto a imagem carrega.
// O enquadramento afina-se na variável CSS --foco-imagem-inicio (object-position).
function ImagemInicio({ children }) {
  return (
    <div className="hero">
      <img
        className="hero-imagem"
        src="/imagem-inicio-800.webp"
        srcSet="/imagem-inicio-800.webp 800w, /imagem-inicio-1600.webp 1600w"
        sizes="(min-width: 480px) 480px, 100vw"
        width="800"
        height="1776"
        alt=""
        decoding="async"
        fetchPriority="high"
      />
      <div className="hero-texto">{children}</div>
    </div>
  )
}

// Os três números da semana e a fila dos 7 dias
function Semana({ treinos, agora }) {
  const carga = useCarga()
  const resumo = resumoSemana(treinos, agora, carga)
  const dias = diasDaSemanaAtual(treinos, agora)

  return (
    <>
      <div className="cartoes-resumo">
        <div className="cartao cartao-numero">
          <span className="cartao-numero-valor">{resumo.treinos}</span>
          <span className="cartao-numero-rotulo">{resumo.treinos === 1 ? 'Treino esta semana' : 'Treinos esta semana'}</span>
        </div>
        <div className="cartao cartao-numero">
          <span className="cartao-numero-valor com-icone">
            <Flame size={18} aria-hidden="true" />
            {resumo.sequencia}
          </span>
          <span className="cartao-numero-rotulo">{resumo.sequencia === 1 ? 'Semana seguida' : 'Semanas seguidas'}</span>
        </div>
        <div className="cartao cartao-numero">
          <span className="cartao-numero-valor">{abreviarNumero(resumo.volume)} kg</span>
          <span className="cartao-numero-rotulo">Volume esta semana</span>
        </div>
      </div>

      <div className="cartao semana" aria-label="Dias com treino esta semana">
        {dias.map((d) => (
          <div
            key={d.chave}
            className={`semana-dia${d.hoje ? ' hoje' : ''}${d.futuro ? ' futuro' : ''}${d.temTreino ? ' com-treino' : ''}`}
            aria-label={`${d.dia}${d.temTreino ? ', com treino' : ''}`}
          >
            <span className="semana-letra">{d.letra}</span>
            <span className="semana-numero">{d.dia}</span>
            <span className="semana-ponto" aria-hidden="true" />
          </div>
        ))}
      </div>
    </>
  )
}

// "Sugestão para hoje": os músculos-alvo e os exercícios da sugestão automática (a mesma semente do
// dia que a página "Ideias de treino" usa ao abrir); tocar abre essa página
function CartaoSugestao({ treinos, exercicios, agora }) {
  const { objetivos, abrirIdeias } = useSemana()
  const sugestao = useMemo(
    () => gerarSugestao({ treinos, exercicios, objetivos, agora, semente: sementeDoDia(agora) }),
    [treinos, exercicios, objetivos, agora]
  )
  if (!abrirIdeias || sugestao.alvos.length === 0) return null
  const nomes = sugestao.itens.map((i) => i.exercicio.nome)
  const resto = nomes.length - 2

  return (
    <button className="cartao cartao-treino cartao-sugestao" onClick={() => abrirIdeias()}>
      <span className="cartao-treino-topo">
        <span className="rotulo-pequeno com-icone">
          <Lightbulb size={14} aria-hidden="true" />
          Sugestão para hoje
        </span>
        <ChevronRight size={18} className="seta" aria-hidden="true" />
      </span>
      <span className="cartao-treino-data">{juntarNomes(sugestao.alvos.map(nomeMusculo))}</span>
      <span className="cartao-treino-exercicios">
        {sugestao.insuficiente
          ? 'Ainda tens poucos exercícios para estes músculos: vê os modelos prontos.'
          : <>
              {nomes.length} exercícios: {nomes.slice(0, 2).join(', ')}
              {resto > 0 && <span className="mais"> +{resto}</span>}
            </>}
      </span>
    </button>
  )
}

// Até 3 favoritos em cartões pequenos: um toque começa um treino ao vivo com a estrutura copiada
function Favoritos({ favoritos, desativado, onComecar, onVerTodos }) {
  if (favoritos.length === 0) return null
  return (
    <section className="inicio-favoritos" aria-label="Treinos favoritos">
      <div className="inicio-favoritos-topo">
        <h2 className="rotulo-pequeno com-icone">
          <Star size={14} aria-hidden="true" />
          Favoritos
        </h2>
        {favoritos.length > MAX_FAVORITOS && onVerTodos && (
          <button className="botao-link" onClick={onVerTodos}>
            Ver todos ({favoritos.length})
          </button>
        )}
      </div>
      <div className="inicio-favoritos-lista">
        {favoritos.slice(0, MAX_FAVORITOS).map((f) => {
          const { nomes, resto } = exerciciosDaEstrutura(f, 2)
          return (
            <button
              key={f.id}
              className="cartao cartao-favorito-inicio"
              onClick={() => onComecar(f)}
              disabled={desativado}
              aria-label={`Começar ${f.nome_favorito ?? 'favorito'}`}
            >
              <span className="cartao-favorito-inicio-nome">{f.nome_favorito ?? 'Treino favorito'}</span>
              <span className="cartao-favorito-inicio-exercicios">
                {nomes.join(', ') || 'Sem exercícios'}
                {resto > 0 && ` +${resto}`}
              </span>
              <span className="cartao-favorito-inicio-acao com-icone">
                <Play size={14} aria-hidden="true" />
                Começar
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// "Cardio esta semana": km e tempo (só aparece se houver)
function CartaoCardioSemana({ sessoes, agora }) {
  const semana = cardioDaSemana(sessoes, agora)
  if (semana.sessoes === 0) return null
  return (
    <div className="cartao cartao-cardio-semana">
      <span className="rotulo-pequeno com-icone">
        <HeartPulse size={14} aria-hidden="true" />
        Cardio esta semana
      </span>
      <span className="cartao-cardio-semana-numeros">
        {semana.distancia_m > 0 && (
          <span className="com-icone">
            <Route size={15} aria-hidden="true" />
            {textoDistancia(semana.distancia_m)}
          </span>
        )}
        <span className="com-icone">
          <Timer size={15} aria-hidden="true" />
          {formatarTempo(semana.duracao_seg)}
        </span>
        <span>
          {semana.sessoes} {semana.sessoes === 1 ? 'sessão' : 'sessões'}
        </span>
      </span>
    </div>
  )
}

function CartaoUltimo({ treino, onAbrir }) {
  const carga = useCarga()
  const cardio = sessoesDoTreino(treino)
  const soCardio = treino.series.length === 0 && cardio.length > 0
  const nomes = agruparPorExercicio(treino.series).map((g) => g.exercicio?.nome ?? '—')
  const resto = nomes.length - MAX_NOMES
  const numBlocos = treino.blocos?.length ?? 0

  return (
    <button className="cartao cartao-treino cartao-ultimo" onClick={onAbrir}>
      <span className="cartao-treino-topo">
        <span className="rotulo-pequeno">Último treino</span>
        <ChevronRight size={18} className="seta" aria-hidden="true" />
      </span>
      <span className="cartao-treino-data">{formatarDataExtenso(treino.data)}</span>
      <span className="cartao-treino-numeros">
        <span className="com-icone">
          <Layers size={15} aria-hidden="true" />
          {numBlocos} {numBlocos === 1 ? 'bloco' : 'blocos'}
        </span>
        <span className="com-icone">
          <Timer size={15} aria-hidden="true" />
          {formatarMinutos(treino.duracao_min ?? 0)}
        </span>
        {!soCardio && (
          <span className="com-icone">
            <Weight size={15} aria-hidden="true" />
            {abreviarNumero(calcularVolume(treino.series, (s) => carga(s, treino.data)))} kg
          </span>
        )}
      </span>
      {nomes.length > 0 && (
        <span className="cartao-treino-exercicios">
          {nomes.slice(0, MAX_NOMES).join(', ')}
          {resto > 0 && <span className="mais"> +{resto}</span>}
        </span>
      )}
      {cardio.map((sessao) => (
        <span key={sessao.bloco_id} className="cartao-treino-cardio com-icone">
          <IconeAtividade atividade={sessao.atividade} size={15} />
          {resumoSessao(sessao)}
        </span>
      ))}
    </button>
  )
}
