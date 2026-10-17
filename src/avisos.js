import { createContext, useContext } from 'react'

// Avisos curtos (toasts): const avisar = useAvisos(); avisar('Gravado'); avisar(mensagem, 'erro')
// Fora do <Avisos> (por exemplo, nos testes) não faz nada.
export const ContextoAvisos = createContext(() => {})

export function useAvisos() {
  return useContext(ContextoAvisos)
}
