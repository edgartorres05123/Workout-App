import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { CORES, degradeVerde } from './cores'
import Grafico from './Grafico'
import Pilulas from './Pilulas'
import { estimarRM, evolucaoExercicio, inicioPeriodo, precisaoEstimativa } from './estatisticas'
import { abreviarNumero, formatarDataCurta, formatarDataExtenso, formatarPeso, melhorSerie } from './formatar'
import { usePesoCorporal } from './contextoPesoCorporal'
import { cargaSimples, pesoCorporalNaData, textoCargaEfetiva, textoSerie } from './pesoCorporal'

const METRICAS = [
  { id: '1rm', nome: '1RM estimado' },
  { id: 'peso', nome: 'Peso máximo' },
  { id: 'volume', nome: 'Volume' },
  { id: 'reps', nome: 'Melhores reps' },
]
const PERIODOS = [
  { id: '3m', nome: '3 meses' },
  { id: '6m', nome: '6 meses' },
  { id: '1a', nome: '1 ano' },
  { id: 'sempre', nome: 'Sempre' },
]
const REPETICOES_RM = [
  { id: 1, nome: '1RM' },
  { id: 3, nome: '3RM' },
  { id: 5, nome: '5RM' },
  { id: 10, nome: '10RM' },
]
const PRECISAO = {
  alta: 'Alta precisão',
  media: 'Precisão média',
  baixa: 'Baixa precisão',
}

function formatarValor(valor, metrica) {
  if (metrica === 'reps') return `${valor} reps`
  if (metrica === 'volume') return `${abreviarNumero(valor)} kg`
  return `${formatarPeso(Math.round(valor * 10) / 10)} kg`
}

const arredondarMeioKg = (kg) => Math.round(kg * 2) / 2

// Gráfico de evolução e cartão eRM da página de um exercício.
// series: todas as séries do exercício em treinos terminados (com s.treinos = { id, data }).
// carga(serie, data): carga efetiva (peso corporal incluído); pesoCorporal: o exercício é de peso corporal.
export default function EvolucaoExercicio({ series, carga = cargaSimples, pesoCorporal = false, onAbrirTreino }) {
  const [agora] = useState(() => new Date())
  const [metrica, setMetrica] = useState('1rm')
  const [periodo, setPeriodo] = useState('sempre')
  const [selecionadoId, setSelecionadoId] = useState(null) // id do treino do ponto tocado

  const desde = useMemo(() => inicioPeriodo(periodo, agora), [periodo, agora])

  // Os recordes são calculados com o histórico todo e só depois se filtra pelo período
  const pontos = useMemo(() => {
    const todos = evolucaoExercicio(series, metrica, carga)
    return desde ? todos.filter((p) => new Date(p.treino.data) >= desde) : todos
  }, [series, metrica, desde, carga])

  const selecionado = pontos.find((p) => p.treino.id === selecionadoId) ?? null
  const temRecordes = pontos.some((p) => p.recorde)

  const dados = useMemo(() => {
    const cor = (p) => (p.recorde ? CORES.recorde : CORES.verde)
    return {
      labels: pontos.map((p) => {
        const d = new Date(p.treino.data)
        return `${d.getDate()}/${d.getMonth() + 1}`
      }),
      datasets: [
        {
          data: pontos.map((p) => p.valor),
          borderColor: CORES.verde,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          backgroundColor: degradeVerde,
          pointRadius: pontos.map((p) =>
            p.treino.id === selecionadoId ? 8 : p.recorde ? 6 : pontos.length > 40 ? 2 : 3.5
          ),
          pointBackgroundColor: pontos.map(cor),
          pointBorderColor: pontos.map((p) => (p.treino.id === selecionadoId ? CORES.texto : cor(p))),
          pointBorderWidth: pontos.map((p) => (p.treino.id === selecionadoId ? 3 : 1)),
          pointHoverRadius: 8,
          pointHitRadius: 16,
        },
      ],
    }
  }, [pontos, selecionadoId])

  const opcoes = useMemo(
    () => ({
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      onClick: (_evento, elementos) => {
        if (elementos.length) setSelecionadoId(pontos[elementos[0].index].treino.id)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => formatarDataCurta(pontos[itens[0].dataIndex].treino.data),
            label: (item) => {
              const p = pontos[item.dataIndex]
              return `${formatarValor(p.valor, metrica)}${p.recorde ? '  🏆' : ''}`
            },
            afterLabel: (item) => {
              const { serie } = pontos[item.dataIndex]
              return serie ? textoSerie(serie.repeticoes, serie.peso_kg, pesoCorporal) : ''
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
        y: {
          border: { display: false },
          grid: { color: CORES.grelha },
          grace: '10%',
          ticks: {
            maxTicksLimit: 5,
            callback: (v) => (metrica === 'reps' ? v : abreviarNumero(v)),
          },
        },
      },
    }),
    [pontos, metrica, pesoCorporal]
  )

  return (
    <>
      <div className="cartao">
        <h2>Evolução</h2>
        <Pilulas opcoes={METRICAS} valor={metrica} onMudar={setMetrica} rotulo="Métrica" />
        <Pilulas opcoes={PERIODOS} valor={periodo} onMudar={setPeriodo} pequenas rotulo="Período" />

        {pontos.length === 0 ? (
          <p className="subtitulo sem-margem">Não há sessões deste exercício neste período.</p>
        ) : (
          <>
            <Grafico
              tipo="line"
              dados={dados}
              opcoes={opcoes}
              descricao={`Gráfico da evolução: ${METRICAS.find((m) => m.id === metrica).nome}`}
            />
            {temRecordes && (
              <p className="nota legenda-recorde">
                <span className="ponto-recorde" /> Recorde no momento em que aconteceu
              </p>
            )}
            {selecionado ? (
              <div className="ponto-escolhido">
                <div>
                  <strong>{formatarValor(selecionado.valor, metrica)}</strong>
                  {selecionado.recorde && <span className="etiqueta etiqueta-recorde">🏆 Recorde</span>}
                  <span className="ponto-escolhido-detalhe">
                    {formatarDataExtenso(selecionado.treino.data)}
                    {selecionado.serie &&
                      ` · ${textoSerie(selecionado.serie.repeticoes, selecionado.serie.peso_kg, pesoCorporal)}`}
                  </span>
                </div>
                <button className="botao-link com-icone" onClick={() => onAbrirTreino(selecionado.treino.id)}>
                  Abrir treino
                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <p className="nota">Toca num ponto para ver o treino.</p>
            )}
          </>
        )}
      </div>

      <CartaoERM series={series} desde={desde} periodo={periodo} carga={carga} pesoCorporal={pesoCorporal} />
    </>
  )
}

// Repetição máxima estimada a partir da melhor série (de sempre ou do período escolhido).
// Nos exercícios de peso corporal, a estimativa usa a carga total (corpo + extra).
function CartaoERM({ series, desde, periodo, carga, pesoCorporal }) {
  const [n, setN] = useState(1)
  const [explicacaoAberta, setExplicacaoAberta] = useState(false)
  const { medicoes } = usePesoCorporal()

  const origem = useMemo(
    () =>
      melhorSerie(
        series.filter((s) => !desde || new Date(s.treinos.data) >= desde),
        (s) => carga(s, s.treinos.data)
      ),
    [series, desde, carga]
  )

  if (!origem) return null

  const estimativa = estimarRM(origem.repeticoes, carga(origem, origem.treinos.data), n)
  // "8 × 84,5 kg (PC 74,5 + 10)"; sem peso corporal registado: "8 × PC + 10 kg"
  const textoOrigem = pesoCorporal
    ? `${origem.repeticoes} × ${textoCargaEfetiva(origem.peso_kg, pesoCorporalNaData(medicoes, origem.treinos.data))}`
    : textoSerie(origem.repeticoes, origem.peso_kg)
  const min = arredondarMeioKg(estimativa.min)
  const max = arredondarMeioKg(estimativa.max)
  const precisao = precisaoEstimativa(origem.repeticoes)
  const periodoTexto = {
    '3m': 'dos últimos 3 meses',
    '6m': 'dos últimos 6 meses',
    '1a': 'do último ano',
    sempre: 'de sempre',
  }[periodo]

  return (
    <div className="cartao erm">
      <h2>Repetição máxima estimada (eRM)</h2>
      <Pilulas
        opcoes={REPETICOES_RM}
        valor={n}
        onMudar={setN}
        rotulo="Número de repetições"
      />

      <p className="erm-valor">
        {min === max ? `${formatarPeso(min)} kg` : `${formatarPeso(min)} – ${formatarPeso(max)} kg`}
      </p>
      <p className="erm-formulas">
        Epley {formatarPeso(arredondarMeioKg(estimativa.epley))} kg
        {estimativa.brzycki !== null &&
          ` · Brzycki ${formatarPeso(arredondarMeioKg(estimativa.brzycki))} kg`}
      </p>

      <button
        className={`precisao precisao-${precisao}`}
        onClick={() => setExplicacaoAberta(!explicacaoAberta)}
        aria-expanded={explicacaoAberta}
      >
        {PRECISAO[precisao]} <span className="precisao-seta">{explicacaoAberta ? '▴' : '▾'}</span>
      </button>
      {explicacaoAberta && (
        <p className="nota erm-explicacao">
          As fórmulas estimam quanto conseguirias levantar a partir de uma série feita perto da
          falha. São mais fiáveis com poucas repetições: de 1 a 5 reps a precisão é alta, de 6 a 10 é
          média e acima de 10 é baixa. O intervalo vai da fórmula de Epley à de Brzycki; para 3, 5 e
          10RM, as fórmulas são aplicadas ao contrário a partir do 1RM estimado. Os valores estão
          arredondados ao meio quilo.
        </p>
      )}

      <p className="nota">
        Com base na melhor série {periodoTexto}: {textoOrigem}, a {formatarDataCurta(origem.treinos.data)}.
        {pesoCorporal && ' Os valores são a carga total (corpo + extra).'}
      </p>
    </div>
  )
}
