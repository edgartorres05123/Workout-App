import { AlarmClock, Flame, Hourglass, Layers, RefreshCw, Repeat } from 'lucide-react'

const ICONES = { aquecimento: Flame, serie: Repeat, superserie: Layers, circuito: RefreshCw, amrap: Hourglass, emom: AlarmClock }

// Ícone de cada tipo de bloco: chama (aquecimento), repetição (série), camadas (super série),
// setas em círculo (circuito), ampulheta (AMRAP) e despertador (EMOM)
export default function IconeBloco({ tipo, size = 16 }) {
  const Icone = ICONES[tipo] ?? Repeat
  return <Icone size={size} aria-hidden="true" />
}
