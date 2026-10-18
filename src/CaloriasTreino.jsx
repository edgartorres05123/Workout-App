import { useEffect, useState } from 'react'
import { Flame, Info } from 'lucide-react'
import { nomeAtividade } from './atividades'
import { NOME_TIPO, atividadeDoBloco } from './blocos'
import { EXPLICACAO_CALORIAS, textoKcal } from './calorias'
import { useCalorias, usePesoCorporal } from './contextoPesoCorporal'
import { formatarMinutos, formatarPeso } from './formatar'
import Numero from './Numero'

function nomeParte(parte) {
  if (parte.tipo === 'forca') return 'Força'
  if (parte.tipo === 'cardio') return nomeAtividade(atividadeDoBloco(parte.bloco) ?? 'outra')
  return NOME_TIPO[parte.tipo] ?? 'Bloco'
}

// Calorias no detalhe de um treino: o total, a decomposição por bloco e o campo "Calorias do relógio"
// (grava em treinos.calorias_kcal; vazio volta à estimativa). onGuardar(campos) → mensagem de erro ou null.
export default function CaloriasTreino({ treino, onGuardar }) {
  const estimar = useCalorias()
  const { abrirPerfil } = usePesoCorporal()
  const resultado = estimar(treino)
  const estimativa = resultado.origem === 'relogio' ? estimar({ ...treino, calorias_kcal: null }) : resultado
  const [texto, setTexto] = useState(treino.calorias_kcal === null || treino.calorias_kcal === undefined ? '' : String(treino.calorias_kcal))
  const [explicacao, setExplicacao] = useState(false)
  const [erro, setErro] = useState('')

  async function guardar() {
    const limpo = texto.trim()
    const valor = limpo === '' ? null : Number(limpo)
    if (valor !== null && (!Number.isInteger(valor) || valor < 0 || valor > 20000)) {
      setErro('Escreve as calorias num número inteiro (ou deixa vazio para usar a estimativa).')
      return
    }
    setErro('')
    if (valor === (treino.calorias_kcal ?? null)) return
    const mensagem = await onGuardar({ calorias_kcal: valor })
    if (mensagem) setErro(mensagem)
  }

  return (
    <div className="cartao calorias">
      <div className="calorias-topo">
        <h2 className="com-icone">
          <Flame size={18} aria-hidden="true" />
          Calorias
        </h2>
        <button
          className="botao-icone botao-info"
          onClick={() => setExplicacao((e) => !e)}
          aria-expanded={explicacao}
          aria-label="O que é esta estimativa?"
        >
          <Info size={18} />
        </button>
      </div>
      {explicacao && <p className="nota sem-margem-topo">{EXPLICACAO_CALORIAS}</p>}

      <p className="calorias-valor">
        {textoKcal(resultado)}
        {resultado.origem === 'relogio' && <span className="etiqueta etiqueta-relogio">do relógio</span>}
      </p>

      {resultado.semPeso && (
        <p className="nota sem-margem-topo">
          Sem o teu peso não há estimativa.{' '}
          {abrirPerfil && (
            <button className="botao-link" onClick={abrirPerfil}>
              Registar o peso
            </button>
          )}
        </p>
      )}
      {resultado.origem === 'relogio' && estimativa.kcal !== null && (
        <p className="nota sem-margem-topo">A estimativa da app seria {textoKcal(estimativa)}.</p>
      )}

      {estimativa.partes.length > 0 && (
        <ul className="calorias-partes">
          {estimativa.partes.map((p) => (
            <li key={p.id}>
              <span>{nomeParte(p)}</span>
              <span className="calorias-partes-tempo">{formatarMinutos(Math.round(p.segundos / 60))}</span>
              <span className="calorias-partes-kcal">{formatarPeso(p.kcal)} kcal</span>
            </li>
          ))}
        </ul>
      )}

      <label className="campo-cardio calorias-relogio">
        <span>Calorias do relógio (opcional)</span>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Vazio = estimativa"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={guardar}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </label>
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}

// As calorias no cabeçalho do editor. Ao vivo, contam com o tempo até agora (atualiza a cada 15 s e
// sempre que se marca uma volta, porque o treino muda).
export function CaloriasEditor({ treino, aoVivo }) {
  const estimar = useCalorias()
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!aoVivo) return
    const id = setInterval(() => setAgora(Date.now()), 15000)
    return () => clearInterval(id)
  }, [aoVivo])

  const duracaoSeg = aoVivo ? Math.max(0, (agora - new Date(treino.data).getTime()) / 1000) : null
  const resultado = estimar(treino, duracaoSeg)
  return <Numero valor={textoKcal(resultado)} rotulo="Calorias" />
}
