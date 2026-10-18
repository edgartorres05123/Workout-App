import { ChevronRight, Scale } from 'lucide-react'
import { usePesoCorporal, useSemPesoCorporal } from './contextoPesoCorporal'

// Aviso discreto quando há exercícios de peso corporal mas nenhuma medição com o peso: as contas
// usam só o peso extra. Tem um atalho para "Perfil e medições". mostrar: há exercícios destes aqui.
export default function AvisoPesoCorporal({ mostrar = true }) {
  const semPeso = useSemPesoCorporal()
  const { abrirPerfil } = usePesoCorporal()
  if (!mostrar || !semPeso) return null

  return (
    <div className="aviso-peso-corporal" role="note">
      <Scale size={18} aria-hidden="true" />
      <p>
        Ainda não registaste o teu peso: nos exercícios de peso corporal, as contas usam só o peso extra.
      </p>
      {abrirPerfil && (
        <button className="botao-link com-icone" onClick={abrirPerfil}>
          Registar o peso
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  )
}
