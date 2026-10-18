// Atividades de cardio e desportos (lista fixa). O id (sem acentos) é o que fica gravado em
// atividades_cardio.atividade; o resto diz que campos a atividade usa e como se calculam as calorias
// (na próxima etapa):
//   categoria: grupo na lista (ver CATEGORIAS)
//   familia: 'corrida' | 'caminhada' (para a evolução do ritmo e os recordes), ou null
//   distancia: 'km' | 'm' | null (sem distância); velocidade / inclinacao: se mostra esses campos
//   ritmo: 'km' (min/km) | '100m' (min/100 m) | 'kmh' (km/h) | null
//   intensidade: 'sempre' (sem distância, é o que diz o esforço) | 'opcional'
//   calculo: 'acsm_corrida' | 'acsm_caminhada' (equações do ACSM, com a velocidade e a inclinação) | 'met'
//   met: { leve, moderada, intensa } — valores do Compendium of Physical Activities, do lado mais
//        conservador. Nas atividades ACSM servem de recurso quando não há velocidade.
import {
  Accessibility,
  Activity,
  Bike,
  ChevronsUp,
  Disc,
  Droplets,
  Flower2,
  Footprints,
  Gauge,
  Goal,
  HandFist,
  Infinity as Corda,
  Mountain,
  MountainSnow,
  Music,
  Orbit,
  PersonStanding,
  Route,
  Sailboat,
  Snowflake,
  Sparkles,
  Target,
  Trophy,
  Volleyball,
  Waves,
  Wind,
  Zap,
} from 'lucide-react'
import { normalizarTexto } from './formatar'

export const CATEGORIAS = [
  { id: 'corrida', nome: 'Corrida e caminhada' },
  { id: 'ciclismo', nome: 'Ciclismo e máquinas' },
  { id: 'agua', nome: 'Água' },
  { id: 'treino', nome: 'Treino' },
  { id: 'desportos', nome: 'Desportos' },
  { id: 'outra', nome: 'Outra' },
]

const met = (leve, moderada, intensa) => ({ leve, moderada, intensa })

// Corrida e caminhada: distância (km), velocidade e inclinação; o ritmo em min/km
const aPe = (id, nome, icone, familia, calculo, valores) => ({
  id, nome, icone, categoria: 'corrida', familia, distancia: 'km', velocidade: true, inclinacao: true,
  ritmo: 'km', intensidade: 'opcional', calculo, met: valores,
})
// Atividades sem distância: a intensidade é sempre pedida
const semDistancia = (id, nome, icone, categoria, valores) => ({
  id, nome, icone, categoria, familia: null, distancia: null, velocidade: false, inclinacao: false,
  ritmo: null, intensidade: 'sempre', calculo: 'met', met: valores,
})

export const ATIVIDADES = [
  // Corrida e caminhada
  aPe('corrida', 'Corrida', Footprints, 'corrida', 'acsm_corrida', met(6.0, 8.3, 11.0)),
  aPe('corrida_passadeira', 'Corrida em passadeira', Gauge, 'corrida', 'acsm_corrida', met(6.0, 8.3, 11.0)),
  aPe('caminhada', 'Caminhada', PersonStanding, 'caminhada', 'acsm_caminhada', met(2.8, 3.5, 4.3)),
  aPe('caminhada_passadeira', 'Caminhada em passadeira', Gauge, 'caminhada', 'acsm_caminhada', met(2.8, 3.5, 4.3)),
  aPe('caminhada_montanha', 'Caminhada em montanha (trilho)', Mountain, 'caminhada', 'met', met(4.5, 6.0, 7.3)),
  aPe('trail_running', 'Trail running', Route, 'corrida', 'met', met(7.0, 9.0, 10.5)),

  // Ciclismo e máquinas
  {
    id: 'bicicleta', nome: 'Bicicleta (estrada ou BTT)', icone: Bike, categoria: 'ciclismo', familia: null,
    distancia: 'km', velocidade: true, inclinacao: false, ritmo: 'kmh', intensidade: 'opcional', calculo: 'met',
    met: met(4.0, 6.8, 8.5),
  },
  {
    id: 'bicicleta_estatica', nome: 'Bicicleta estática ou spinning', icone: Bike, categoria: 'ciclismo', familia: null,
    distancia: 'km', velocidade: true, inclinacao: false, ritmo: 'kmh', intensidade: 'opcional', calculo: 'met',
    met: met(4.8, 6.8, 8.8),
  },
  {
    id: 'remo', nome: 'Remo (máquina)', icone: Sailboat, categoria: 'ciclismo', familia: null,
    distancia: 'm', velocidade: true, inclinacao: false, ritmo: null, intensidade: 'opcional', calculo: 'met',
    met: met(4.8, 7.0, 8.5),
  },
  {
    id: 'eliptica', nome: 'Elíptica', icone: Orbit, categoria: 'ciclismo', familia: null,
    distancia: 'km', velocidade: true, inclinacao: false, ritmo: null, intensidade: 'opcional', calculo: 'met',
    met: met(4.0, 5.0, 7.0),
  },
  semDistancia('escadas', 'Máquina de escadas', ChevronsUp, 'ciclismo', met(5.0, 7.0, 9.0)),
  {
    id: 'ski_erg', nome: 'Ski erg', icone: Wind, categoria: 'ciclismo', familia: null,
    distancia: 'm', velocidade: true, inclinacao: false, ritmo: null, intensidade: 'opcional', calculo: 'met',
    met: met(5.0, 7.0, 9.0),
  },

  // Água: distância em metros e ritmo por 100 m
  {
    id: 'natacao', nome: 'Natação (piscina)', icone: Waves, categoria: 'agua', familia: null,
    distancia: 'm', velocidade: false, inclinacao: false, ritmo: '100m', intensidade: 'opcional', calculo: 'met',
    met: met(5.8, 7.0, 9.5),
  },
  {
    id: 'natacao_aguas_abertas', nome: 'Natação em águas abertas', icone: Droplets, categoria: 'agua', familia: null,
    distancia: 'm', velocidade: false, inclinacao: false, ritmo: '100m', intensidade: 'opcional', calculo: 'met',
    met: met(5.8, 7.0, 9.5),
  },

  // Treino
  semDistancia('corda', 'Saltar à corda', Corda, 'treino', met(8.3, 10.0, 11.8)),
  semDistancia('hiit', 'HIIT', Zap, 'treino', met(4.0, 6.0, 8.0)),
  semDistancia('yoga', 'Yoga', Flower2, 'treino', met(2.3, 2.5, 4.0)),
  semDistancia('pilates', 'Pilates', Accessibility, 'treino', met(2.5, 3.0, 3.8)),
  semDistancia('alongamentos', 'Alongamentos e mobilidade', Sparkles, 'treino', met(2.0, 2.3, 2.8)),

  // Desportos
  semDistancia('futebol', 'Futebol', Goal, 'desportos', met(5.0, 7.0, 10.0)),
  semDistancia('futsal', 'Futsal', Goal, 'desportos', met(5.0, 7.0, 10.0)),
  semDistancia('padel', 'Padel', Disc, 'desportos', met(4.5, 6.0, 7.3)),
  semDistancia('tenis', 'Ténis', Disc, 'desportos', met(4.5, 6.0, 8.0)),
  semDistancia('basquetebol', 'Basquetebol', Target, 'desportos', met(4.5, 6.5, 8.0)),
  semDistancia('voleibol', 'Voleibol', Volleyball, 'desportos', met(3.0, 4.0, 6.0)),
  semDistancia('andebol', 'Andebol', Trophy, 'desportos', met(6.0, 8.0, 10.0)),
  semDistancia('boxe', 'Boxe ou artes marciais', HandFist, 'desportos', met(5.3, 7.8, 10.3)),
  semDistancia('escalada', 'Escalada', Mountain, 'desportos', met(5.0, 7.3, 8.0)),
  semDistancia('surf', 'Surf', Waves, 'desportos', met(3.0, 3.5, 5.0)),
  semDistancia('danca', 'Dança', Music, 'desportos', met(3.0, 5.0, 7.3)),
  semDistancia('patinagem', 'Patinagem', Snowflake, 'desportos', met(5.5, 7.0, 9.0)),
  semDistancia('esqui', 'Esqui', MountainSnow, 'desportos', met(4.3, 5.3, 8.0)),

  // Outra (o nome escreve-se nas notas)
  semDistancia('outra', 'Outra atividade', Activity, 'outra', met(3.0, 5.0, 7.0)),
]

const POR_ID = new Map(ATIVIDADES.map((a) => [a.id, a]))
export const ATIVIDADE_OUTRA = POR_ID.get('outra')

// A atividade com este id (uma desconhecida conta como "Outra atividade")
export function obterAtividade(id) {
  return POR_ID.get(id) ?? ATIVIDADE_OUTRA
}

export const nomeAtividade = (id) => obterAtividade(id).nome

export const INTENSIDADES = [
  { id: 'leve', nome: 'Leve' },
  { id: 'moderada', nome: 'Moderada' },
  { id: 'intensa', nome: 'Intensa' },
]

// Pesquisa pelo nome (sem acentos nem maiúsculas)
export function procurarAtividades(texto, lista = ATIVIDADES) {
  const termo = normalizarTexto(texto.trim())
  if (!termo) return lista
  return lista.filter((a) => normalizarTexto(a.nome).includes(termo) || a.id.includes(termo))
}

// As atividades por categoria, com as mais usadas primeiro: { usadas: [...], categorias: [{ id, nome, atividades }] }
// usos: Map(id → número de vezes). As "usadas" são as 5 com mais usos (ficam também na categoria).
export function agruparAtividades(lista, usos = new Map(), maximoUsadas = 5) {
  const usadas = lista
    .filter((a) => (usos.get(a.id) ?? 0) > 0)
    .sort((a, b) => usos.get(b.id) - usos.get(a.id) || a.nome.localeCompare(b.nome, 'pt-PT'))
    .slice(0, maximoUsadas)
  const categorias = CATEGORIAS.map((c) => ({ ...c, atividades: lista.filter((a) => a.categoria === c.id) })).filter(
    (c) => c.atividades.length > 0
  )
  return { usadas, categorias }
}
