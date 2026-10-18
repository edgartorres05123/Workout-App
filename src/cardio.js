// Contas do cardio (atividades_cardio). Funções puras, para poderem ser testadas.
// Cada linha de atividades_cardio é um intervalo (volta 1, 2, 3...) de um bloco "cardio". Uma linha com
// duracao_seg = 0 ainda está por fazer (é só o plano: a atividade e o número do intervalo); as feitas
// têm duracao_seg > 0. Uma "sessão" é um bloco de cardio feito (a soma dos intervalos feitos).
// O cardio não tem séries: não entra no volume (kg), nos recordes de força nem nos músculos.
import { obterAtividade, nomeAtividade } from './atividades'
import { formatarTempo } from './condicionamento'
import { inicioSemana, somarDias } from './estatisticas'
import { chaveDia, formatarPeso, lerNumero } from './formatar'

const arredondar = (valor, casas) => Math.round(valor * 10 ** casas) / 10 ** casas

// ---------- Ler e escrever os campos ----------

// Duração escrita: "42:10" (mm:ss), "1:02:03" (h:mm:ss) ou só minutos ("45", "45,5"). Devolve segundos
// (inteiro > 0) ou null se for inválida.
export function lerDuracao(texto) {
  const limpo = String(texto ?? '').trim()
  if (limpo === '') return null
  if (limpo.includes(':')) {
    const partes = limpo.split(':').map((p) => p.trim())
    if (partes.length > 3 || partes.some((p) => !/^\d+$/.test(p))) return null
    const numeros = partes.map(Number)
    if (numeros.slice(1).some((n) => n >= 60)) return null
    const segundos = numeros.reduce((total, n) => total * 60 + n, 0)
    return segundos > 0 ? segundos : null
  }
  const minutos = lerNumero(limpo)
  if (minutos === null || minutos <= 0 || minutos > 24 * 60) return null
  return Math.round(minutos * 60)
}

export const textoDuracao = (segundos) => formatarTempo(segundos)

// Distância escrita, em km ou em m (conforme a atividade). Devolve metros ou null.
export function lerDistancia(texto, unidade = 'km') {
  const valor = lerNumero(String(texto ?? ''))
  if (valor === null || valor <= 0 || valor > 100000) return null
  return unidade === 'm' ? Math.round(valor) : Math.round(valor * 1000)
}

// Metros → texto para o campo ("8,2" em km; "400" em m)
export function distanciaParaCampo(metros, unidade = 'km') {
  if (metros === null || metros === undefined) return ''
  return unidade === 'm' ? String(Math.round(metros)) : String(arredondar(metros / 1000, 2)).replace('.', ',')
}

// "8,2 km", "400 m"
export function textoDistancia(metros, unidade = 'km') {
  return unidade === 'm' ? `${formatarPeso(Math.round(metros))} m` : `${formatarPeso(arredondar(metros / 1000, 2))} km`
}

// ---------- Duração, distância e velocidade: o 3.º a partir de 2 ----------

export const CAMPOS_CALCULAVEIS = ['duracao', 'distancia', 'velocidade']

// Qual dos três campos é calculado: o que não está entre os dois últimos escritos à mão
// (editados: os campos pela ordem em que foram escritos, o mais recente no fim). null se ainda não
// houver dois escritos.
export function campoCalculado(editados) {
  const ultimos = []
  for (let i = editados.length - 1; i >= 0 && ultimos.length < 2; i--) {
    if (!ultimos.includes(editados[i])) ultimos.push(editados[i])
  }
  if (ultimos.length < 2) return null
  return CAMPOS_CALCULAVEIS.find((c) => !ultimos.includes(c))
}

// Calcula um dos três a partir dos outros dois: { duracao_seg, distancia_m, velocidade_kmh }.
// Devolve o valor (segundos inteiros, metros inteiros ou km/h com 2 casas) ou null se faltar algum.
export function calcularTerceiro({ duracao_seg, distancia_m, velocidade_kmh }, campo) {
  const ok = (v) => v !== null && v !== undefined && Number(v) > 0
  if (campo === 'velocidade' && ok(duracao_seg) && ok(distancia_m)) {
    return arredondar(distancia_m / 1000 / (duracao_seg / 3600), 2)
  }
  if (campo === 'distancia' && ok(duracao_seg) && ok(velocidade_kmh)) {
    return Math.round(velocidade_kmh * (duracao_seg / 3600) * 1000)
  }
  if (campo === 'duracao' && ok(distancia_m) && ok(velocidade_kmh)) {
    return Math.round((distancia_m / 1000 / velocidade_kmh) * 3600)
  }
  return null
}

// ---------- Ritmo ----------

// Segundos por km (ou por 100 m, com por = 100); null sem distância ou duração
export function ritmo(duracaoSeg, distanciaM, por = 1000) {
  if (!(duracaoSeg > 0) || !(distanciaM > 0)) return null
  return (duracaoSeg / distanciaM) * por
}

// O ritmo para mostrar, conforme a atividade: "5:08 /km", "1:52 /100 m", "24,5 km/h" (ou null)
export function textoRitmo(atividadeId, duracaoSeg, distanciaM) {
  const tipo = obterAtividade(atividadeId).ritmo
  if (!tipo || !(duracaoSeg > 0) || !(distanciaM > 0)) return null
  if (tipo === 'kmh') return `${formatarPeso(arredondar(distanciaM / 1000 / (duracaoSeg / 3600), 1))} km/h`
  const segundos = Math.round(ritmo(duracaoSeg, distanciaM, tipo === '100m' ? 100 : 1000))
  return `${formatarTempo(segundos)} ${tipo === '100m' ? '/100 m' : '/km'}`
}

// ---------- Sessões ----------

export const linhaFeita = (linha) => Number(linha.duracao_seg) > 0

// Junta os intervalos feitos de cada bloco: [{ bloco_id, treino_id, data, atividade, duracao_seg,
// distancia_m (null se nenhum intervalo tiver distância), intervalos }], pela data.
// linhas: atividades_cardio com a data do treino (linha.data ou linha.treinos.data)
export function sessoesCardio(linhas) {
  const porBloco = new Map()
  for (const linha of linhas) {
    if (!linhaFeita(linha)) continue
    const sessao = porBloco.get(linha.bloco_id) ?? {
      bloco_id: linha.bloco_id,
      treino_id: linha.treino_id,
      data: linha.data ?? linha.treinos?.data,
      atividade: linha.atividade,
      duracao_seg: 0,
      distancia_m: null,
      intervalos: 0,
    }
    sessao.duracao_seg += Number(linha.duracao_seg)
    if (Number(linha.distancia_m) > 0) sessao.distancia_m = (sessao.distancia_m ?? 0) + Number(linha.distancia_m)
    sessao.intervalos += 1
    porBloco.set(linha.bloco_id, sessao)
  }
  return [...porBloco.values()].sort((a, b) => new Date(a.data) - new Date(b.data))
}

// As sessões de cardio de um treino (os blocos 'cardio' com as linhas aninhadas)
export function sessoesDoTreino(treino) {
  const linhas = (treino.blocos ?? [])
    .filter((b) => b.tipo === 'cardio')
    .flatMap((b) => (b.atividades_cardio ?? []).map((l) => ({ ...l, bloco_id: b.id, treino_id: treino.id, data: treino.data })))
  return sessoesCardio(linhas)
}

// "Corrida · 8,2 km · 42:10 · 5:08 /km" (só o que existir)
export function resumoSessao(sessao) {
  const atividade = obterAtividade(sessao.atividade)
  const partes = [atividade.nome]
  if (sessao.distancia_m) partes.push(textoDistancia(sessao.distancia_m, atividade.distancia ?? 'km'))
  partes.push(formatarTempo(sessao.duracao_seg))
  const r = textoRitmo(sessao.atividade, sessao.duracao_seg, sessao.distancia_m)
  if (r) partes.push(r)
  if (sessao.intervalos > 1) partes.push(`${sessao.intervalos} intervalos`)
  return partes.join(' · ')
}

// ---------- Filtros ----------

// O grupo de uma atividade para o filtro das estatísticas: a família (corrida, caminhada) ou a própria
export const grupoFiltro = (atividadeId) => obterAtividade(atividadeId).familia ?? atividadeId
export function nomeGrupoFiltro(grupo) {
  if (grupo === 'corrida') return 'Corrida'
  if (grupo === 'caminhada') return 'Caminhada'
  return nomeAtividade(grupo)
}

// Os filtros com sessões, do mais usado para o menos: [{ id, nome }]
export function filtrosCardio(sessoes) {
  const contagem = new Map()
  for (const s of sessoes) contagem.set(grupoFiltro(s.atividade), (contagem.get(grupoFiltro(s.atividade)) ?? 0) + 1)
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => ({ id, nome: nomeGrupoFiltro(id) }))
}

export const filtrarSessoes = (sessoes, filtro) =>
  !filtro || filtro === 'todas' ? sessoes : sessoes.filter((s) => grupoFiltro(s.atividade) === filtro)

// ---------- Totais ----------

// metrica: 'distancia' (metros) | 'tempo' (segundos) | 'sessoes'
export function valorSessao(sessao, metrica) {
  if (metrica === 'distancia') return sessao.distancia_m ?? 0
  if (metrica === 'tempo') return sessao.duracao_seg
  return 1
}

// { mes, ano, sempre } do "agora"
export function resumoCardio(sessoes, metrica, agora) {
  const resumo = { mes: 0, ano: 0, sempre: 0 }
  for (const s of sessoes) {
    const d = new Date(s.data)
    const valor = valorSessao(s, metrica)
    resumo.sempre += valor
    if (d.getFullYear() === agora.getFullYear()) {
      resumo.ano += valor
      if (d.getMonth() === agora.getMonth()) resumo.mes += valor
    }
  }
  return resumo
}

// As últimas `quantidade` semanas ou meses (com zeros), das mais antigas para as mais recentes: [{ inicio, valor }]
export function serieCardio(sessoes, metrica, unidade, agora, quantidade = 12) {
  const chave = (data) => {
    const d = new Date(data)
    return unidade === 'semana' ? chaveDia(inicioSemana(d)) : `${d.getFullYear()}-${d.getMonth()}`
  }
  const baldes = []
  for (let i = quantidade - 1; i >= 0; i--) {
    const inicio =
      unidade === 'semana' ? somarDias(inicioSemana(agora), -7 * i) : new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    baldes.push({ inicio, chave: chave(inicio), valor: 0 })
  }
  const porChave = new Map(baldes.map((b) => [b.chave, b]))
  for (const s of sessoes) {
    const balde = porChave.get(chave(s.data))
    if (balde) balde.valor += valorSessao(s, metrica)
  }
  return baldes.map(({ inicio, valor }) => ({ inicio, valor }))
}

// Cardio desta semana (segunda a domingo): { distancia_m, duracao_seg, sessoes }
export function cardioDaSemana(sessoes, agora) {
  const inicio = inicioSemana(agora)
  const fim = somarDias(inicio, 7)
  const daSemana = sessoes.filter((s) => new Date(s.data) >= inicio && new Date(s.data) < fim)
  return {
    distancia_m: daSemana.reduce((t, s) => t + (s.distancia_m ?? 0), 0),
    duracao_seg: daSemana.reduce((t, s) => t + s.duracao_seg, 0),
    sessoes: daSemana.length,
  }
}

// ---------- Evolução e recordes ----------

export const DISTANCIA_MINIMA_RITMO = 1000

// Ritmo médio (s/km) de cada sessão de corrida ou caminhada com pelo menos 1 km: [{ sessao, ritmo }]
export function evolucaoRitmo(sessoes, familia) {
  return sessoes
    .filter((s) => obterAtividade(s.atividade).familia === familia && (s.distancia_m ?? 0) >= DISTANCIA_MINIMA_RITMO)
    .map((sessao) => ({ sessao, ritmo: ritmo(sessao.duracao_seg, sessao.distancia_m) }))
}

// Recordes: maior distância, mais tempo e o melhor ritmo MÉDIO da sessão nas corridas com pelo menos
// 5 km e com pelo menos 10 km (não é um parcial). Cada um é { sessao, valor } ou null.
export function recordesCardio(sessoes) {
  let maiorDistancia = null
  let maisTempo = null
  let ritmo5k = null
  let ritmo10k = null
  for (const s of sessoes) {
    if (s.distancia_m && (!maiorDistancia || s.distancia_m > maiorDistancia.valor)) maiorDistancia = { sessao: s, valor: s.distancia_m }
    if (!maisTempo || s.duracao_seg > maisTempo.valor) maisTempo = { sessao: s, valor: s.duracao_seg }
    if (obterAtividade(s.atividade).familia !== 'corrida' || !s.distancia_m) continue
    const r = ritmo(s.duracao_seg, s.distancia_m)
    if (s.distancia_m >= 5000 && (!ritmo5k || r < ritmo5k.valor)) ritmo5k = { sessao: s, valor: r }
    if (s.distancia_m >= 10000 && (!ritmo10k || r < ritmo10k.valor)) ritmo10k = { sessao: s, valor: r }
  }
  return { maiorDistancia, maisTempo, ritmo5k, ritmo10k }
}

// ---------- Validação de um intervalo ----------

// Valida os campos escritos de um intervalo (textos) para a atividade. Devolve { dados } (pronto a
// gravar) ou { erro }. Os campos que a atividade não usa ficam a null.
export function validarIntervalo(atividadeId, campos) {
  const atividade = obterAtividade(atividadeId)
  const duracao = lerDuracao(campos.duracao)
  if (duracao === null) return { erro: 'Indica a duração (por exemplo, 42:10, ou só os minutos).' }
  // Sem distância, a intensidade é o que diz o esforço (para as calorias): é pedida
  if (atividade.intensidade === 'sempre' && !campos.intensidade) return { erro: 'Escolhe a intensidade (leve, moderada ou intensa).' }
  const dados = {
    duracao_seg: duracao,
    distancia_m: null,
    velocidade_kmh: null,
    inclinacao_pct: null,
    intensidade: campos.intensidade || null,
    fc_media: null,
    notas: String(campos.notas ?? '').trim() || null,
  }
  if (atividade.distancia && String(campos.distancia ?? '').trim() !== '') {
    dados.distancia_m = lerDistancia(campos.distancia, atividade.distancia)
    if (dados.distancia_m === null) return { erro: `Indica a distância em ${atividade.distancia} (por exemplo, ${atividade.distancia === 'm' ? '400' : '5,2'}).` }
  }
  if (atividade.distancia && atividade.velocidade && String(campos.velocidade ?? '').trim() !== '') {
    const v = lerNumero(campos.velocidade)
    if (v === null || v <= 0 || v > 120) return { erro: 'Indica a velocidade em km/h (por exemplo, 10,5).' }
    dados.velocidade_kmh = arredondar(v, 2)
  }
  // Sem velocidade escrita (ou sem o campo, como na natação), calcula-se da duração e da distância
  if (dados.velocidade_kmh === null && dados.distancia_m) {
    dados.velocidade_kmh = calcularTerceiro(dados, 'velocidade')
  }
  if (atividade.inclinacao && String(campos.inclinacao ?? '').trim() !== '') {
    const i = lerNumero(campos.inclinacao)
    if (i === null || i < -30 || i > 40) return { erro: 'Indica a inclinação em % (entre −30 e 40).' }
    dados.inclinacao_pct = arredondar(i, 1)
  }
  if (String(campos.fc ?? '').trim() !== '') {
    const fc = Number(String(campos.fc).trim())
    if (!Number.isInteger(fc) || fc < 30 || fc > 230) return { erro: 'A FC média tem de ser um número inteiro (batimentos por minuto).' }
    dados.fc_media = fc
  }
  return { dados }
}

// ---------- Estado dos campos de um intervalo (no editor) ----------

// estado: { valores: { duracao, distancia, velocidade, inclinacao, intensidade, fc, notas } (textos),
//           editados: os campos de duração/distância/velocidade escritos à mão, por ordem }

const textoVelocidade = (v) => (v === null || v === undefined ? '' : String(arredondar(Number(v), 2)).replace('.', ','))
const lerVelocidade = (texto) => {
  const v = lerNumero(String(texto ?? ''))
  return v !== null && v > 0 ? v : null
}

// Os campos a partir de uma linha gravada. Com duração e distância, a velocidade conta como calculada.
export function estadoInicialIntervalo(linha, atividadeId) {
  const atividade = obterAtividade(atividadeId)
  const feita = linhaFeita(linha)
  const valores = {
    duracao: feita ? formatarTempo(linha.duracao_seg) : '',
    distancia: distanciaParaCampo(linha.distancia_m, atividade.distancia ?? 'km'),
    velocidade: textoVelocidade(linha.velocidade_kmh),
    inclinacao: linha.inclinacao_pct === null || linha.inclinacao_pct === undefined ? '' : String(linha.inclinacao_pct).replace('.', ','),
    intensidade: linha.intensidade ?? '',
    fc: linha.fc_media ? String(linha.fc_media) : '',
    notas: linha.notas ?? '',
  }
  const editados = []
  if (valores.duracao) editados.push('duracao')
  if (valores.distancia) editados.push('distancia')
  if (!(valores.duracao && valores.distancia) && valores.velocidade) editados.push('velocidade')
  return { valores, editados }
}

// A atividade usa os três campos (duração, distância e velocidade)?
export const usaTresCampos = (atividadeId) => {
  const a = obterAtividade(atividadeId)
  return Boolean(a.distancia && a.velocidade)
}

// Escreve um campo; se ficarem dois dos três (duração, distância, velocidade) escritos à mão, o terceiro
// é calculado (e fica marcado como calculado). Devolve o estado novo.
export function editarCampo(estado, campo, texto, atividadeId) {
  const atividade = obterAtividade(atividadeId)
  const valores = { ...estado.valores, [campo]: texto }
  let editados = estado.editados
  if (CAMPOS_CALCULAVEIS.includes(campo)) {
    editados = editados.filter((c) => c !== campo)
    if (String(texto).trim() !== '') editados = [...editados, campo]
    const calculado = usaTresCampos(atividadeId) ? campoCalculado(editados) : null
    if (calculado) {
      const numeros = {
        duracao_seg: lerDuracao(valores.duracao),
        distancia_m: lerDistancia(valores.distancia, atividade.distancia),
        velocidade_kmh: lerVelocidade(valores.velocidade),
      }
      const valor = calcularTerceiro(numeros, calculado)
      valores[calculado] =
        valor === null
          ? ''
          : calculado === 'duracao'
            ? formatarTempo(valor)
            : calculado === 'distancia'
              ? distanciaParaCampo(valor, atividade.distancia)
              : textoVelocidade(valor)
    }
  }
  return { valores, editados }
}

// O campo que está calculado neste estado (para o estilo), ou null
export function campoCalculadoDoEstado(estado, atividadeId) {
  return usaTresCampos(atividadeId) ? campoCalculado(estado.editados) : null
}
