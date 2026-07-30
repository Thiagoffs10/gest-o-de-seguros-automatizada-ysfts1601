export interface ReceiptData {
  clientName: string
  seguradoraName: string
  policyNumber: string
  valorLiquido: number
  repassePercent: number
  valorPagar: number
  partnerName?: string
}

export function generateReceiptPDF(data: ReceiptData) {
  const win = window.open('', '_blank', 'width=600,height=800')
  if (!win) return

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const html = `<!DOCTYPE html><html><head><title>Recibo de Repasse</title>
<style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}
h1{text-align:center;color:#1e293b;border-bottom:2px solid #2563eb;padding-bottom:10px}
.info{margin:20px 0}.info p{margin:8px 0;font-size:14px}
.label{font-weight:bold;color:#64748b;display:inline-block;width:220px}
.value{color:#1e293b}
.total{margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;text-align:center}
.total .amount{font-size:28px;font-weight:bold;color:#2563eb}
.footer{margin-top:40px;text-align:center;font-size:12px;color:#94a3b8}</style></head><body>
<h1>Recibo de Repasse de Comissão</h1>
<div class="info">
<p><span class="label">Nome do Cliente:</span><span class="value">${data.clientName}</span></p>
<p><span class="label">Seguradora:</span><span class="value">${data.seguradoraName}</span></p>
<p><span class="label">Número da Apólice:</span><span class="value">${data.policyNumber}</span></p>
<p><span class="label">Valor Líquido da Apólice:</span><span class="value">R$ ${fmt(data.valorLiquido)}</span></p>
<p><span class="label">Percentual de Repasse:</span><span class="value">${data.repassePercent}%</span></p>
${data.partnerName ? `<p><span class="label">Parceiro:</span><span class="value">${data.partnerName}</span></p>` : ''}
</div>
<div class="total">
<p class="label" style="display:block;width:auto;margin-bottom:8px">Valor a Pagar</p>
<p class="amount">R$ ${fmt(data.valorPagar)}</p>
</div>
<div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
