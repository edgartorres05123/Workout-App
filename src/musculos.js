// Lista fixa de músculos. O id (minúsculas, sem acentos) é o que fica gravado em
// exercicio_musculos.musculo; o nome é o que aparece na interface.
export const MUSCULOS = [
  { id: 'peito', nome: 'Peito' },
  { id: 'costas', nome: 'Costas' },
  { id: 'ombros', nome: 'Ombros' },
  { id: 'biceps', nome: 'Bíceps' },
  { id: 'triceps', nome: 'Tríceps' },
  { id: 'antebracos', nome: 'Antebraços' },
  { id: 'abdominais', nome: 'Abdominais' },
  { id: 'lombar', nome: 'Lombar' },
  { id: 'trapezio', nome: 'Trapézio' },
  { id: 'quadriceps', nome: 'Quadríceps' },
  { id: 'isquiotibiais', nome: 'Isquiotibiais' },
  { id: 'gluteos', nome: 'Glúteos' },
  { id: 'gemeos', nome: 'Gémeos' },
]

const ORDEM = new Map(MUSCULOS.map((m, i) => [m.id, i]))

export function nomeMusculo(id) {
  return MUSCULOS[ORDEM.get(id)]?.nome ?? id
}

// Ordena linhas de exercicio_musculos ({ musculo, principal }): principais primeiro, depois pela ordem fixa
export function ordenarMusculos(linhas = []) {
  return [...linhas].sort(
    (a, b) =>
      Number(b.principal) - Number(a.principal) ||
      (ORDEM.get(a.musculo) ?? 99) - (ORDEM.get(b.musculo) ?? 99)
  )
}

// Ciclo ao tocar: nenhum → principal → secundário → nenhum
export function proximoEstado(estado) {
  if (estado === 'principal') return 'secundario'
  if (estado === 'secundario') return null
  return 'principal'
}
