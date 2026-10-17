import { useMemo, useState } from 'react'
import { CORES } from './cores'
import Grafico from './Grafico'
import Pilulas from './Pilulas'
import { serieMedicoes } from './corpo'
import { dataDeChave, inicioPeriodo } from './estatisticas'
import { formatarDataExtenso, formatarPeso } from './formatar'

const METRICAS = [
  { id: 'peso_kg', nome: 'Peso', unidade: ' kg' },
  { id: 'massa_muscular_kg', nome: 'Massa muscular', unidade: ' kg' },
  { id: 'massa_gorda_kg', nome: 'Massa gorda', unidade: ' kg' },
  { id: 'gordura_pct', nome: '% gordura', unidade: '%' },
  { id: 'imc', nome: 'IMC', unidade: '' },
]
const PERIODOS = [
  { id: '6m', nome: '6 meses' },
  { id: '1a', nome: '1 ano' },
  { id: 'sempre', nome: 'Sempre' },
]

function formatarValor(valor, metrica) {
  const { unidade } = METRICAS.find((m) => m.id === metrica)
  return `${formatarPeso(Math.round(valor * 10) / 10)}${unidade}`
}

// Evolução das medições corporais: um ponto por medição que tenha a métrica escolhida
export default function GraficoMedicoes({ medicoes, alturaCm }) {
  const [agora] = useState(() => new Date())
  const [metrica, setMetrica] = useState('peso_kg')
  const [periodo, setPeriodo] = useState('sempre')
  const [selecionadoId, setSelecionadoId] = useState(null)

  const pontos = useMemo(
    () => serieMedicoes(medicoes, metrica, alturaCm, inicioPeriodo(periodo, agora)),
    [medicoes, metrica, alturaCm, periodo, agora]
  )
  const selecionado = pontos.find((p) => p.medicao.id === selecionadoId) ?? null

  const dados = useMemo(
    () => ({
      labels: pontos.map((p) => {
        const d = dataDeChave(p.medicao.data)
        return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
      }),
      datasets: [
        {
          data: pontos.map((p) => p.valor),
          borderColor: CORES.verde,
          borderWidth: 2,
          tension: 0.25,
          pointRadius: pontos.map((p) => (p.medicao.id === selecionadoId ? 8 : 4)),
          pointBackgroundColor: CORES.verde,
          pointBorderColor: pontos.map((p) => (p.medicao.id === selecionadoId ? CORES.texto : CORES.verde)),
          pointBorderWidth: pontos.map((p) => (p.medicao.id === selecionadoId ? 3 : 1)),
          pointHoverRadius: 8,
          pointHitRadius: 16,
        },
      ],
    }),
    [pontos, selecionadoId]
  )

  const opcoes = useMemo(
    () => ({
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      onClick: (_evento, elementos) => {
        if (elementos.length) setSelecionadoId(pontos[elementos[0].index].medicao.id)
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (itens) => formatarDataExtenso(dataDeChave(pontos[itens[0].dataIndex].medicao.data)),
            label: (item) => formatarValor(item.raw, metrica),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 10 } },
        y: {
          border: { display: false },
          grid: { color: CORES.borda },
          grace: '10%',
          ticks: { maxTicksLimit: 5, callback: (v) => formatarPeso(v) },
        },
      },
    }),
    [pontos, metrica]
  )

  return (
    <div className="cartao">
      <h2>Evolução</h2>
      <Pilulas opcoes={METRICAS} valor={metrica} onMudar={setMetrica} rotulo="Métrica" />
      <Pilulas opcoes={PERIODOS} valor={periodo} onMudar={setPeriodo} pequenas rotulo="Período" />

      {metrica === 'imc' && !alturaCm ? (
        <p className="subtitulo sem-margem">Indica a tua altura nos dados pessoais para ver o IMC.</p>
      ) : pontos.length === 0 ? (
        <p className="subtitulo sem-margem">Não há medições com este valor neste período.</p>
      ) : (
        <>
          <Grafico
            tipo="line"
            dados={dados}
            opcoes={opcoes}
            descricao={`Gráfico da evolução: ${METRICAS.find((m) => m.id === metrica).nome}`}
          />
          {selecionado ? (
            <div className="ponto-escolhido">
              <div>
                <strong>{formatarValor(selecionado.valor, metrica)}</strong>
                <span className="ponto-escolhido-detalhe">
                  {formatarDataExtenso(dataDeChave(selecionado.medicao.data))}
                </span>
              </div>
            </div>
          ) : (
            <p className="nota">Toca num ponto para ver a data e o valor.</p>
          )}
        </>
      )}
    </div>
  )
}
