import { useEffect, useRef } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js'
import { CORES } from './cores'

// Só as peças do Chart.js que a app usa (barras, linhas e radar), para o código ficar leve
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip
)

Chart.defaults.color = CORES.textoSuave
Chart.defaults.borderColor = CORES.borda
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.font.size = 12
Chart.defaults.maintainAspectRatio = false
Chart.defaults.animation.duration = 300
Object.assign(Chart.defaults.plugins.tooltip, {
  backgroundColor: 'rgba(10, 10, 10, 0.95)',
  borderColor: CORES.borda,
  borderWidth: 1,
  titleColor: CORES.textoSuave,
  bodyColor: CORES.texto,
  titleFont: { size: 13, weight: 'normal' },
  bodyFont: { size: 15, weight: 'bold' },
  padding: 10,
  cornerRadius: 10,
  displayColors: false,
  caretPadding: 8,
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
