// Regras dos treinos organizados em blocos (aquecimento, série e super série).
// Funções puras, para poderem ser testadas. Um treino tem:
//   blocos: [{ id, ordem, tipo, voltas, notas, bloco_exercicios: [{ id, ordem, exercicio_id, reps_alvo, peso_alvo, exercicios }] }]
//   series: [{ id, bloco_id, volta, exercicio_id, ordem, repeticoes, peso_kg, aquecimento, exercicios }]
// A coluna series.aquecimento é mantida pela base de dados (trigger) igual ao tipo do bloco.
// Os blocos de condicionamento (circuito, amrap, emom) têm ainda duracao_seg, intervalo_seg e tempo_seg,
// e os exercícios podem ser por tempo (segundos_alvo); ver condicionamento.js.
import {
  DURACAO_AMRAP_INICIAL,
  INTERVALO_EMOM_INICIAL,
  exercicioPorTempo,
  formatarTempo,
  resultadoAmrap,
  resultadoEmom,
  textoResultadoAmrap,
  textoSegundos,
} from './condicionamento'
import { nomeAtividade } from './atividades'
import { calcularVolume, lerNumero, pesoParaInput } from './formatar'

// Os tipos de bloco com exercícios, por grupo ('forca' ou 'condicionamento'). O tipo 'cardio' é à parte:
// em vez de exercícios tem uma atividade (corrida, natação...) com intervalos em atividades_cardio.
export const TIPOS_BLOCO = [
  { id: 'aquecimento', grupo: 'forca', nome: 'Aquecimento', descricao: 'Um ou mais exercícios para aquecer. Não contam para o volume nem para os recordes.' },
  { id: 'serie', grupo: 'forca', nome: 'Série', descricao: 'Um exercício repetido várias voltas.' },
  { id: 'superserie', grupo: 'forca', nome: 'Super série', descricao: 'Dois ou mais exercícios feitos seguidos, repetidos várias voltas.' },
  { id: 'circuito', grupo: 'condicionamento', nome: 'Circuito', descricao: 'Vários exercícios seguidos, N voltas. Opcional: por tempo, com cronómetro.' },
  { id: 'amrap', grupo: 'condicionamento', nome: 'AMRAP', descricao: 'O máximo de voltas possível num tempo limite.' },
  { id: 'emom', grupo: 'condicionamento', nome: 'EMOM', descricao: 'No início de cada minuto (ou intervalo), um exercício; o resto do tempo é descanso.' },
]
export const GRUPOS_BLOCO = [
  { id: 'forca', nome: 'Força' },
  { id: 'condicionamento', nome: 'Condicionamento' },
]
export const NOME_TIPO = { ...Object.fromEntries(TIPOS_BLOCO.map((t) => [t.id, t.nome])), cardio: 'Cardio' }

// As linhas de cardio de um bloco, pelo número do intervalo
export const linhasCardio = (bloco) =>
  [...(bloco.atividades_cardio ?? [])].sort((a, b) => (a.volta ?? 1) - (b.volta ?? 1) || Number(a.id) - Number(b.id))

// A atividade de um bloco de cardio (a do 1.º intervalo), ou null
export const atividadeDoBloco = (bloco) => linhasCardio(bloco)[0]?.atividade ?? null

// Voltas e reps-alvo com que um bloco novo começa (no AMRAP, as voltas são o resultado; no EMOM, os intervalos)
export const VOLTAS_INICIAIS = { aquecimento: 2, serie: 3, superserie: 3, circuito: 3, amrap: 1, emom: 10 }
export const REPS_ALVO_INICIAIS = 10

// Os campos com que um bloco novo deste tipo começa: { voltas, duracao_seg, intervalo_seg }
export function camposIniciais(tipo) {
  return {
    voltas: VOLTAS_INICIAIS[tipo] ?? 3,
    duracao_seg: tipo === 'amrap' ? DURACAO_AMRAP_INICIAL : null,
    intervalo_seg: tipo === 'emom' ? INTERVALO_EMOM_INICIAL : null,
  }
}

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

// O nome do tipo com a configuração: "Super série · 3×", "Circuito · 3× · 12:34" (tempo feito),
// "AMRAP 12 min · 7 voltas + 5 reps", "EMOM 12 min · 10/12 intervalos". series: as do bloco (para os
// resultados do AMRAP e do EMOM); sem elas, só a configuração.
function descricaoBloco(bloco, series) {
  if (bloco.tipo === 'cardio') {
    const n = linhasCardio(bloco).length
    const nome = atividadeDoBloco(bloco) ? nomeAtividade(atividadeDoBloco(bloco)) : 'Cardio'
    return n > 1 ? `${nome} · ${n} intervalos` : nome
  }
  const feitas = series?.length > 0
  if (bloco.tipo === 'amrap') {
    const resultado = feitas ? resultadoAmrap(bloco, series) : null
    const base = `AMRAP ${textoSegundos(bloco.duracao_seg ?? DURACAO_AMRAP_INICIAL)}`
    return resultado ? `${base} · ${textoResultadoAmrap(resultado)}` : base
  }
  if (bloco.tipo === 'emom') {
    const intervalo = bloco.intervalo_seg ?? INTERVALO_EMOM_INICIAL
    const base = intervalo === 60 ? `EMOM ${bloco.voltas} min` : `EMOM ${bloco.voltas} × ${textoSegundos(intervalo)}`
    if (!feitas) return base
    const { feitos, total } = resultadoEmom(bloco, series)
    return `${base} · ${feitos}/${total} intervalos`
  }
  const base = `${NOME_TIPO[bloco.tipo] ?? 'Bloco'} · ${bloco.voltas}×`
  return bloco.tipo === 'circuito' && bloco.tempo_seg ? `${base} · ${formatarTempo(bloco.tempo_seg)}` : base
}

// "Bloco 2 · Super série · 3×" ou "Aquecimento · 2×" (ver descricaoBloco)
export function tituloBloco(bloco, numero, series = null) {
  const descricao = descricaoBloco(bloco, series)
  if (bloco.tipo === 'aquecimento' || numero === null) return descricao
  return `Bloco ${numero} · ${descricao}`
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
export const MINIMO_EXERCICIOS = { aquecimento: 1, serie: 1, superserie: 2, circuito: 1, amrap: 1, emom: 1 }

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
// Nos exercícios por tempo há também { segundos }: os da volta anterior, senão os segundos-alvo.
export function sugestaoVolta(blocoExercicio, volta, seriesDoBloco, ultimaVez = null) {
  const anterior = seriesDoBloco
    .filter((s) => s.exercicio_id === blocoExercicio.exercicio_id && s.volta < volta)
    .sort((a, b) => b.volta - a.volta)[0]
  const peso = anterior?.peso_kg ?? blocoExercicio.peso_alvo ?? ultimaVez?.peso_kg ?? null
  const sugestao = {
    reps: blocoExercicio.reps_alvo ? String(blocoExercicio.reps_alvo) : '',
    kg: peso === null || peso === undefined ? '' : pesoParaInput(peso),
  }
  if (exercicioPorTempo(blocoExercicio)) {
    sugestao.segundos = String(anterior?.duracao_seg || blocoExercicio.segundos_alvo)
  }
  return sugestao
}

// Valida os campos de uma volta: linhas = [{ exercicio_id, reps, kg, pesoCorporal?, pesoCorporalKg?,
// porTempo?, segundos? }] (reps, segundos e kg em texto). As reps vazias saltam o exercício; o peso vazio
// conta como 0 kg. Nos exercícios por tempo (porTempo: true) contam os segundos: a série fica com
// repeticoes = 0 e duracao_seg = segundos.
// Nos exercícios de peso corporal (pesoCorporal: true), kg é o PESO EXTRA e pode ser negativo
// (assistido); com o peso do corpo conhecido (pesoCorporalKg), corpo + extra tem de ser maior que 0.
// Devolve { series: [{ exercicio_id, repeticoes, peso_kg, duracao_seg? }] } ou { erro }.
export function validarVolta(linhas) {
  const series = []
  for (const linha of linhas) {
    const texto = String((linha.porTempo ? linha.segundos : linha.reps) ?? '').trim()
    if (texto === '') continue
    const numero = Number(texto)
    if (linha.porTempo && (!Number.isInteger(numero) || numero <= 0 || numero > 36000)) {
      return { erro: 'Os segundos têm de ser um número inteiro maior do que 0.' }
    }
    if (!linha.porTempo && (!Number.isInteger(numero) || numero <= 0 || numero > 1000)) {
      return { erro: 'As reps têm de ser um número inteiro maior do que 0.' }
    }
    const repeticoes = linha.porTempo ? 0 : numero
    const textoKg = String(linha.kg ?? '').trim()
    const peso = textoKg === '' ? 0 : lerNumero(textoKg)
    const minimo = linha.pesoCorporal ? -9999.99 : 0
    if (peso === null || peso < minimo || peso > 9999.99) {
      return {
        erro: linha.pesoCorporal
          ? 'Indica o peso extra em kg (por exemplo, 10, ou −20 se for assistido).'
          : 'Indica um peso válido (por exemplo, 62,5).',
      }
    }
    const corpo = linha.pesoCorporalKg
    if (linha.pesoCorporal && corpo !== null && corpo !== undefined && Number(corpo) + peso <= 0) {
      return { erro: 'O peso efetivo (corpo + extra) tem de ser maior do que 0.' }
    }
    const serie = { exercicio_id: linha.exercicio_id, repeticoes, peso_kg: Math.round(peso * 100) / 100 }
    if (linha.porTempo) serie.duracao_seg = numero
    series.push(serie)
  }
  if (series.length === 0) return { erro: 'Preenche as reps (ou os segundos) de pelo menos um exercício.' }
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
// [{ ordem, tipo, voltas, notas, duracao_seg, intervalo_seg,
//    exercicios: [{ ordem, exercicio_id, reps_alvo, peso_alvo, segundos_alvo }] }]
// O tempo_seg (resultado de um circuito) não se copia; no AMRAP as voltas são o resultado: voltam a 1.
// Os blocos de cardio levam a atividade de cada intervalo, sem os valores feitos:
// atividades: [{ volta, atividade }] (e exercicios: []).
export function estruturaParaCopiar(treino) {
  return normalizarTreino(treino).blocos
    .filter((b) => b.bloco_exercicios.length > 0 || (b.tipo === 'cardio' && linhasCardio(b).length > 0))
    .map((b, i) => ({
      ordem: i + 1,
      tipo: b.tipo,
      voltas: b.tipo === 'amrap' ? 1 : b.voltas,
      notas: b.notas ?? null,
      duracao_seg: b.duracao_seg ?? null,
      intervalo_seg: b.intervalo_seg ?? null,
      exercicios: b.bloco_exercicios.map((be, j) => ({
        ordem: j + 1,
        exercicio_id: be.exercicio_id,
        reps_alvo: be.reps_alvo,
        peso_alvo: be.peso_alvo ?? null,
        segundos_alvo: be.segundos_alvo ?? null,
      })),
      ...(b.tipo === 'cardio'
        ? { voltas: 1, atividades: linhasCardio(b).map((l, j) => ({ volta: j + 1, atividade: l.atividade })) }
        : {}),
    }))
}

// Resumo curto da estrutura de um treino: "Aquecimento, Supino + Remada, Elevações"
export function resumoEstrutura(treino) {
  return normalizarTreino(treino)
    .blocos.map((b) =>
      b.tipo === 'aquecimento'
        ? 'Aquecimento'
        : b.tipo === 'cardio'
          ? atividadeDoBloco(b) && nomeAtividade(atividadeDoBloco(b))
          : b.bloco_exercicios.map((be) => be.exercicios?.nome ?? '?').join(' + ')
    )
    .filter(Boolean)
    .join(', ')
}

// Os nomes num bloco: os dos exercícios, ou o da atividade num bloco de cardio
function nomesDoBloco(bloco) {
  if (bloco.tipo === 'cardio') return atividadeDoBloco(bloco) ? [nomeAtividade(atividadeDoBloco(bloco))] : []
  return bloco.bloco_exercicios.map((be) => be.exercicios?.nome).filter(Boolean)
}

// Os nomes dos exercícios da estrutura de um treino, pela ordem e sem repetir:
// "Supino plano, Remada +2" (até `maximo` nomes; resto = quantos ficaram de fora)
export function exerciciosDaEstrutura(treino, maximo = 3) {
  const nomes = [...new Set(normalizarTreino(treino).blocos.flatMap(nomesDoBloco))]
  return { nomes: nomes.slice(0, maximo), resto: Math.max(0, nomes.length - maximo), total: nomes.length }
}

// Nome sugerido para guardar um treino nos favoritos, a partir dos exercícios (sem os do
// aquecimento, se houver outros): "Supino plano, Remada +2". Sem exercícios: "Treino favorito".
export function sugerirNomeFavorito(treino, maximo = 2) {
  const { blocos } = normalizarTreino(treino)
  const deBlocos = (lista) => lista.flatMap(nomesDoBloco)
  const principais = deBlocos(blocos.filter((b) => b.tipo !== 'aquecimento'))
  const nomes = [...new Set(principais.length > 0 ? principais : deBlocos(blocos))]
  if (nomes.length === 0) return 'Treino favorito'
  const resto = nomes.length - maximo
  return `${nomes.slice(0, maximo).join(', ')}${resto > 0 ? ` +${resto}` : ''}`
}

// ---------- Resumo do treino ----------

export function contarSeriesNormais(series) {
  return series.filter((s) => !s.aquecimento).length
}

// Voltas feitas sobre o total, para a barra de progresso (só blocos com exercícios): { feitas, total }
export function progressoVoltas(treino) {
  const { blocos, series } = normalizarTreino(treino)
  let feitas = 0
  let total = 0
  for (const bloco of blocos) {
    if (bloco.tipo === 'cardio') {
      // No cardio, cada intervalo conta como uma volta (feito quando tem duração)
      const linhas = linhasCardio(bloco)
      total += linhas.length
      feitas += linhas.filter((l) => Number(l.duracao_seg) > 0).length
      continue
    }
    if (bloco.bloco_exercicios.length === 0) continue
    const voltas = estadoVoltas(bloco, series.filter((s) => s.bloco_id === bloco.id))
    total += voltas.length
    feitas += voltas.filter((v) => v.feita).length
  }
  return { feitas, total }
}

// Resumo mostrado ao terminar ou registar um treino (o volume e as séries sem aquecimento)
// carga(serie): a carga efetiva de cada série (por omissão, o peso gravado)
export function resumoTreino(series, duracao, carga = undefined) {
  return {
    duracao,
    volume: calcularVolume(series, carga),
    numSeries: contarSeriesNormais(series),
    numExercicios: new Set(series.map((s) => s.exercicio_id)).size,
  }
}
