import { useId } from 'react'
import { INTENSIDADES, obterAtividade } from './atividades'
import { lerDistancia, lerDuracao, textoRitmo } from './cardio'

// Os campos de um intervalo de cardio (controlados por quem os usa; ver editarCampo em cardio.js).
// estado: { valores, editados }; calculado: o campo de duração/distância/velocidade que foi calculado
// (outro estilo). onMudar(campo, texto); onSair(): ao sair de um campo (para gravar, se já estiver feito).
export default function CamposCardio({ atividadeId, estado, calculado, onMudar, onSair, desativado = false }) {
  const id = useId()
  const atividade = obterAtividade(atividadeId)
  const { valores } = estado
  const unidade = atividade.distancia
  const ritmo = unidade
    ? textoRitmo(atividadeId, lerDuracao(valores.duracao), lerDistancia(valores.distancia, unidade))
    : null
  const sairComEnter = (e) => e.key === 'Enter' && e.currentTarget.blur()
  const campo = (nome, rotulo, props = {}) => (
    <label className={calculado === nome ? 'campo-cardio calculado' : 'campo-cardio'}>
      <span>
        {rotulo}
        {calculado === nome && <span className="campo-cardio-calculado"> · calculado</span>}
      </span>
      <input
        type="text"
        value={valores[nome]}
        onChange={(e) => onMudar(nome, e.target.value)}
        onBlur={onSair}
        onKeyDown={sairComEnter}
        disabled={desativado}
        {...props}
      />
    </label>
  )

  return (
    <div className="campos-cardio">
      <div className="campos-cardio-linha">
        {campo('duracao', 'Duração', { inputMode: 'numeric', placeholder: 'mm:ss' })}
        {unidade && campo('distancia', `Distância (${unidade})`, { inputMode: 'decimal', placeholder: unidade === 'm' ? '400' : '5,0' })}
        {unidade && atividade.velocidade && campo('velocidade', 'Velocidade (km/h)', { inputMode: 'decimal', placeholder: '—' })}
      </div>
      {ritmo && (
        <p className="ritmo-cardio">
          {atividade.ritmo === 'kmh' ? 'Velocidade média' : 'Ritmo'}: <strong>{ritmo}</strong>
        </p>
      )}

      <div className="campos-cardio-linha">
        {atividade.inclinacao && campo('inclinacao', 'Inclinação (%)', { inputMode: 'decimal', placeholder: '0' })}
        {campo('fc', 'FC média (opcional)', { inputMode: 'numeric', placeholder: 'bpm' })}
      </div>

      <div className="intensidade" role="group" aria-labelledby={`${id}-intensidade`}>
        <span id={`${id}-intensidade`} className="intensidade-rotulo">
          Intensidade{atividade.intensidade === 'opcional' ? ' (opcional)' : ''}
        </span>
        <div className="intensidade-opcoes">
          {INTENSIDADES.map((i) => (
            <button
              key={i.id}
              type="button"
              className={valores.intensidade === i.id ? 'filtro ativo' : 'filtro'}
              aria-pressed={valores.intensidade === i.id}
              onClick={() => onMudar('intensidade', valores.intensidade === i.id ? '' : i.id)}
              onBlur={onSair}
              disabled={desativado}
            >
              {i.nome}
            </button>
          ))}
        </div>
      </div>

      <label className="campo-cardio campo-cardio-notas">
        <span>{atividadeId === 'outra' ? 'Que atividade? (e notas)' : 'Notas'}</span>
        <input
          type="text"
          value={valores.notas}
          placeholder={atividadeId === 'outra' ? 'Ex: Remo no rio' : 'Opcional'}
          onChange={(e) => onMudar('notas', e.target.value)}
          onBlur={onSair}
          onKeyDown={sairComEnter}
          disabled={desativado}
        />
      </label>
    </div>
  )
}
