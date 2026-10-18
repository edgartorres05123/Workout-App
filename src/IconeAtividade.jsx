import { obterAtividade } from './atividades'

// Ícone de uma atividade de cardio (pelo id gravado)
export default function IconeAtividade({ atividade, size = 16 }) {
  const Icone = obterAtividade(atividade).icone
  return <Icone size={size} aria-hidden="true" />
}
