// Cores do tema para os gráficos (as mesmas das variáveis CSS em src/index.css)
export const CORES = {
  verde: '#5ce65c',
  verdeSuave: 'rgba(92, 230, 92, 0.25)',
  texto: '#f2f2f2',
  textoSuave: '#9a9a9a',
  borda: '#2c2c2c',
  grelha: 'rgba(255, 255, 255, 0.06)',
  recorde: '#ffd43b',
}

export const FONTE = "'Inter Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

// Preenchimento em degradê verde (forte em cima, transparente em baixo) para os gráficos de linhas.
// Usa-se como backgroundColor de um dataset com fill: true.
export function degradeVerde({ chart }) {
  const { ctx, chartArea } = chart
  if (!chartArea) return 'transparent' // ainda sem tamanho (primeiro desenho)
  const degrade = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  degrade.addColorStop(0, 'rgba(92, 230, 92, 0.32)')
  degrade.addColorStop(1, 'rgba(92, 230, 92, 0)')
  return degrade
}
