import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'

export interface PartnerReportEntry {
  clientName: string
  seguradoraName: string
  tipoSeguro: string
  valorLiquido: number
  repassePercent: number
  valorRepasse: number
  status: 'Pago' | 'Em aberto'
}

export interface PartnerReportInfo {
  nome: string
  cpf?: string
  telefone?: string
  email?: string
  dadosBancarios?: string
}

export interface PartnerReportData {
  partnerName: string
  partnerInfo?: PartnerReportInfo | null
  isAllPartners?: boolean
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

  const partnerHeader = data.isAllPartners
    ? `<div class="partner-header"><h2>Relatório de Comissões - Todos os Parceiros</h2></div>`
    : data.partnerInfo
      ? `<div class="partner-header">
        <h2>Dados do Parceiro</h2>
        <div class="partner-grid">
          <div class="partner-field"><span class="partner-label">Nome:</span> ${data.partnerInfo.nome}</div>
          ${data.partnerInfo.cpf ? `<div class="partner-field"><span class="partner-label">CPF:</span> ${data.partnerInfo.cpf}</div>` : ''}
          ${data.partnerInfo.telefone ? `<div class="partner-field"><span class="partner-label">Telefone:</span> ${data.partnerInfo.telefone}</div>` : ''}
          ${data.partnerInfo.email ? `<div class="partner-field"><span class="partner-label">E-mail:</span> ${data.partnerInfo.email}</div>` : ''}
          ${data.partnerInfo.dadosBancarios ? `<div class="partner-field"><span class="partner-label">Dados Bancários/PIX:</span> ${data.partnerInfo.dadosBancarios}</div>` : ''}
        </div>
      </div>`
      : `<div class="partner-header"><h2>${data.partnerName}</h2></div>`

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

  const html = `<!DOCTYPE html><html><head><title>Relatório de Comissões - CRED10MIX CORRETORA DE SEGUROS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:3px solid #2563eb;padding-bottom:16px}
.header-brand{display:flex;align-items:center;gap:16px}
.logo-box{background:#ffffff;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center}
.header-logo{height:54px;width:auto;object-fit:contain}
.header-titles h1{font-size:18px;color:#0f172a;font-weight:800;line-height:1.2;letter-spacing:-0.2px}
.header-titles p{font-size:13px;color:#475569;margin-top:3px;font-weight:600}
.header-meta{text-align:right}
.header-meta .date{font-size:12px;color:#64748b}
.header-meta .partner{font-size:14px;font-weight:bold;color:#2563eb;margin-top:4px}
.partner-header{margin-bottom:20px;padding:16px 20px;background:#f1f5f9;border-left:4px solid #2563eb;border-radius:6px}
.partner-header h2{font-size:16px;color:#1e293b;margin-bottom:10px}
.partner-grid{display:flex;flex-wrap:wrap;gap:6px 30px}
.partner-field{font-size:13px;color:#334155}
.partner-label{font-weight:600;color:#64748b;display:inline-block;min-width:140px}
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
  <div class="header-brand">
    <div class="logo-box">
      <img src="${logoImg}" alt="CRED10MIX CORRETORA DE SEGUROS" class="header-logo" />
    </div>
    <div class="header-titles">
      <h1>CRED10MIX CORRETORA DE SEGUROS</h1>
      <p>Relatório de Comissões de Parceiros</p>
    </div>
  </div>
  <div class="header-meta">
    <div class="date">Gerado em ${dateStr} às ${timeStr}</div>
    <div class="partner">${data.partnerName}</div>
  </div>
</div>
${partnerHeader}
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
<div class="footer">Documento gerado por CRED10MIX CORRETORA DE SEGUROS — Sistema de Gestão de Seguros</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
