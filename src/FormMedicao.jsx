import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { CAMPOS_MEDICAO, validarMedicao } from './corpo'
import { chaveDia, formatarDataExtenso, pesoParaInput } from './formatar'
import { dataDeChave } from './estatisticas'

function valoresIniciais(medicao, hoje) {
  const valores = { data: medicao?.data ?? chaveDia(hoje), notas: medicao?.notas ?? '' }
  for (const campo of CAMPOS_MEDICAO) {
    const valor = medicao?.[campo.id]
    valores[campo.id] = valor === null || valor === undefined ? '' : pesoParaInput(valor)
  }
  return valores
}

// Janela (bottom sheet) para adicionar ou editar uma medição. medicao = null para uma nova.
export default function FormMedicao({ medicao, onGuardada, onApagada, onFechar }) {
  const [hoje] = useState(() => new Date())
  const [valores, setValores] = useState(() => valoresIniciais(medicao, hoje))
  const [erros, setErros] = useState({})
  const [erro, setErro] = useState('')
  const [aGravar, setAGravar] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)

  useEffect(() => {
    function teclaPremida(e) {
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', teclaPremida)
    return () => window.removeEventListener('keydown', teclaPremida)
  }, [onFechar])

  function mudar(campo, valor) {
    setValores((atuais) => ({ ...atuais, [campo]: valor }))
    if (erros[campo]) setErros(({ [campo]: _removido, ...resto }) => resto)
  }

  async function guardar(e) {
    e.preventDefault()
    setErro('')
    const { erros: novosErros, dados } = validarMedicao(valores, hoje)
    setErros(novosErros)
    const primeiro = Object.keys(novosErros)[0]
    if (primeiro) {
      document.getElementById(`medicao-${primeiro}`)?.focus()
      return
    }

    setAGravar(true)
    const consulta = medicao
      ? supabase.from('medicoes').update(dados).eq('id', medicao.id)
      : supabase.from('medicoes').insert(dados)
    const { data, error } = await consulta.select('*').single()
    setAGravar(false)
    if (error) return setErro(error.message)
    onGuardada(data)
  }

  async function apagar() {
    setAGravar(true)
    setErro('')
    const { error } = await supabase.from('medicoes').delete().eq('id', medicao.id)
    setAGravar(false)
    if (error) return setErro(error.message)
    onApagada(medicao.id)
  }

  return (
    <div className="sheet-fundo" onClick={onFechar}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={medicao ? 'Editar medição' : 'Nova medição'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-topo">
          <h2>{medicao ? 'Editar medição' : 'Nova medição'}</h2>
          <button className="botao-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>

        <form className="sheet-lista form-medicao" onSubmit={guardar} noValidate>
          <Campo id="data" rotulo="Data" erro={erros.data} obrigatorio>
            <input
              id="medicao-data"
              type="date"
              value={valores.data}
              max={chaveDia(hoje)}
              onChange={(e) => mudar('data', e.target.value)}
            />
          </Campo>

          {CAMPOS_MEDICAO.map((campo) => (
            <Campo key={campo.id} id={campo.id} rotulo={campo.nome} erro={erros[campo.id]} obrigatorio={campo.obrigatorio}>
              <input
                id={`medicao-${campo.id}`}
                type="text"
                inputMode={campo.inteiro ? 'numeric' : 'decimal'}
                value={valores[campo.id]}
                onChange={(e) => mudar(campo.id, e.target.value)}
              />
            </Campo>
          ))}

          <Campo id="notas" rotulo="Notas">
            <textarea
              id="medicao-notas"
              rows={3}
              value={valores.notas}
              onChange={(e) => mudar('notas', e.target.value)}
            />
          </Campo>

          {Object.keys(erros).length > 0 && <p className="erro">Corrige os campos assinalados.</p>}
          {erro && <p className="erro">{erro}</p>}

          <button type="submit" disabled={aGravar}>
            {aGravar ? 'A gravar...' : medicao ? 'Guardar alterações' : 'Guardar medição'}
          </button>

          {medicao &&
            (confirmarApagar ? (
              <div className="confirmacao-inline">
                <p>
                  Apagar a medição de {formatarDataExtenso(dataDeChave(medicao.data)).toLowerCase()}?
                  Não é possível desfazer.
                </p>
                <button type="button" className="botao-perigo-cheio" onClick={apagar} disabled={aGravar}>
                  Apagar medição
                </button>
                <button type="button" className="botao-secundario" onClick={() => setConfirmarApagar(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" className="botao-perigo" onClick={() => setConfirmarApagar(true)}>
                Apagar medição
              </button>
            ))}
        </form>
      </div>
    </div>
  )
}

function Campo({ id, rotulo, erro, obrigatorio = false, children }) {
  return (
    <label className={erro ? 'campo campo-com-erro' : 'campo'} htmlFor={`medicao-${id}`}>
      <span className="campo-rotulo">
        {rotulo}
        {obrigatorio && <span className="obrigatorio"> *</span>}
      </span>
      {children}
      {erro && <span className="campo-erro">{erro}</span>}
    </label>
  )
}
