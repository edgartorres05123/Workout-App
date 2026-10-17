// Ajudas para animações e feedback físico

// true se o utilizador pediu para reduzir o movimento (nas definições do telemóvel)
export function reduzirMovimento() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Duração da animação de saída das janelas (igual à do CSS)
export const DURACAO_SAIDA_MS = 200

// Pequena vibração ao confirmar uma ação (só existe no Android; no iPhone não faz nada)
export function vibrar(ms = 30) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
}

// Pilha das janelas abertas: a tecla Esc fecha só a que está por cima
const pilha = []
export function abrirNaPilha(id) {
  pilha.push(id)
  return () => {
    const indice = pilha.lastIndexOf(id)
    if (indice !== -1) pilha.splice(indice, 1)
  }
}
export const estaNoTopo = (id) => pilha.at(-1) === id
