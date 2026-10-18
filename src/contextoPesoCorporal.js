import { createContext, useContext, useMemo } from 'react'
import { criarCarga, pesoCorporalNaData } from './pesoCorporal'

// As medições (só data e peso), carregadas uma vez pelo App e partilhadas por todos os ecrãs,
// para calcular o peso corporal numa data. Fora do App (por exemplo, nos testes) não há medições.
//   medicoes: [{ id, data, peso_kg }]; carregadas: já chegaram do Supabase
//   recarregar(): depois de gravar ou apagar uma medição; abrirPerfil(): abre "Perfil e medições"
export const ContextoPesoCorporal = createContext({
  medicoes: [],
  carregadas: false,
  recarregar: () => {},
  abrirPerfil: null,
})

export function usePesoCorporal() {
  return useContext(ContextoPesoCorporal)
}

// carga(serie, dataDoTreino) com as medições atuais. ehPesoCorporal(serie) é opcional: por omissão
// lê serie.exercicios.peso_corporal. Passa uma função estável (useCallback), para não recalcular sempre.
export function useCarga(ehPesoCorporal) {
  const { medicoes } = usePesoCorporal()
  return useMemo(() => criarCarga(medicoes, ehPesoCorporal), [medicoes, ehPesoCorporal])
}

// Peso corporal numa data (null se desconhecido)
export function usePesoCorporalNaData(data) {
  const { medicoes } = usePesoCorporal()
  return useMemo(() => (data ? pesoCorporalNaData(medicoes, data) : null), [medicoes, data])
}

// true quando as medições já chegaram e não há nenhuma: os exercícios de peso corporal contam só o
// extra e convém avisar (com um atalho para registar o peso)
export function useSemPesoCorporal() {
  const { medicoes, carregadas } = usePesoCorporal()
  return carregadas && medicoes.length === 0
}
