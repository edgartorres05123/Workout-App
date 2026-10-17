import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from './supabase'
import { useAvisos } from './avisos'
import Confirmar from './Confirmar'
import Janela from './Janela'
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
  const avisar = useAvisos()

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
    avisar(medicao ? 'Medição atualizada' : 'Medição guardada')
    onGuardada(data)
  }

  async function apagar() {
    setAGravar(true)
    setErro('')
    const { error } = await supabase.from('medicoes').delete().eq('id', medicao.id)
    setAGravar(false)
    if (error) return setErro(error.message)
    avisar('Medição apagada')
    onApagada(medicao.id)
  }

  return (
    <>
    <Janela titulo={medicao ? 'Editar medição' : 'Nova medição'} onFechar={onFechar}>
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

          {medicao && (
            <button type="button" className="botao-perigo com-icone" onClick={() => setConfirmarApagar(true)}>
              <Trash2 size={18} />
              Apagar medição
            </button>
          )}
        </form>
    </Janela>

      {confirmarApagar && (
        <Confirmar
          titulo="Apagar medição?"
          textoConfirmar="Apagar medição"
          aProcessar={aGravar}
          onConfirmar={apagar}
          onCancelar={() => setConfirmarApagar(false)}
        >
          <p>
            A medição de {formatarDataExtenso(dataDeChave(medicao.data)).toLowerCase()} será apagada. Não é possível
            desfazer.
          </p>
          {erro && <p className="erro">{erro}</p>}
        </Confirmar>
      )}
    </>
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
