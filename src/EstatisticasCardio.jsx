import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Clock, Gauge, HeartPulse, Route, Trophy } from 'lucide-react'
import { buscarAtividadesCardio } from './consultas'
import Esqueleto from './Esqueleto'
import EstadoVazio from './EstadoVazio'
import Grafico from './Grafico'
import IconeAtividade from './IconeAtividade'
import Pilulas from './Pilulas'
import {
  evolucaoRitmo,
  filtrarSessoes,
  filtrosCardio,
  recordesCardio,
  resumoCardio,
  resumoSessao,
  serieCardio,
  sessoesCardio,
  textoDistancia,
} from './cardio'
import { formatarTempo } from './condicionamento'
import { CORES, degradeVerde } from './cores'
import { abreviarNumero, formatarDataCurta, formatarMes, formatarMinutos, formatarPeso } from './formatar'

const METRICAS = [
  { id: 'distancia', nome: 'Distância' },
  { id: 'tempo', nome: 'Tempo' },
  { id: 'sessoes', nome: 'Sessões' },
]
const UNIDADES = [
  { id: 'semana', nome: 'Semanas' },
  { id: 'mes', nome: 'Meses' },
]
const FAMILIAS = [
  { id: 'corrida', nome: 'Corrida' },
  { id: 'caminhada', nome: 'Caminhada' },
]

// distância em metros, tempo em segundos
function formatarMetrica(valor, metrica) {
  if (metrica === 'distancia') return `${formatarPeso(Math.round(valor / 100) / 10)} km`
  if (metrica === 'tempo') return formatarMinutos(Math.round(valor / 60))
  return abreviarNumero(valor)
}

const mesCurto = (data) => data.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')

// Estatísticas do cardio (separador "Cardio" das Estatísticas): totais e barras por semana ou mês, com
// um filtro por atividade, a evolução do ritmo da corrida e da caminhada, e os recordes.
// onAbrirTreino(id): abre o treino de uma sessão.
export default function EstatisticasCardio({ agora, onAbrirTreino }) {
  const [sessoes, setSessoes] = useState(null) // null = a carregar
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todas')

  useEffect(() => {
    let ativo = true
    buscarAtividadesCardio().then((resultado) => {
      if (!ativo) return
      if (resultado.erro) {
        setErro(resultado.erro)
        setSessoes([])
      } else {
        setSessoes(sessoesCardio(resultado.linhas))
      }
    })
    return () => {
      ativo = false
    }
  }, [])

  const filtros = useMemo(() => [{ id: 'todas', nome: 'Todas' }, ...filtrosCardio(sessoes ?? [])], [sessoes])
  const filtradas = useMemo(() => filtrarSessoes(sessoes ?? [], filtro), [sessoes, filtro])

  if (sessoes === null) return <Esqueleto numeros={3} cartoes={2} linhas={3} />
  if (sessoes.length === 0) {
    return (
      <>
        {erro && <p className="erro">{erro}</p>}
        <EstadoVazio
          icone={HeartPulse}
          titulo="Ainda não há cardio"
          texto='Regista uma atividade no Início ("Registar atividade") ou junta um bloco de cardio a um treino.'
        />
      </>
    )
  }

  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      {filtros.length > 2 && (
        <Pilulas opcoes={filtros} valor={filtro} onMudar={setFiltro} pequenas rotulo="Atividade" />
      )}
      <ResumoCardio sessoes={filtradas} agora={agora} />
      <EvolucaoRitmo sessoes={filtradas} />
      <RecordesCardio sessoes={filtradas} onAbrirTreino={onAbrirTreino} />
    </>
  )
}

// ---------- Totais ----------

function ResumoCardio({ sessoes, agora }) {
  const [metrica, setMetrica] = useState('distancia')
  const [unidade, setUnidade] = useState('semana')
  const resumo = useMemo(() => resumoCardio(sessoes, metrica, agora), [sessoes, metrica, agora])
  const serie = useMemo(() => serieCardio(sessoes, metrica, unidade, agora), [sessoes, metrica, unidade, agora])

  // No gráfico: km, horas ou sessões
  const dados = useMemo(
    () => ({
      labels: serie.map(({ inicio }) => (unidade === 'semana' ? `${inicio.getDate()}/${inicio.getMonth() + 1}` : mesCurto(inicio))),
      datasets: [
        {
          data: serie.map((b) => (metrica === 'distancia' ? b.valor / 1000 : metrica === 'tempo' ? b.valor / 3600 : b.valor)),
          backgroundColor: serie.map((_, i) => (i === serie.length - 1 ? CORES.verdeSuave : CORES.verde)),
          borderRadius: 6,
          maxBarThickness: 28,
        },
      ],
    }),
    [serie, unidade, metrica]
  )
  const opcoes = useMemo(
    () => ({
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => {
              const { inicio } = serie[itens[0].dataIndex]
              return unidade === 'semana' ? `Semana de ${formatarDataCurta(inicio)}` : formatarMes(inicio)
            },
            label: (item) => formatarMetrica(serie[item.dataIndex].valor, metrica),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 6 } },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: CORES.grelha },
          ticks: {
            maxTicksLimit: 5,
            precision: metrica === 'sessoes' ? 0 : undefined,
            callback: (v) => (metrica === 'distancia' ? `${formatarPeso(v)} km` : metrica === 'tempo' ? `${formatarPeso(v)} h` : v),
          },
        },
      },
    }),
    [serie, unidade, metrica]
  )

  return (
    <section className="seccao">
      <h2 className="titulo-seccao">Resumo do cardio</h2>
      <Pilulas opcoes={METRICAS} valor={metrica} onMudar={setMetrica} rotulo="Métrica" />
      <div className="cartoes-resumo">
        <CartaoNumero rotulo="Este mês" valor={formatarMetrica(resumo.mes, metrica)} />
        <CartaoNumero rotulo="Este ano" valor={formatarMetrica(resumo.ano, metrica)} />
        <CartaoNumero rotulo="Desde sempre" valor={formatarMetrica(resumo.sempre, metrica)} />
      </div>
      <div className="cartao">
        <div className="cartao-topo">
          <h3>
            {METRICAS.find((m) => m.id === metrica).nome} por {unidade === 'semana' ? 'semana' : 'mês'}
          </h3>
          <Pilulas opcoes={UNIDADES} valor={unidade} onMudar={setUnidade} pequenas rotulo="Agrupar por" />
        </div>
        <Grafico
          tipo="bar"
          dados={dados}
          opcoes={opcoes}
          descricao={`Gráfico de barras: ${metrica} de cardio nas últimas 12 ${unidade === 'semana' ? 'semanas' : 'meses'}`}
        />
        {resumo.sempre === 0 && metrica === 'distancia' && (
          <p className="nota">Estas atividades não têm distância: vê o tempo ou as sessões.</p>
        )}
      </div>
    </section>
  )
}

function CartaoNumero({ rotulo, valor }) {
  return (
    <div className="cartao cartao-numero">
      <span className="cartao-numero-valor">{valor}</span>
      <span className="cartao-numero-rotulo">{rotulo}</span>
    </div>
  )
}

// ---------- Evolução do ritmo ----------

function EvolucaoRitmo({ sessoes }) {
  const disponiveis = FAMILIAS.filter((f) => evolucaoRitmo(sessoes, f.id).length > 0)
  const [escolhida, setEscolhida] = useState('corrida')
  const familia = disponiveis.some((f) => f.id === escolhida) ? escolhida : disponiveis[0]?.id
  const pontos = useMemo(() => (familia ? evolucaoRitmo(sessoes, familia) : []), [sessoes, familia])

  const dados = useMemo(
    () => ({
      labels: pontos.map((p) => {
        const d = new Date(p.sessao.data)
        return `${d.getDate()}/${d.getMonth() + 1}`
      }),
      datasets: [
        {
          data: pontos.map((p) => Math.round(p.ritmo)),
          borderColor: CORES.verde,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          backgroundColor: degradeVerde,
          pointRadius: pontos.length > 40 ? 2 : 3.5,
          pointBackgroundColor: CORES.verde,
          pointHitRadius: 16,
        },
      ],
    }),
    [pontos]
  )
  const opcoes = useMemo(
    () => ({
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => formatarDataCurta(pontos[itens[0].dataIndex].sessao.data),
            label: (item) => `${formatarTempo(item.raw)} /km`,
            afterLabel: (item) => textoDistancia(pontos[item.dataIndex].sessao.distancia_m),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
        // Ritmo mais baixo = mais rápido: o eixo fica ao contrário, para "subir" ser melhorar
        y: { reverse: true, grace: '10%', ticks: { maxTicksLimit: 5, callback: (v) => formatarTempo(v) } },
      },
    }),
    [pontos]
  )

  if (disponiveis.length === 0) return null

  return (
    <section className="seccao">
      <h2 className="titulo-seccao com-icone">
        <Gauge size={20} aria-hidden="true" />
        Evolução do ritmo
      </h2>
      <div className="cartao">
        {disponiveis.length > 1 && <Pilulas opcoes={disponiveis} valor={familia} onMudar={setEscolhida} pequenas rotulo="Atividade" />}
        {pontos.length < 2 ? (
          <p className="subtitulo sem-margem">Ainda só há uma sessão com pelo menos 1 km: a evolução aparece a partir da segunda.</p>
        ) : (
          <Grafico tipo="line" dados={dados} opcoes={opcoes} descricao={`Gráfico de linhas: ritmo médio da ${familia} por sessão`} />
        )}
        <p className="nota">Ritmo médio de cada sessão (em min/km), só nas sessões com pelo menos 1 km. Para cima é mais rápido.</p>
      </div>
    </section>
  )
}

// ---------- Recordes ----------

function RecordesCardio({ sessoes, onAbrirTreino }) {
  const { maiorDistancia, maisTempo, ritmo5k, ritmo10k } = useMemo(() => recordesCardio(sessoes), [sessoes])
  const ritmo = (r) => `${formatarTempo(Math.round(r.valor))} /km`
  const cartoes = [
    maiorDistancia && { id: 'distancia', icone: Route, rotulo: 'Maior distância', valor: textoDistancia(maiorDistancia.valor), r: maiorDistancia },
    maisTempo && { id: 'tempo', icone: Clock, rotulo: 'Mais tempo', valor: formatarTempo(maisTempo.valor), r: maisTempo },
    ritmo5k && { id: '5k', icone: Trophy, rotulo: 'Melhor ritmo · 5 km ou mais', valor: ritmo(ritmo5k), r: ritmo5k },
    ritmo10k && { id: '10k', icone: Trophy, rotulo: 'Melhor ritmo · 10 km ou mais', valor: ritmo(ritmo10k), r: ritmo10k },
  ].filter(Boolean)

  return (
    <section className="seccao">
      <h2 className="titulo-seccao com-icone">
        <Trophy size={20} aria-hidden="true" />
        Recordes do cardio
      </h2>
      <div className="recordes">
        {cartoes.map((c) => (
          <button key={c.id} className="cartao cartao-recorde" onClick={() => onAbrirTreino(c.r.sessao.treino_id)}>
            <span className="cartao-recorde-rotulo com-icone">
              <c.icone size={16} aria-hidden="true" />
              {c.rotulo}
            </span>
            <span className="cartao-recorde-valor">{c.valor}</span>
            <span className="cartao-recorde-detalhe com-icone">
              <IconeAtividade atividade={c.r.sessao.atividade} size={14} />
              {resumoSessao(c.r.sessao)}
            </span>
            <span className="cartao-recorde-data com-icone">
              {formatarDataCurta(c.r.sessao.data)}
              <ChevronRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
      {(ritmo5k || ritmo10k) && (
        <p className="nota">
          Os recordes de ritmo são o ritmo médio da sessão inteira (corridas com pelo menos 5 ou 10 km), não um
          parcial dentro dela.
        </p>
      )}
    </section>
  )
}
