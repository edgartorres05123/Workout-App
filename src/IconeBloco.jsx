import { Flame, Layers, Repeat } from 'lucide-react'

const ICONES = { aquecimento: Flame, serie: Repeat, superserie: Layers }

// Ícone de cada tipo de bloco: chama (aquecimento), repetição (série), camadas (super série)
export default function IconeBloco({ tipo, size = 16 }) {
  const Icone = ICONES[tipo] ?? Repeat
  return <Icone size={size} aria-hidden="true" />
}
