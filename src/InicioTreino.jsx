import { lazy, Suspense, useEffect, useState } from 'react'
import { CalendarPlus, ChevronRight, Dumbbell, Flame, Layers, Play, RotateCcw, Timer, Weight } from 'lucide-react'
import { buscarTreino, buscarTreinosTerminados } from './consultas'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import Numero from './Numero'
import { estruturaParaCopiar } from './blocos'
import {
  abreviarNumero,
  agruparPorExercicio,
  calcularVolume,
  formatarDataExtenso,
  formatarMinutos,
  formatarPeso,
} from './formatar'
import { diasDaSemanaAtual, primeiroNome, resumoSemana, saudacao, treinoMaisRecente } from './inicio'

// O detalhe do último treino só é descarregado quando se toca no cartão
// (assim o ficheiro principal, que abre o ecrã de treino, fica mais leve)
const DetalheTreino = lazy(() => import('./DetalheTreino'))

const MAX_NOMES = 3

// Os treinos terminados (para a semana e a sequência) e o último treino completo (com os blocos)
async function buscarInicio() {
  const resultado = await buscarTreinosTerminados()
  if (resultado.erro) return { erro: resultado.erro }
  const recente = treinoMaisRecente(resultado.linhas)
  let ultimo = null
  if (recente) {
    const completo = await buscarTreino(recente.id)
    if (completo.erro) return { erro: completo.erro }
    ultimo = completo.treino
  }
  return { treinos: resultado.linhas, ultimo, agora: new Date() }
}

// Ecrã de início do separador Treino, quando não há treino em curso.
// ativo: o separador está visível (recarrega ao voltar); recarregar: muda depois de um treino acabar.
export default function InicioTreino({ nome, ativo, recarregar, resumo, aCriar, onComecar, onRepetir, onRegistar }) {
  const [dados, setDados] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  const [aberto, setAberto] = useState(null) // treino aberto no detalhe
  const [versao, setVersao] = useState(0)

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

  const agora = dados?.agora ?? null
  const primeiro = primeiroNome(nome)
  const ultimo = dados?.ultimo
  const temEstrutura = ultimo?.blocos?.some((b) => b.bloco_exercicios.length > 0)

  return (
    <div className="inicio">
      <header className="inicio-cabecalho">
        <h1>{agora ? `${saudacao(agora)}${primeiro ? `, ${primeiro}` : ''}` : 'Treino'}</h1>
        {agora && <p className="subtitulo">{formatarDataExtenso(agora)}</p>}
      </header>

      {resumo && (
        <div className="cartao resumo">
          <h2>{resumo.titulo}</h2>
          <div className="numeros">
            <Numero valor={formatarMinutos(resumo.duracao)} rotulo="Duração" />
            <Numero valor={`${formatarPeso(resumo.volume)} kg`} rotulo="Volume" destaque />
          </div>
          <p className="subtitulo resumo-detalhe">
            {resumo.numExercicios} {resumo.numExercicios === 1 ? 'exercício' : 'exercícios'} ·{' '}
            {resumo.numSeries} {resumo.numSeries === 1 ? 'série' : 'séries'}
          </p>
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
        </EstadoVazio>
      ) : (
        <>
          <Semana treinos={dados.treinos} agora={agora} />

          {ultimo && <CartaoUltimo treino={ultimo} onAbrir={() => setAberto(ultimo)} />}

          <div className="inicio-acoes">
            <button className="botao-grande com-icone" onClick={onComecar} disabled={aCriar}>
              <Play size={20} />
              Começar treino
            </button>
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

// Os três números da semana e a fila dos 7 dias
function Semana({ treinos, agora }) {
  const resumo = resumoSemana(treinos, agora)
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

function CartaoUltimo({ treino, onAbrir }) {
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
        <span className="com-icone">
          <Weight size={15} aria-hidden="true" />
          {abreviarNumero(calcularVolume(treino.series))} kg
        </span>
      </span>
      {nomes.length > 0 && (
        <span className="cartao-treino-exercicios">
          {nomes.slice(0, MAX_NOMES).join(', ')}
          {resto > 0 && <span className="mais"> +{resto}</span>}
        </span>
      )}
    </button>
  )
}
