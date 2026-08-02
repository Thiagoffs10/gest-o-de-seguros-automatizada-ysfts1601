onRecordAfterCreateSuccess((e) => {
  const rec = e.record
  const isRecorrente = rec.get('recorrente')
  if (!isRecorrente) return e.next()

  const frequencia = rec.getString('frequencia_recorrencia')
  if (!frequencia) return e.next()

  const avancoMap = { Mensal: 1, Trimestral: 3, Semestral: 6, Anual: 12 }
  const avanco = avancoMap[frequencia]
  if (!avanco) return e.next()

  const col = $app.findCollectionByNameOrId('custos_fixos')
  const dataOriginal = rec.getString('data').split(' ')[0]
  const d = new Date(dataOriginal + 'T00:00:00')

  for (let i = 1; i <= 12; i++) {
    const novaData = new Date(d.getTime())
    novaData.setMonth(novaData.getMonth() + avanco * i)
    const dataStr =
      novaData.getFullYear() +
      '-' +
      String(novaData.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(novaData.getDate()).padStart(2, '0')

    const novo = new Record(col)
    novo.set('descricao', rec.getString('descricao'))
    novo.set('valor', rec.get('valor'))
    novo.set('data', dataStr)
    novo.set('categoria', rec.getString('categoria'))
    novo.set('observacoes', rec.getString('observacoes'))
    novo.set('tipo', rec.getString('tipo') || 'Fixo')
    novo.set('pago', false)
    novo.set('recorrente', false)
    $app.save(novo)
  }

  return e.next()
}, 'custos_fixos')
