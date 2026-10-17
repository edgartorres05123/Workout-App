// Regras dos treinos organizados em blocos (aquecimento, série e super série).
// Funções puras, para poderem ser testadas. Um treino tem:
//   blocos: [{ id, ordem, tipo, voltas, notas, bloco_exercicios: [{ id, ordem, exercicio_id, reps_alvo, peso_alvo, exercicios }] }]
//   series: [{ id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios }]
// A coluna series.aquecimento é mantida pela base de dados (trigger) igual ao tipo do bloco.
import { calcularVolume, lerNumero, pesoParaInput } from './formatar'

export const TIPOS_BLOCO = [
  { id: 'aquecimento', nome: 'Aquecimento', descricao: 'Um ou mais exercícios para aquecer. Não contam para o volume nem para os recordes.' },
  { id: 'serie', nome: 'Série', descricao: 'Um exercício repetido várias voltas.' },
  { id: 'superserie', nome: 'Super série', descricao: 'Dois ou mais exercícios feitos seguidos, repetidos várias voltas.' },
]
export const NOME_TIPO = Object.fromEntries(TIPOS_BLOCO.map((t) => [t.id, t.nome]))

// Voltas e reps-alvo com que um bloco novo começa
export const VOLTAS_INICIAIS = { aquecimento: 2, serie: 3, superserie: 3 }
export const REPS_ALVO_INICIAIS = 10

const porOrdem = (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || Number(a.id) - Number(b.id)

// Cópia do treino com os blocos, os exercícios dos blocos e as séries ordenados
export function normalizarTreino(treino) {
  return {
    ...treino,
    blocos: [...(treino.blocos ?? [])]
      .map((b) => ({ ...b, bloco_exercicios: [...(b.bloco_exercicios ?? [])].sort(porOrdem) }))
      .sort(porOrdem),
    series: [...(treino.series ?? [])].sort(porOrdem),
  }
}

// ---------- Nomes ----------

// Número de cada bloco (null para os de aquecimento, que não são numerados), pela ordem dada
export function numerarBlocos(blocos) {
  let contador = 0
  return blocos.map((b) => (b.tipo === 'aquecimento' ? null : ++contador))
}

// "Bloco 2 · Super série · 3×" ou "Aquecimento · 2×"
export function tituloBloco(bloco, numero) {
  const voltas = `${bloco.voltas}×`
  if (bloco.tipo === 'aquecimento' || numero === null) return `${NOME_TIPO[bloco.tipo] ?? 'Bloco'} · ${voltas}`
  return `Bloco ${numero} · ${NOME_TIPO[bloco.tipo]} · ${voltas}`
}

// Letra de cada exercício dentro do bloco (A, B, C…)
export const letraExercicio = (indice) => String.fromCharCode(65 + indice)

// ---------- Tipo e número de exercícios ----------

// Se um tipo pode ser escolhido com este número de exercícios: null se pode, ou o motivo
export function motivoTipoIndisponivel(tipo, numExercicios) {
  if (tipo === 'serie' && numExercicios > 1) {
    return 'Uma série tem um só exercício. Remove os outros primeiro ou escolhe Super série.'
  }
  return null
}

// O tipo que o bloco deve ter depois de mudar o número de exercícios:
// uma série com 2 ou mais exercícios passa a super série, e uma super série com 1 passa a série
export function tipoAposMudarExercicios(tipo, numExercicios) {
  if (tipo === 'serie' && numExercicios >= 2) return 'superserie'
  if (tipo === 'superserie' && numExercicios === 1) return 'serie'
  return tipo
}

// Quantos exercícios o tipo precisa, no mínimo, para o bloco poder ser criado
export const MINIMO_EXERCICIOS = { aquecimento: 1, serie: 1, superserie: 2 }

// ---------- Voltas ----------

// As voltas de um bloco: [{ volta, feita, series: Map(exercicio_id → série) }].
// Mostra pelo menos `bloco.voltas` voltas (ou mais, se houver séries numa volta acima disso).
export function estadoVoltas(bloco, seriesDoBloco) {
  const maxima = Math.max(bloco.voltas, ...seriesDoBloco.map((s) => s.volta ?? 0))
  return Array.from({ length: maxima }, (_, i) => {
    const volta = i + 1
    const series = new Map(seriesDoBloco.filter((s) => s.volta === volta).map((s) => [s.exercicio_id, s]))
    return { volta, feita: series.size > 0, series }
  })
}

// Valores sugeridos para um exercício numa volta ainda por fazer: { reps, kg } (texto para os campos).
// Reps: o alvo. Peso: o da volta anterior deste exercício neste bloco (reflete o que estou a fazer hoje),
// senão o peso-alvo, senão o da última vez que fiz este exercício.
export function sugestaoVolta(blocoExercicio, volta, seriesDoBloco, ultimaVez = null) {
  const anterior = seriesDoBloco
    .filter((s) => s.exercicio_id === blocoExercicio.exercicio_id && s.volta < volta)
    .sort((a, b) => b.volta - a.volta)[0]
  const peso = anterior?.peso_kg ?? blocoExercicio.peso_alvo ?? ultimaVez?.peso_kg ?? null
  return {
    reps: blocoExercicio.reps_alvo ? String(blocoExercicio.reps_alvo) : '',
    kg: peso === null || peso === undefined ? '' : pesoParaInput(peso),
  }
}

// Valida os campos de uma volta: linhas = [{ exercicio_id, reps, kg }] (texto).
// As reps vazias saltam o exercício; o peso vazio conta como 0 kg (peso do corpo).
// Devolve { series: [{ exercicio_id, repeticoes, peso_kg }] } ou { erro }.
export function validarVolta(linhas) {
  const series = []
  for (const linha of linhas) {
    const reps = String(linha.reps ?? '').trim()
    if (reps === '') continue
    const repeticoes = Number(reps)
    if (!Number.isInteger(repeticoes) || repeticoes <= 0 || repeticoes > 1000) {
      return { erro: 'As reps têm de ser um número inteiro maior do que 0.' }
    }
    const textoKg = String(linha.kg ?? '').trim()
    const peso = textoKg === '' ? 0 : lerNumero(textoKg)
    if (peso === null || peso < 0 || peso > 9999.99) return { erro: 'Indica um peso válido (por exemplo, 62,5).' }
    series.push({ exercicio_id: linha.exercicio_id, repeticoes, peso_kg: Math.round(peso * 100) / 100 })
  }
  if (series.length === 0) return { erro: 'Preenche as reps de pelo menos um exercício.' }
  return { series }
}

// Ordem para a próxima série do treino (as estatísticas ordenam as séries por este campo)
export function proximaOrdemSerie(series) {
  return series.reduce((maior, s) => Math.max(maior, s.ordem ?? 0), 0) + 1
}

// ---------- Ordem ----------

// Move o elemento `indice` uma posição (direcao -1 = para cima, +1 = para baixo).
// Devolve { lista, alteracoes: [{ id, ordem }] } com as ordens renumeradas a partir de 1,
// ou null se não for possível mover.
export function reordenar(lista, indice, direcao) {
  const destino = indice + direcao
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return null
  const nova = [...lista]
  ;[nova[indice], nova[destino]] = [nova[destino], nova[indice]]
  const renumerada = nova.map((item, i) => ({ ...item, ordem: i + 1 }))
  const alteracoes = renumerada
    .filter((item, i) => item.ordem !== nova[i].ordem)
    .map(({ id, ordem }) => ({ id, ordem }))
  return { lista: renumerada, alteracoes }
}

export function proximaOrdem(lista) {
  return lista.reduce((maior, item) => Math.max(maior, item.ordem ?? 0), 0) + 1
}

// ---------- Copiar a estrutura de um treino anterior ----------

// Os blocos, os exercícios, as voltas e os alvos de um treino, sem as séries feitas:
// [{ ordem, tipo, voltas, notas, exercicios: [{ ordem, exercicio_id, reps_alvo, peso_alvo }] }]
export function estruturaParaCopiar(treino) {
  return normalizarTreino(treino).blocos
    .filter((b) => b.bloco_exercicios.length > 0)
    .map((b, i) => ({
      ordem: i + 1,
      tipo: b.tipo,
      voltas: b.voltas,
      notas: b.notas ?? null,
      exercicios: b.bloco_exercicios.map((be, j) => ({
        ordem: j + 1,
        exercicio_id: be.exercicio_id,
        reps_alvo: be.reps_alvo,
        peso_alvo: be.peso_alvo ?? null,
      })),
    }))
}

// Resumo curto da estrutura de um treino: "Aquecimento, Supino + Remada, Elevações"
export function resumoEstrutura(treino) {
  return normalizarTreino(treino)
    .blocos.map((b) =>
      b.tipo === 'aquecimento'
        ? 'Aquecimento'
        : b.bloco_exercicios.map((be) => be.exercicios?.nome ?? '?').join(' + ')
    )
    .filter(Boolean)
    .join(', ')
}

// ---------- Resumo do treino ----------

export function contarSeriesNormais(series) {
  return series.filter((s) => !s.aquecimento).length
}

// Resumo mostrado ao terminar ou registar um treino (o volume e as séries sem aquecimento)
export function resumoTreino(series, duracao) {
  return {
    duracao,
    volume: calcularVolume(series),
    numSeries: contarSeriesNormais(series),
    numExercicios: new Set(series.map((s) => s.exercicio_id)).size,
  }
}
