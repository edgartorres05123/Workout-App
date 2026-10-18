import { createContext, useCallback, useContext, useMemo } from 'react'
import { estimarCalorias } from './calorias'
import { calcularIdade } from './corpo'
import { criarCarga, pesoCorporalNaData } from './pesoCorporal'

// As medições (só data e peso), carregadas uma vez pelo App e partilhadas por todos os ecrãs,
// para calcular o peso corporal numa data. Fora do App (por exemplo, nos testes) não há medições.
//   medicoes: [{ id, data, peso_kg }]; carregadas: já chegaram do Supabase
//   perfil: { data_nascimento, sexo } (para as calorias pela frequência cardíaca)
//   recarregar(): depois de gravar uma medição ou o perfil; abrirPerfil(): abre "Perfil e medições"
export const ContextoPesoCorporal = createContext({
  medicoes: [],
  carregadas: false,
  perfil: { data_nascimento: null, sexo: null },
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

// estimar(treino, duracaoSeg?): as calorias de um treino (ver calorias.js), com o peso na data do
// treino e a idade e o sexo do perfil. duracaoSeg: a duração até agora, num treino ao vivo.
export function useCalorias() {
  const { medicoes, perfil } = usePesoCorporal()
  return useCallback(
    (treino, duracaoSeg = null) =>
      estimarCalorias(treino, {
        pesoKg: pesoCorporalNaData(medicoes, treino.data),
        idade: perfil?.data_nascimento ? calcularIdade(perfil.data_nascimento, new Date(treino.data)) : null,
        sexo: perfil?.sexo ?? null,
        duracaoSeg,
      }),
    [medicoes, perfil]
  )
}

// true quando as medições já chegaram e não há nenhuma: os exercícios de peso corporal contam só o
// extra e convém avisar (com um atalho para registar o peso)
export function useSemPesoCorporal() {
  const { medicoes, carregadas } = usePesoCorporal()
  return carregadas && medicoes.length === 0
}
