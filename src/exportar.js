import { exportarTodosOsDados } from './consultas'
import { chaveDia } from './formatar'

// Descarrega um ficheiro JSON com todos os dados do utilizador (workout-backup-2026-10-18.json).
// Devolve { erro } ou { nome, tabelas }.
export async function exportarParaFicheiro() {
  const resultado = await exportarTodosOsDados()
  if (resultado.erro) return { erro: resultado.erro }

  const nome = `workout-backup-${chaveDia(new Date())}.json`
  const ficheiro = new Blob([JSON.stringify(resultado.dados, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(ficheiro)
  const ligacao = document.createElement('a')
  ligacao.href = url
  ligacao.download = nome
  document.body.appendChild(ligacao)
  ligacao.click()
  ligacao.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)

  return { nome, tabelas: resultado.dados.tabelas }
}
