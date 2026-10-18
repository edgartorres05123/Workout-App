import IconeAtividade from './IconeAtividade'
import { INTENSIDADES, obterAtividade } from './atividades'
import { atividadeDoBloco, linhasCardio } from './blocos'
import { linhaFeita, resumoSessao, sessoesCardio, textoDistancia, textoRitmo } from './cardio'
import { formatarTempo } from './condicionamento'
import { formatarPeso } from './formatar'

const NOME_INTENSIDADE = Object.fromEntries(INTENSIDADES.map((i) => [i.id, i.nome]))

// Um bloco de cardio em modo de leitura (detalhe do treino): o resumo e cada intervalo com todos os campos
export default function CardioLeitura({ bloco, titulo }) {
  const atividadeId = atividadeDoBloco(bloco) ?? 'outra'
  const atividade = obterAtividade(atividadeId)
  const linhas = linhasCardio(bloco)
  const feitas = linhas.filter(linhaFeita)
  const [sessao] = sessoesCardio(feitas.map((l) => ({ ...l, bloco_id: bloco.id })))

  return (
    <div className="cartao bloco bloco-cardio">
      <div className="bloco-topo">
        <h2 className="etiqueta-bloco">
          <IconeAtividade atividade={atividadeId} />
          {titulo}
        </h2>
      </div>

      {feitas.length === 0 ? (
        <p className="nota sem-margem-topo">Nenhum intervalo feito.</p>
      ) : (
        <>
          {feitas.length > 1 && <p className="resultado-bloco sem-margem-topo">Total: {resumoSessao(sessao)}</p>}
          <ul className="series intervalos-leitura">
            {feitas.map((l, i) => {
              const partes = [formatarTempo(l.duracao_seg)]
              if (l.distancia_m) partes.push(textoDistancia(l.distancia_m, atividade.distancia ?? 'km'))
              if (l.velocidade_kmh && atividade.velocidade) partes.push(`${formatarPeso(Number(l.velocidade_kmh))} km/h`)
              const ritmo = atividade.ritmo !== 'kmh' && textoRitmo(atividadeId, l.duracao_seg, l.distancia_m)
              if (ritmo) partes.push(ritmo)
              if (l.inclinacao_pct !== null && l.inclinacao_pct !== undefined && atividade.inclinacao) {
                partes.push(`inclinação ${formatarPeso(Number(l.inclinacao_pct))}%`)
              }
              if (l.intensidade) partes.push(NOME_INTENSIDADE[l.intensidade] ?? l.intensidade)
              if (l.fc_media) partes.push(`FC ${l.fc_media}`)
              return (
                <li key={l.id}>
                  <span className="serie-num" aria-label={`Intervalo ${i + 1}`}>
                    {i + 1}
                  </span>
                  <span className="intervalo-leitura-textos">
                    <span className="serie-valor">{partes.join(' · ')}</span>
                    {l.notas && <span className="intervalo-leitura-notas">{l.notas}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {bloco.notas && <p className="nota">{bloco.notas}</p>}
    </div>
  )
}
