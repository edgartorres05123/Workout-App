// Cálculos do perfil e das medições corporais (relatórios InBody). Funções puras: o "hoje"
// vem por argumento, para poderem ser testadas. O IMC é sempre calculado, nunca guardado.
import { dataDeChave } from './estatisticas'
import { chaveDia, lerNumero } from './formatar'

const arredondar = (valor, casas) => Math.round(valor * 10 ** casas) / 10 ** casas

// ---------- Idade e IMC ----------

// Idade em anos completos a partir de "1990-05-20"; null se faltar ou for inválida
export function calcularIdade(dataNascimento, hoje) {
  if (!dataNascimento) return null
  const nascimento = dataDeChave(dataNascimento)
  if (Number.isNaN(nascimento.getTime()) || nascimento > hoje) return null
  let idade = hoje.getFullYear() - nascimento.getFullYear()
  const aindaNaoFezAnos =
    hoje.getMonth() < nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate())
  if (aindaNaoFezAnos) idade -= 1
  return idade
}

// IMC = peso / (altura em metros)²; null se faltar o peso ou a altura
export function calcularIMC(pesoKg, alturaCm) {
  const peso = Number(pesoKg)
  const altura = Number(alturaCm) / 100
  if (!pesoKg || !alturaCm || !(peso > 0) || !(altura > 0)) return null
  return peso / (altura * altura)
}

// Classificação da OMS, feita sobre o IMC arredondado a uma casa (o valor que se mostra)
export function classificarIMC(imc) {
  if (imc === null || imc === undefined) return null
  const valor = arredondar(imc, 1)
  if (valor < 18.5) return { id: 'baixo', nome: 'Baixo peso' }
  if (valor < 25) return { id: 'normal', nome: 'Normal' }
  if (valor < 30) return { id: 'excesso', nome: 'Excesso de peso' }
  return { id: 'obesidade', nome: 'Obesidade' }
}

// ---------- Campos das medições ----------

// Pela ordem do relatório InBody. melhor: 'subir' | 'descer' | null (neutro, depende do objetivo)
export const CAMPOS_MEDICAO = [
  { id: 'peso_kg', nome: 'Peso (kg)', curto: 'Peso', unidade: 'kg', min: 20, max: 300, casas: 1, obrigatorio: true, melhor: null },
  { id: 'massa_muscular_kg', nome: 'Massa muscular esquelética (kg)', curto: 'Massa muscular', unidade: 'kg', min: 5, max: 150, casas: 1, melhor: 'subir' },
  { id: 'massa_gorda_kg', nome: 'Massa gorda (kg)', curto: 'Massa gorda', unidade: 'kg', min: 1, max: 250, casas: 1, melhor: 'descer' },
  { id: 'gordura_pct', nome: 'Percentagem de gordura (%)', curto: '% gordura', unidade: '%', min: 2, max: 70, casas: 1, melhor: 'descer' },
  { id: 'massa_livre_gordura_kg', nome: 'Massa livre de gordura (kg)', curto: 'Massa livre de gordura', unidade: 'kg', min: 10, max: 250, casas: 1, melhor: null },
  { id: 'agua_l', nome: 'Água corporal total (L)', curto: 'Água', unidade: 'L', min: 10, max: 150, casas: 1, melhor: null },
  { id: 'tmb_kcal', nome: 'Taxa metabólica basal (kcal)', curto: 'Taxa metabólica basal', unidade: 'kcal', min: 500, max: 5000, casas: 0, inteiro: true, melhor: null },
  { id: 'gordura_visceral', nome: 'Gordura visceral (nível)', curto: 'Gordura visceral', unidade: '', min: 1, max: 30, casas: 0, inteiro: true, melhor: 'descer' },
  { id: 'cintura_anca', nome: 'Relação cintura-anca', curto: 'Cintura-anca', unidade: '', min: 0.5, max: 1.5, casas: 2, melhor: null },
  { id: 'pontuacao', nome: 'Pontuação InBody', curto: 'Pontuação InBody', unidade: '', min: 0, max: 100, casas: 0, inteiro: true, melhor: 'subir' },
]

export const CAMPO = Object.fromEntries(CAMPOS_MEDICAO.map((c) => [c.id, c]))

// Campos que não podem ser maiores do que o peso
const PARTES_DO_PESO = ['massa_muscular_kg', 'massa_gorda_kg', 'massa_livre_gordura_kg']

// Valida o formulário de uma medição. valores: textos escritos pelo utilizador ({ data, notas, peso_kg, ... }).
// Devolve { erros: { campo: mensagem }, dados } (dados = valores prontos a gravar; vazio → null).
export function validarMedicao(valores, hoje) {
  const erros = {}
  const dados = {}

  const data = (valores.data ?? '').trim()
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(dataDeChave(data).getTime())
  if (!data) erros.data = 'Indica a data.'
  else if (!dataValida || data < '1900-01-01') erros.data = 'Data inválida.'
  else if (data > chaveDia(hoje)) erros.data = 'A data não pode ser no futuro.'
  dados.data = data

  for (const campo of CAMPOS_MEDICAO) {
    const texto = String(valores[campo.id] ?? '').trim()
    if (texto === '') {
      dados[campo.id] = null
      if (campo.obrigatorio) erros[campo.id] = 'Obrigatório.'
      continue
    }
    const numero = lerNumero(texto)
    if (numero === null) {
      erros[campo.id] = 'Escreve só um número (por exemplo, 72,5).'
    } else if (campo.inteiro && !Number.isInteger(numero)) {
      erros[campo.id] = 'Indica um número inteiro.'
    } else if (numero < campo.min || numero > campo.max) {
      const unidade = campo.unidade ? ` ${campo.unidade}` : ''
      erros[campo.id] = `Indica um valor entre ${String(campo.min).replace('.', ',')} e ${String(campo.max).replace('.', ',')}${unidade}.`
    }
    dados[campo.id] = numero === null ? null : arredondar(numero, campo.casas)
  }

  for (const id of PARTES_DO_PESO) {
    if (!erros[id] && !erros.peso_kg && dados[id] !== null && dados.peso_kg !== null && dados[id] >= dados.peso_kg) {
      erros[id] = 'Não pode ser maior do que o peso.'
    }
  }

  const notas = (valores.notas ?? '').trim()
  dados.notas = notas === '' ? null : notas
  return { erros, dados }
}

// ---------- Diferenças entre medições ----------

// Diferença entre dois valores e se é boa ou má notícia. melhor: 'subir' | 'descer' | null.
// Devolve null se faltar algum valor; senão { diferenca, sentido: 'subiu'|'desceu'|'igual', tom }
// com tom = 'favoravel' | 'desfavoravel' | 'neutro'.
export function compararValores(atual, anterior, melhor) {
  if (atual === null || atual === undefined || anterior === null || anterior === undefined) return null
  const diferenca = arredondar(Number(atual) - Number(anterior), 2)
  const sentido = diferenca > 0 ? 'subiu' : diferenca < 0 ? 'desceu' : 'igual'
  let tom = 'neutro'
  if (melhor && sentido !== 'igual') {
    tom = (sentido === 'subiu') === (melhor === 'subir') ? 'favoravel' : 'desfavoravel'
  }
  return { diferenca, sentido, tom }
}

// Medições da mais recente para a mais antiga (por data e, no mesmo dia, pela ordem de criação)
export function ordenarMedicoes(medicoes) {
  return [...medicoes].sort((a, b) =>
    a.data === b.data ? Number(b.id) - Number(a.id) : a.data < b.data ? 1 : -1
  )
}

// Compara um campo da medição na posição `indice` com a medição anterior que tem esse valor
// (as medições antigas podem não ter todos os campos). medicoes: da mais recente para a mais antiga.
export function diferencaCampo(medicoes, indice, campoId) {
  const atual = medicoes[indice]?.[campoId]
  const anterior = medicoes.slice(indice + 1).find((m) => m[campoId] !== null && m[campoId] !== undefined)
  if (!anterior) return null
  return { ...compararValores(atual, anterior[campoId], CAMPO[campoId]?.melhor ?? null), data: anterior.data }
}

// Valores de uma métrica ao longo do tempo (da mais antiga para a mais recente), ignorando as
// medições sem esse valor. metrica: um campo de CAMPOS_MEDICAO ou 'imc'. desde: Date ou null.
export function serieMedicoes(medicoes, metrica, alturaCm, desde = null) {
  const pontos = []
  for (const m of ordenarMedicoes(medicoes).reverse()) {
    if (desde && dataDeChave(m.data) < desde) continue
    const valor = metrica === 'imc' ? calcularIMC(m.peso_kg, alturaCm) : m[metrica]
    if (valor === null || valor === undefined) continue
    pontos.push({ medicao: m, valor: Number(valor) })
  }
  return pontos
}

// ---------- Dados pessoais ----------

// Valida a altura escrita no perfil: devolve { valor } (null se vazio) ou { erro }
export function validarAltura(texto) {
  if (String(texto).trim() === '') return { valor: null }
  const altura = lerNumero(texto)
  if (altura === null || altura < 100 || altura > 250) return { erro: 'Indica a altura em centímetros, entre 100 e 250.' }
  return { valor: arredondar(altura, 1) }
}

// Valida a data de nascimento: devolve { valor } (null se vazio) ou { erro }
export function validarNascimento(data, hoje) {
  if (!data) return { valor: null }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < '1900-01-01') return { erro: 'Data de nascimento inválida.' }
  if (data > chaveDia(hoje)) return { erro: 'A data de nascimento não pode ser no futuro.' }
  return { valor: data }
}
