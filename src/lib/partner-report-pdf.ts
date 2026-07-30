export interface PartnerReportEntry {
  clientName: string
  seguradoraName: string
  tipoSeguro: string
  valorLiquido: number
  repassePercent: number
  valorRepasse: number
  status: 'Pago' | 'Em aberto'
}

export interface PartnerReportData {
  partnerName: string
  generatedAt: Date
  entries: PartnerReportEntry[]
  totalPaid: number
  totalPending: number
}

export function generatePartnerReportPDF(data: PartnerReportData) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const dateStr = data.generatedAt.toLocaleDateString('pt-BR')
  const timeStr = data.generatedAt.toLocaleTimeString('pt-BR')

  const rows = data.entries
    .map(
      (e) => `<tr>
        <td>${e.clientName}</td>
        <td>${e.seguradoraName}</td>
        <td>${e.tipoSeguro}</td>
        <td class="right">R$ ${fmt(e.valorLiquido)}</td>
        <td class="center">${e.repassePercent}%</td>
        <td class="right">R$ ${fmt(e.valorRepasse)}</td>
        <td class="center"><span class="badge ${e.status === 'Pago' ? 'paid' : 'pending'}">${e.status}</span></td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><title>Relatório de Comissões de Parceiros</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}
.header{text-align:center;margin-bottom:24px;border-bottom:3px solid #2563eb;padding-bottom:16px}
.header h1{font-size:22px;color:#1e293b;margin-bottom:4px}
.header p{font-size:13px;color:#64748b}
.header .partner{font-size:15px;font-weight:bold;color:#2563eb;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1e293b;color:#fff;padding:8px 6px;text-align:left;font-weight:600}
td{padding:7px 6px;border-bottom:1px solid #e2e8f0}
td.right,th.right{text-align:right}
td.center,th.center{text-align:center}
tr:nth-child(even){background:#f8fafc}
.badge{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge.paid{background:#dcfce7;color:#166534}
.badge.pending{background:#fef3c7;color:#92400e}
.totals{margin-top:20px;display:flex;justify-content:flex-end;gap:20px}
.total-box{padding:12px 20px;border-radius:8px;text-align:center}
.total-box.paid{background:#dcfce7}
.total-box.pending{background:#fef3c7}
.total-box .label{font-size:12px;color:#475569}
.total-box .amount{font-size:20px;font-weight:bold;margin-top:4px}
.footer{margin-top:30px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
@media print{body{padding:15px}}
</style></head><body>
<div class="header">
<h1>Relatório de Comissões de Parceiros</h1>
<p>Gerado em ${dateStr} às ${timeStr}</p>
<p class="partner">${data.partnerName}</p>
</div>
<table>
<thead><tr>
<th>Nome</th><th>Seguradora</th><th>Tipo de Seguro</th>
<th class="right">Valor Líquido</th><th class="center">Percentual de Repasse</th>
<th class="right">Valor do Repasse</th><th class="center">Status</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="totals">
<div class="total-box paid"><div class="label">Total Pago</div><div class="amount">R$ ${fmt(data.totalPaid)}</div></div>
<div class="total-box pending"><div class="label">Total Em Aberto</div><div class="amount">R$ ${fmt(data.totalPending)}</div></div>
</div>
<div class="footer">Documento gerado por SeguroControl — Sistema de Gestão de Corretora de Seguros</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
