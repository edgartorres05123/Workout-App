import { useState } from 'react'
import { DURACAO_AMRAP_INICIAL, INTERVALO_EMOM_INICIAL } from './condicionamento'
import { lerNumero } from './formatar'

const paraMinutos = (segundos) => (segundos ? String(Math.round((segundos / 60) * 100) / 100).replace('.', ',') : '')

// Configuração de um bloco de condicionamento (grava ao sair de cada campo):
//   circuito: limite de tempo opcional (duracao_seg); amrap: tempo limite (duracao_seg);
//   emom: duração de cada intervalo (intervalo_seg) e, com mostrarIntervalos, o número de intervalos (voltas).
// valores: { voltas, duracao_seg, intervalo_seg }; onMudar(campos) devolve uma mensagem de erro, ou null.
export default function ConfigBloco({ tipo, valores, mostrarIntervalos = false, onMudar }) {
  const [minutos, setMinutos] = useState(paraMinutos(valores.duracao_seg))
  const [intervalo, setIntervalo] = useState(String(valores.intervalo_seg ?? INTERVALO_EMOM_INICIAL))
  const [intervalos, setIntervalos] = useState(String(valores.voltas ?? 10))
  const [erro, setErro] = useState('')

  async function mudar(campos, repor) {
    const mensagem = await onMudar(campos)
    setErro(mensagem ?? '')
    if (mensagem) repor()
  }

  function guardarMinutos() {
    const texto = minutos.trim()
    const opcional = tipo === 'circuito'
    if (texto === '' && opcional) {
      if (valores.duracao_seg !== null && valores.duracao_seg !== undefined) mudar({ duracao_seg: null }, () => {})
      return setErro('')
    }
    const valor = lerNumero(texto)
    if (valor === null || valor <= 0 || valor > 600) {
      setErro(opcional ? 'Indica o limite em minutos (por exemplo, 20), ou deixa vazio.' : 'Indica o tempo em minutos (por exemplo, 12).')
      setMinutos(paraMinutos(valores.duracao_seg ?? (opcional ? null : DURACAO_AMRAP_INICIAL)))
      return
    }
    const segundos = Math.round(valor * 60)
    setErro('')
    if (segundos !== valores.duracao_seg) {
      mudar({ duracao_seg: segundos }, () => setMinutos(paraMinutos(valores.duracao_seg)))
    }
  }

  function guardarIntervalo() {
    const valor = Number(intervalo.trim())
    if (!Number.isInteger(valor) || valor < 10 || valor > 600) {
      setErro('O intervalo tem de ser um número inteiro de segundos, entre 10 e 600.')
      setIntervalo(String(valores.intervalo_seg ?? INTERVALO_EMOM_INICIAL))
      return
    }
    setErro('')
    if (valor !== valores.intervalo_seg) mudar({ intervalo_seg: valor }, () => setIntervalo(String(valores.intervalo_seg)))
  }

  function guardarIntervalos() {
    const valor = Number(intervalos.trim())
    if (!Number.isInteger(valor) || valor < 1 || valor > 120) {
      setErro('Os intervalos têm de ser um número inteiro, entre 1 e 120.')
      setIntervalos(String(valores.voltas))
      return
    }
    setErro('')
    if (valor !== valores.voltas) mudar({ voltas: valor }, () => setIntervalos(String(valores.voltas)))
  }

  if (!['circuito', 'amrap', 'emom'].includes(tipo)) return null
  const sairComEnter = (e) => e.key === 'Enter' && e.currentTarget.blur()

  return (
    <>
      <div className="alvos config-bloco">
        {tipo !== 'emom' && (
          <label>
            <span>{tipo === 'amrap' ? 'Tempo limite (min)' : 'Limite de tempo (min, opcional)'}</span>
            <input
              type="text"
              inputMode="decimal"
              value={minutos}
              placeholder={tipo === 'amrap' ? '10' : '—'}
              onChange={(e) => setMinutos(e.target.value)}
              onBlur={guardarMinutos}
              onKeyDown={sairComEnter}
            />
          </label>
        )}
        {tipo === 'emom' && (
          <label>
            <span>Cada intervalo (s)</span>
            <input
              type="text"
              inputMode="numeric"
              value={intervalo}
              onChange={(e) => setIntervalo(e.target.value)}
              onBlur={guardarIntervalo}
              onKeyDown={sairComEnter}
            />
          </label>
        )}
        {tipo === 'emom' && mostrarIntervalos && (
          <label>
            <span>Intervalos</span>
            <input
              type="text"
              inputMode="numeric"
              value={intervalos}
              onChange={(e) => setIntervalos(e.target.value)}
              onBlur={guardarIntervalos}
              onKeyDown={sairComEnter}
            />
          </label>
        )}
      </div>
      {erro && <p className="erro">{erro}</p>}
    </>
  )
}
