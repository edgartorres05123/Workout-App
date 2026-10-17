import { useCallback, useRef, useState } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { ContextoAvisos } from './avisos'

const DURACAO_MS = { sucesso: 2200, erro: 4500 }

// Mostra os avisos curtos (toasts) por cima da barra de navegação
export default function ProvedorAvisos({ children }) {
  const [avisos, setAvisos] = useState([])
  const proximoId = useRef(0)

  const avisar = useCallback((texto, tipo = 'sucesso') => {
    const id = ++proximoId.current
    // No máximo 3 ao mesmo tempo; um aviso igual ao último não se repete
    setAvisos((atuais) =>
      atuais.at(-1)?.texto === texto ? atuais : [...atuais.slice(-2), { id, texto, tipo }]
    )
    setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), DURACAO_MS[tipo] ?? 2500)
  }, [])

  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className={`aviso-toast aviso-${a.tipo}`}>
            {a.tipo === 'erro' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  )
}
