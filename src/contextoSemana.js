import { createContext, useContext } from 'react'
import { lerObjetivos } from './semana'

// Os objetivos semanais por músculo (do user_metadata da conta) e os atalhos que os ecrãs da semana
// usam, partilhados pelo App:
//   objetivos: { peito: 10, ... } (todos os músculos); guardarObjetivos(objetivos) → mensagem de erro ou null
//   abrirIdeias({ musculos? }): abre "Ideias de treino" (focada nesses músculos, se vierem)
//   abrirSemMusculos(): abre os Exercícios com o filtro "Sem músculos"
// Fora do App (por exemplo, nos testes) há os objetivos padrão e não há atalhos.
export const ContextoSemana = createContext({
  objetivos: lerObjetivos(null),
  guardarObjetivos: async () => null,
  abrirIdeias: null,
  abrirSemMusculos: null,
})

export function useSemana() {
  return useContext(ContextoSemana)
}
