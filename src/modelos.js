// Modelos de treino prontos (Push, Pull, Legs, Upper, Lower e Full body, e exemplos de condicionamento:
// um AMRAP, um EMOM e um circuito), fixos no código.
// Cada exercício do modelo tem o nome, as reps-alvo, os músculos (principais e secundários) e se é de
// peso corporal. Ao usar um modelo, cada exercício é associado a um dos meus pelo nome (ignorando
// acentos e maiúsculas); os que não existem são criados antes de começar, já com os músculos e o PC.
import { nomesIguais } from './formatar'

// Exercícios usados nos modelos (o nome é a chave usada nos blocos)
const EXERCICIOS = {
  'Supino plano': { principais: ['peito'], secundarios: ['triceps', 'ombros'] },
  'Supino inclinado com halteres': { principais: ['peito'], secundarios: ['ombros', 'triceps'] },
  'Desenvolvimento militar': { principais: ['ombros'], secundarios: ['triceps', 'trapezio'] },
  'Elevações laterais': { principais: ['ombros'], secundarios: ['trapezio'] },
  'Extensão de tríceps na polia': { principais: ['triceps'], secundarios: [] },
  Fundos: { principais: ['triceps', 'peito'], secundarios: ['ombros'], pesoCorporal: true },
  'Elevações': { principais: ['costas'], secundarios: ['biceps', 'antebracos'], pesoCorporal: true },
  'Remada com barra': { principais: ['costas'], secundarios: ['biceps', 'lombar', 'trapezio'] },
  'Puxada na polia': { principais: ['costas'], secundarios: ['biceps'] },
  'Face pull': { principais: ['ombros'], secundarios: ['trapezio', 'costas'] },
  'Curl de bíceps com barra': { principais: ['biceps'], secundarios: ['antebracos'] },
  Encolhimentos: { principais: ['trapezio'], secundarios: ['antebracos'] },
  Agachamento: { principais: ['quadriceps', 'gluteos'], secundarios: ['isquiotibiais', 'lombar'] },
  'Peso morto': { principais: ['isquiotibiais', 'gluteos', 'lombar'], secundarios: ['costas', 'trapezio', 'antebracos'] },
  'Peso morto romeno': { principais: ['isquiotibiais'], secundarios: ['gluteos', 'lombar'] },
  'Leg press': { principais: ['quadriceps'], secundarios: ['gluteos'] },
  'Curl de pernas': { principais: ['isquiotibiais'], secundarios: [] },
  'Extensão de pernas': { principais: ['quadriceps'], secundarios: [] },
  'Elevação de gémeos': { principais: ['gemeos'], secundarios: [] },
  'Elevação de pernas suspenso': { principais: ['abdominais'], secundarios: ['antebracos'], pesoCorporal: true },
  Abdominais: { principais: ['abdominais'], secundarios: [], pesoCorporal: true },
  'Flexões': { principais: ['peito'], secundarios: ['triceps', 'ombros'], pesoCorporal: true },
  Burpees: { principais: ['quadriceps', 'peito'], secundarios: ['ombros', 'abdominais'], pesoCorporal: true },
  'Kettlebell swing': { principais: ['gluteos', 'isquiotibiais'], secundarios: ['lombar', 'ombros'] },
  Prancha: { principais: ['abdominais'], secundarios: ['lombar', 'ombros'], pesoCorporal: true },
  'Agachamento com salto': { principais: ['quadriceps', 'gluteos'], secundarios: ['gemeos'], pesoCorporal: true },
}

// Cada exercício de um bloco: [nome, reps] ou, por tempo, [nome, null, segundos]
const aquecimento = (nome) => ({ tipo: 'aquecimento', voltas: 2, exercicios: [[nome, 12]] })
const serie = (nome, reps, voltas = 3) => ({ tipo: 'serie', voltas, exercicios: [[nome, reps]] })
const superSerie = (a, b, voltas = 3) => ({ tipo: 'superserie', voltas, exercicios: [a, b] })
const circuito = (voltas, ...exercicios) => ({ tipo: 'circuito', voltas, exercicios })
const amrap = (minutos, ...exercicios) => ({ tipo: 'amrap', voltas: 1, duracao_seg: minutos * 60, exercicios })
const emom = (intervalos, ...exercicios) => ({ tipo: 'emom', voltas: intervalos, intervalo_seg: 60, exercicios })

export const MODELOS = [
  {
    id: 'push',
    nome: 'Push',
    descricao: 'Peito, ombros e tríceps',
    blocos: [
      aquecimento('Supino plano'),
      serie('Supino plano', 8),
      serie('Supino inclinado com halteres', 10),
      serie('Desenvolvimento militar', 8),
      superSerie(['Elevações laterais', 12], ['Extensão de tríceps na polia', 12]),
      serie('Fundos', 10),
    ],
  },
  {
    id: 'pull',
    nome: 'Pull',
    descricao: 'Costas, bíceps e trapézio',
    blocos: [
      aquecimento('Remada com barra'),
      serie('Elevações', 8),
      serie('Remada com barra', 8),
      serie('Puxada na polia', 10),
      superSerie(['Face pull', 15], ['Curl de bíceps com barra', 10]),
      serie('Encolhimentos', 12),
    ],
  },
  {
    id: 'legs',
    nome: 'Legs',
    descricao: 'Quadríceps, isquiotibiais, glúteos e gémeos',
    blocos: [
      aquecimento('Agachamento'),
      serie('Agachamento', 8),
      serie('Peso morto romeno', 10),
      serie('Leg press', 12),
      superSerie(['Curl de pernas', 12], ['Extensão de pernas', 12]),
      serie('Elevação de gémeos', 15),
    ],
  },
  {
    id: 'upper',
    nome: 'Upper',
    descricao: 'Parte de cima: peito, costas, ombros e braços',
    blocos: [
      aquecimento('Supino plano'),
      serie('Supino plano', 8),
      serie('Remada com barra', 8),
      superSerie(['Desenvolvimento militar', 10], ['Elevações', 8]),
      superSerie(['Curl de bíceps com barra', 12], ['Extensão de tríceps na polia', 12]),
    ],
  },
  {
    id: 'lower',
    nome: 'Lower',
    descricao: 'Parte de baixo e abdominais',
    blocos: [
      aquecimento('Agachamento'),
      serie('Agachamento', 8),
      serie('Peso morto', 5),
      serie('Leg press', 12),
      superSerie(['Curl de pernas', 12], ['Elevação de gémeos', 15]),
      serie('Elevação de pernas suspenso', 12),
    ],
  },
  {
    id: 'full',
    nome: 'Full body',
    descricao: 'O corpo todo num treino',
    blocos: [
      aquecimento('Agachamento'),
      serie('Agachamento', 8),
      serie('Supino plano', 8),
      serie('Remada com barra', 8),
      superSerie(['Desenvolvimento militar', 10], ['Peso morto romeno', 10]),
      serie('Abdominais', 15),
    ],
  },
  {
    id: 'amrap-full',
    nome: 'Full body AMRAP 15 min',
    descricao: 'Condicionamento: o máximo de voltas em 15 minutos',
    blocos: [
      aquecimento('Agachamento'),
      amrap(15, ['Agachamento', 15], ['Flexões', 10], ['Kettlebell swing', 15], ['Burpees', 5]),
    ],
  },
  {
    id: 'emom-12',
    nome: 'EMOM 12 min',
    descricao: 'Condicionamento: a cada minuto, um exercício (alternado)',
    blocos: [emom(12, ['Kettlebell swing', 15], ['Burpees', 10], ['Prancha', null, 40])],
  },
  {
    id: 'circuito-core',
    nome: 'Circuito de core',
    descricao: 'Condicionamento: abdominais e lombar, 3 voltas',
    blocos: [
      circuito(3, ['Prancha', null, 45], ['Elevação de pernas suspenso', 12], ['Abdominais', 15], ['Flexões', 12]),
    ],
  },
]

// Os exercícios de um modelo, sem repetir, pela ordem: [{ nome, principais, secundarios, pesoCorporal }]
export function exerciciosDoModelo(modelo) {
  const nomes = [...new Set(modelo.blocos.flatMap((b) => b.exercicios.map(([nome]) => nome)))]
  return nomes.map((nome) => ({
    nome,
    principais: EXERCICIOS[nome]?.principais ?? [],
    secundarios: EXERCICIOS[nome]?.secundarios ?? [],
    pesoCorporal: Boolean(EXERCICIOS[nome]?.pesoCorporal),
  }))
}

// Associa cada exercício do modelo a um dos meus pelo nome (ignorando acentos, maiúsculas e espaços).
// Devolve Map(nome do modelo → exercício meu, ou null se for novo)
export function associarModelo(modelo, exercicios) {
  return new Map(
    exerciciosDoModelo(modelo).map(({ nome }) => [nome, exercicios.find((e) => nomesIguais(e.nome, nome)) ?? null])
  )
}

// Os exercícios do modelo que vão ser criados (os que ficaram sem associação)
export function exerciciosNovos(modelo, associacoes) {
  return exerciciosDoModelo(modelo).filter(({ nome }) => !associacoes.get(nome))
}

// Linhas de exercicio_musculos para um exercício novo do modelo
export function musculosParaCriar(exercicioModelo, exercicioId) {
  return [
    ...exercicioModelo.principais.map((musculo) => ({ exercicio_id: exercicioId, musculo, principal: true })),
    ...exercicioModelo.secundarios.map((musculo) => ({ exercicio_id: exercicioId, musculo, principal: false })),
  ]
}

// Um "treino" só com blocos (ids negativos), como os favoritos, para estruturaParaCopiar().
// associacoes: Map(nome → exercício { id, nome, peso_corporal }); para começar, todos têm de estar associados.
// Cada linha guarda o nome do exercício no modelo (nome_modelo), para o poder trocar.
export function estruturaDoModelo(modelo, associacoes) {
  let id = 0
  return {
    id: `modelo-${modelo.id}`,
    data: null,
    nome_favorito: modelo.nome,
    blocos: modelo.blocos.map((b, i) => ({
      id: --id,
      ordem: i + 1,
      tipo: b.tipo,
      voltas: b.voltas,
      notas: null,
      duracao_seg: b.duracao_seg ?? null,
      intervalo_seg: b.intervalo_seg ?? null,
      bloco_exercicios: b.exercicios.map(([nome, reps, segundos = null], j) => {
        const exercicio = associacoes.get(nome)
        return {
          id: --id,
          ordem: j + 1,
          exercicio_id: exercicio?.id,
          reps_alvo: reps ?? 10,
          peso_alvo: null,
          segundos_alvo: segundos,
          exercicios: exercicio,
          nome_modelo: nome,
        }
      }),
    })),
  }
}
