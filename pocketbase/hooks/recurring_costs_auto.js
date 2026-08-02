onRecordAfterCreateSuccess((e) => {
  const record = e.record
  if (!record.getBool('recorrente')) return e.next()

  const obs = record.getString('observacoes') || ''
  if (obs.includes('[Gerado automaticamente]')) return e.next()

  const freq = record.getString('frequencia_recorrencia')
  if (!freq) return e.next()

  let count = 0
  let stepMonths = 0

  if (freq === 'Mensal') {
    count = 11
    stepMonths = 1
  } else if (freq === 'Trimestral') {
    count = 3
    stepMonths = 3
  } else if (freq === 'Semestral') {
    count = 1
    stepMonths = 6
  } else if (freq === 'Anual') {
    count = 1
    stepMonths = 12
  }

  if (count === 0) return e.next()

  const baseDateStr = record.getString('data')
  if (!baseDateStr) return e.next()

  const baseDate = new Date(baseDateStr.split(' ')[0] + 'T12:00:00Z')
  const col = $app.findCollectionByNameOrId('custos_fixos')

  for (let i = 1; i <= count; i++) {
    const nextDate = new Date(baseDate)
    nextDate.setUTCMonth(nextDate.getUTCMonth() + i * stepMonths)
    const formattedDate = nextDate.toISOString().split('T')[0]

    const newRec = new Record(col)
    newRec.set('descricao', record.getString('descricao'))
    newRec.set('valor', record.getNumber('valor'))
    newRec.set('data', formattedDate)
    newRec.set('categoria', record.getString('categoria'))
    newRec.set('tipo', record.getString('tipo') || 'Fixo')
    newRec.set('pago', false)
    newRec.set('recorrente', true)
    newRec.set('frequencia_recorrencia', freq)
    newRec.set('observacoes', (obs ? obs + ' ' : '') + '[Gerado automaticamente]')

    try {
      $app.save(newRec)
    } catch (err) {
      $app.logger().error('Erro ao gerar custo recorrente automatico', 'error', String(err))
    }
  }

  return e.next()
}, 'custos_fixos')
