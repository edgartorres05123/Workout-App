// Estimativa CONSERVADORA das calorias gastas num treino (nunca sobrestimar). Funções puras.
//
// O QUE SE CONTA: calorias LÍQUIDAS, só o que o exercício gasta além do repouso. Em todos os cálculos
// subtrai-se o gasto em repouso durante esse tempo: 1 MET = 3,5 ml O2/kg/min.
//
// CONVERSÃO: kcal = MET × kg × horas (1 kcal/kg/h por MET). É a conversão mais conservadora (com
// 3,5 ml O2/kg/min e 5 kcal por litro de O2, 1 MET daria 1,05 kcal/kg/h).
//
// CORRIDA E CAMINHADA — equações metabólicas do ACSM (ACSM's Guidelines for Exercise Testing and
// Prescription), com v em m/min e a inclinação em fração (5% = 0,05; as descidas contam como 0):
//   corrida:   VO2 = 0,2 × v + 0,9 × v × inclinação + 3,5
//   caminhada: VO2 = 0,1 × v + 1,8 × v × inclinação + 3,5
//   MET líquido = (VO2 − 3,5) / 3,5
// A velocidade vem do campo, ou da distância e da duração. Só com a duração, usa-se o MET da atividade
// (atividades.js) pela intensidade indicada (por omissão "leve"), menos 1 MET de repouso.
//
// OUTRAS ATIVIDADES — MET do Compendium of Physical Activities (Ainsworth et al., 2011; Herrmann et al.,
// 2024), guardados em atividades.js por intensidade (os valores mais baixos de cada faixa), menos 1 MET.
//
// FREQUÊNCIA CARDÍACA — com fc_media num intervalo de cardio e a idade e o sexo no perfil, calcula-se
// também pela fórmula de Keytel et al. (2005), J Sports Sci 23(3):289-97 (kJ/min, ÷ 4,184 para kcal/min):
//   homens:   (−55,0969 + 0,6309 × FC + 0,1988 × kg + 0,2017 × idade) / 4,184
//   mulheres: (−20,4022 + 0,4472 × FC − 0,1263 × kg + 0,0740 × idade) / 4,184
// O valor de Keytel é bruto: tira-se o repouso (1 MET) e fica-se com o MENOR dos dois cálculos.
//
// MUSCULAÇÃO (aquecimento, série, super série) — Compendium, código 02054, "resistance (weight)
// training, multiple exercises, 8-15 reps at varied resistance": 3,5 MET (o mais baixo das opções de
// treino de força; 02050 "vigorous" é 6,0). Líquido: 2,5 MET. Aplica-se ao "tempo de força": a duração
// do treino menos o tempo dos blocos com tempo próprio (cardio, AMRAP, EMOM, circuitos), e só se houver
// séries de força feitas.
//
// CIRCUITO, AMRAP E EMOM — Compendium, código 02045, "circuit training, moderate effort": 4,3 MET
// (02040, "vigorous", é 8,0). Líquido: 3,3 MET. Tempo do bloco: AMRAP = duracao_seg; EMOM = voltas ×
// intervalo_seg; circuito = tempo_seg ou, sem ele, 30 s por série feita (os exercícios por tempo contam
// os seus segundos). Só os blocos com séries feitas contam.
//
// LIMITES — a soma dos tempos dos blocos nunca passa a duração do treino: se passar, reduz-se primeiro a
// força e, se ainda passar, os outros blocos na mesma proporção. Sem peso corporal conhecido, não há
// estimativa. O total arredonda-se SEMPRE para baixo, a múltiplos de 5 kcal. Se o treino tiver
// calorias_kcal (escritas à mão, por exemplo do relógio), é esse o valor.
import { obterAtividade } from './atividades'
import { linhaFeita } from './cardio'
import { formatarPeso } from './formatar'

export const EXPLICACAO_CALORIAS =
  'Estimativa conservadora das calorias gastas pelo exercício, além do que o corpo gastaria em repouso.'

// "≈ 180 kcal", "180 kcal" (do relógio) ou "—" (sem peso)
export function textoKcal(resultado) {
  if (resultado.kcal === null) return '—'
  return resultado.origem === 'relogio' ? `${formatarPeso(resultado.kcal)} kcal` : `≈ ${formatarPeso(resultado.kcal)} kcal`
}

export const MET_FORCA = 3.5 // Compendium 02054
export const MET_CIRCUITO = 4.3 // Compendium 02045
export const SEGUNDOS_POR_SERIE_CIRCUITO = 30
const TIPOS_FORCA = ['aquecimento', 'serie', 'superserie']

// kcal = MET líquido × kg × horas (nunca negativo)
export const kcalDeMet = (metLiquido, pesoKg, segundos) => Math.max(0, metLiquido) * pesoKg * (segundos / 3600)

// Arredonda para baixo, a múltiplos de 5
export const arredondarKcal = (kcal) => Math.max(0, Math.floor(kcal / 5) * 5)

// ---------- Cardio ----------

// MET líquido das equações do ACSM (corrida ou caminhada); null sem velocidade
export function metLiquidoAcsm(calculo, velocidadeKmh, inclinacaoPct = 0) {
  if (!(velocidadeKmh > 0)) return null
  const v = (velocidadeKmh * 1000) / 60 // m/min
  const inclinacao = Math.max(0, Number(inclinacaoPct) || 0) / 100
  const liquido = calculo === 'acsm_corrida' ? 0.2 * v + 0.9 * v * inclinacao : 0.1 * v + 1.8 * v * inclinacao
  return liquido / 3.5
}

// kcal/min BRUTAS pela fórmula de Keytel; null sem FC, idade ou sexo
export function kcalPorMinutoKeytel(fc, pesoKg, idade, sexo) {
  if (!(fc > 0) || !(idade > 0) || !['masculino', 'feminino'].includes(sexo)) return null
  const kj =
    sexo === 'masculino'
      ? -55.0969 + 0.6309 * fc + 0.1988 * pesoKg + 0.2017 * idade
      : -20.4022 + 0.4472 * fc - 0.1263 * pesoKg + 0.074 * idade
  return Math.max(0, kj / 4.184)
}

// Um intervalo de cardio feito: { kcal (sem arredondar), metodo: 'acsm' | 'met' | 'fc' }
export function kcalIntervaloCardio(linha, { pesoKg, idade = null, sexo = null }) {
  const atividade = obterAtividade(linha.atividade)
  const segundos = Number(linha.duracao_seg)
  let velocidade = Number(linha.velocidade_kmh) || null
  if (!velocidade && linha.distancia_m > 0) velocidade = linha.distancia_m / 1000 / (segundos / 3600)

  let metLiquido = null
  let metodo = 'met'
  if (atividade.calculo !== 'met') {
    metLiquido = metLiquidoAcsm(atividade.calculo, velocidade, linha.inclinacao_pct)
    if (metLiquido !== null) metodo = 'acsm'
  }
  if (metLiquido === null) metLiquido = atividade.met[linha.intensidade ?? 'leve'] - 1
  let kcal = kcalDeMet(metLiquido, pesoKg, segundos)

  // Com a FC (e a idade e o sexo), fica o menor dos dois
  const porMinuto = kcalPorMinutoKeytel(Number(linha.fc_media), pesoKg, idade, sexo)
  if (porMinuto !== null) {
    const keytel = Math.max(0, porMinuto * (segundos / 60) - kcalDeMet(1, pesoKg, segundos))
    if (keytel < kcal) {
      kcal = keytel
      metodo = 'fc'
    }
  }
  return { kcal, metodo }
}

// ---------- Tempo dos blocos ----------

// Segundos de um bloco com tempo próprio (cardio, AMRAP, EMOM, circuito); 0 se não tiver nada feito.
// Os outros (força) devolvem null: usam o "tempo de força".
export function segundosDoBloco(bloco, seriesDoBloco) {
  if (bloco.tipo === 'cardio') {
    return (bloco.atividades_cardio ?? []).filter(linhaFeita).reduce((t, l) => t + Number(l.duracao_seg), 0)
  }
  if (!['amrap', 'emom', 'circuito'].includes(bloco.tipo)) return null
  const normais = seriesDoBloco.filter((s) => !s.aquecimento)
  if (normais.length === 0) return 0
  if (bloco.tipo === 'amrap') return Number(bloco.duracao_seg) || 0
  if (bloco.tipo === 'emom') return (Number(bloco.voltas) || 0) * (Number(bloco.intervalo_seg) || 60)
  if (bloco.tempo_seg) return Number(bloco.tempo_seg)
  return normais.reduce((t, s) => t + (Number(s.duracao_seg) > 0 ? Number(s.duracao_seg) : SEGUNDOS_POR_SERIE_CIRCUITO), 0)
}

// ---------- Treino ----------

// Estimativa de um treino. contexto: { pesoKg (null = desconhecido), idade, sexo, duracaoSeg (para um
// treino ao vivo; por omissão, duracao_min do treino) }.
// Devolve { kcal (múltiplo de 5, ou null), origem: 'relogio' | 'estimativa' | null, semPeso, partes }
// partes: [{ id, tipo, bloco (null na força), segundos, kcal (arredondadas para baixo) }]
export function estimarCalorias(treino, { pesoKg = null, idade = null, sexo = null, duracaoSeg = null } = {}) {
  const manual = treino.calorias_kcal
  if (manual !== null && manual !== undefined && manual !== '') {
    return { kcal: Math.max(0, Math.round(Number(manual))), origem: 'relogio', semPeso: false, partes: [] }
  }
  if (!(pesoKg > 0)) return { kcal: null, origem: null, semPeso: true, partes: [] }

  const total = Math.max(0, duracaoSeg ?? (Number(treino.duracao_min) || 0) * 60)
  const blocos = treino.blocos ?? []
  const series = treino.series ?? []
  const doBloco = (id) => series.filter((s) => s.bloco_id === id)

  // Os blocos com tempo próprio
  const proprios = []
  for (const bloco of blocos) {
    const segundos = segundosDoBloco(bloco, doBloco(bloco.id))
    if (segundos === null || segundos <= 0) continue
    let kcal
    if (bloco.tipo === 'cardio') {
      kcal = (bloco.atividades_cardio ?? [])
        .filter(linhaFeita)
        .reduce((t, l) => t + kcalIntervaloCardio(l, { pesoKg, idade, sexo }).kcal, 0)
    } else {
      kcal = kcalDeMet(MET_CIRCUITO - 1, pesoKg, segundos)
    }
    proprios.push({ id: `bloco-${bloco.id}`, tipo: bloco.tipo, bloco, segundos, kcal })
  }

  // A soma nunca passa a duração do treino: primeiro a força, depois os outros na mesma proporção
  const somaProprios = proprios.reduce((t, p) => t + p.segundos, 0)
  if (somaProprios > total && somaProprios > 0) {
    const fator = total / somaProprios
    for (const p of proprios) {
      p.segundos *= fator
      p.kcal *= fator
    }
  }

  // Força: o resto do tempo, só se houver séries de força feitas
  const temForca = blocos.some((b) => TIPOS_FORCA.includes(b.tipo) && doBloco(b.id).length > 0)
  const segundosForca = temForca ? Math.max(0, total - Math.min(total, somaProprios)) : 0
  const partes = []
  if (segundosForca > 0) {
    partes.push({ id: 'forca', tipo: 'forca', bloco: null, segundos: segundosForca, kcal: kcalDeMet(MET_FORCA - 1, pesoKg, segundosForca) })
  }
  partes.push(...proprios)

  const soma = partes.reduce((t, p) => t + p.kcal, 0)
  return {
    kcal: arredondarKcal(soma),
    origem: 'estimativa',
    semPeso: false,
    partes: partes.map((p) => ({ ...p, segundos: Math.round(p.segundos), kcal: arredondarKcal(p.kcal) })),
  }
}
