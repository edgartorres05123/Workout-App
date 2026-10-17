import { createClient } from '@supabase/supabase-js'

// Quando um pedido falha por falta de rede, devolve uma resposta de erro com uma mensagem clara.
// Assim, todos os ecrãs mostram "Sem ligação à internet" (com a classe .erro) em vez de
// "TypeError: Failed to fetch". O 503 também faz o login tentar renovar a sessão mais tarde,
// sem a terminar.
async function fetchComAvisoDeLigacao(...argumentos) {
  try {
    return await fetch(...argumentos)
  } catch (erro) {
    if (erro?.name === 'AbortError') throw erro
    const message = navigator.onLine
      ? 'Não foi possível ligar ao servidor. Verifica a ligação à internet e tenta outra vez.'
      : 'Sem ligação à internet. Os dados aparecem quando voltares a estar online.'
    return new Response(JSON.stringify({ message, code: 'SEM_LIGACAO', details: null, hint: null }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchComAvisoDeLigacao } }
)
