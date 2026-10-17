import { useEffect, useRef } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import { CORES, FONTE } from './cores'
import { reduzirMovimento } from './movimento'

// Só as peças do Chart.js que a app usa (barras, linhas com preenchimento e radar)
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip
)

Chart.defaults.color = CORES.textoSuave
Chart.defaults.borderColor = CORES.grelha
Chart.defaults.font.family = FONTE
Chart.defaults.font.size = 12
Chart.defaults.maintainAspectRatio = false
Chart.defaults.animation.duration = reduzirMovimento() ? 0 : 350
Chart.defaults.scale.grid.color = CORES.grelha
Chart.defaults.scale.border.display = false
Chart.defaults.elements.line.borderWidth = 2.5
Chart.defaults.elements.point.hoverBorderWidth = 2
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: 'rgba(24, 24, 24, 0.96)',
  borderColor: 'rgba(92, 230, 92, 0.35)',
  borderWidth: 1,
  titleColor: CORES.textoSuave,
  bodyColor: CORES.texto,
  titleFont: { family: FONTE, size: 12, weight: 500 },
  bodyFont: { family: FONTE, size: 15, weight: 700 },
  footerFont: { family: FONTE, size: 12, weight: 500 },
  padding: 12,
  cornerRadius: 12,
  displayColors: false,
  caretPadding: 8,
  caretSize: 6,
})

// Gráfico do Chart.js. `dados` e `opcoes` devem vir de um useMemo, para o gráfico só se
// atualizar quando mudam. É criado uma vez e depois só atualizado, para as transições ficarem suaves.
export default function Grafico({ tipo, dados, opcoes, altura = 220, descricao }) {
  const refCanvas = useRef(null)
  const refGrafico = useRef(null)

  useEffect(() => {
    const grafico = refGrafico.current
    if (grafico && grafico.config.type === tipo) {
      grafico.data = dados
      grafico.options = opcoes
      grafico.update()
      return
    }
    grafico?.destroy()
    refGrafico.current = new Chart(refCanvas.current, { type: tipo, data: dados, options: opcoes })
  }, [tipo, dados, opcoes])

  // Liberta o gráfico quando o componente desaparece
  useEffect(
    () => () => {
      refGrafico.current?.destroy()
      refGrafico.current = null
    },
    []
  )

  return (
    <div className="grafico" style={{ height: altura }}>
      <canvas ref={refCanvas} role="img" aria-label={descricao} />
    </div>
  )
}
