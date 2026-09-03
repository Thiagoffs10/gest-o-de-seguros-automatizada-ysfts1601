import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'

export interface ConciliacaoReportData {
  mes: number
  ano: number
  totalApolices: number
  comissaoPrevista: number
  comissaoRecebida: number
  comissaoPendente: number
  repassesPagos: number
  repassesPendentes: number
  custosPagos: number
  custosPendentes: number
  lucroPrevisto: number
  lucroReal: number
  pendencias: string[]
  dataFechamento?: string
  usuarioFechamento?: string
  policies?: {
    clienteNome: string
    seguradoraNome: string
    parceiroNome?: string
    tipoSeguro: string
    numeroApolice: string
    valorLiquido: number
    comissaoPrevista: number
    comissaoRecebida: number
    statusComissao: 'Recebida' | 'Pendente'
    dataRecebimento?: string
  }[]
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function generateConciliacaoPDF(data: ConciliacaoReportData) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const mesNome = MONTH_NAMES[data.mes - 1] || ''
  const pendenciasHtml =
    data.pendencias.length > 0
      ? data.pendencias.map((p) => `<li>${p}</li>`).join('')
      : '<li>Nenhuma pendência registrada</li>'

  const now = new Date()
  const dataGeracao = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`
  const dataFechamentoInfo = data.dataFechamento
    ? `<p style="font-size:11px;color:#64748b;margin-top:2px">Fechado em: ${new Date(data.dataFechamento).toLocaleString('pt-BR')}${data.usuarioFechamento ? ` por ${data.usuarioFechamento}` : ''}</p>`
    : ''

  const tableRows =
    data.policies && data.policies.length > 0
      ? data.policies
          .map(
            (p) => `<tr>
        <td style="font-weight:600;color:#0f172a">${p.clienteNome}</td>
        <td>${p.seguradoraNome}</td>
        <td>${p.parceiroNome || '-'}</td>
        <td style="text-align:right">R$ ${fmt(p.comissaoPrevista)}</td>
        <td style="text-align:right">R$ ${fmt(p.comissaoRecebida)}</td>
        <td style="text-align:center"><span class="badge ${p.statusComissao === 'Recebida' ? 'paid' : 'pending'}">${p.statusComissao}</span></td>
      </tr>`,
          )
          .join('')
      : `<tr><td colspan="6" style="text-align:center;padding:12px;color:#94a3b8">Nenhuma apólice cadastrada neste mês</td></tr>`

  const html = `<!DOCTYPE html><html><head><title>Relatório de Conciliação Mensal - ${mesNome}/${data.ano}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b;background:#fff}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:3px solid #2563eb;padding-bottom:14px}
.header-brand{display:flex;align-items:center;gap:14px}
.logo-box{background:#fff;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center}
.header-logo{height:52px;width:auto;object-fit:contain}
.header-meta{text-align:right;font-size:12px;color:#64748b}
.header-meta strong{color:#0f172a}

.section{margin-bottom:18px}
.section-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;border-left:3px solid #2563eb;padding-left:8px}

.cards-grid{display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;margin-bottom:16px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px}
.card-label{font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px}
.card-value{font-size:15px;font-weight:700;color:#0f172a}
.card-value.green{color:#16a34a}
.card-value.amber{color:#d97706}
.card-value.blue{color:#2563eb}
.card-value.red{color:#dc2626}

.summary-box{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:18px}
.summary-table{width:100%;border-collapse:collapse;font-size:12px}
.summary-table td{padding:5px 0;border-bottom:1px solid #e2e8f0}
.summary-table tr:last-child td{border-bottom:none}
.summary-table .label{color:#475569;font-weight:600}
.summary-table .val{text-align:right;font-weight:700;color:#0f172a}

table.data-table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:18px}
table.data-table th{background:#1e293b;color:#fff;padding:7px 8px;text-align:left;font-weight:600}
table.data-table td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
table.data-table tr:nth-child(even){background:#f8fafc}
.badge{padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;display:inline-block}
.badge.paid{background:#dcfce7;color:#166534}
.badge.pending{background:#fef3c7;color:#92400e}

.footer{margin-top:30px;border-top:1px solid #cbd5e1;padding-top:14px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b}
.footer-contacts{display:flex;gap:16px}
.footer-contacts span{display:inline-flex;align-items:center;gap:4px}
.footer-brand strong{color:#0f172a}

@media print{
  body{padding:15px}
  .cards-grid{grid-template-columns:repeat(4, 1fr)}
}
</style></head><body>

<div class="header">
  <div class="header-brand">
    <div class="logo-box"><img src="${logoImg}" alt="Logo" class="header-logo" /></div>
    <div>
      <h1 style="font-size:18px;font-weight:800;color:#0f172a">CRED10MIX CORRETORA DE SEGUROS</h1>
      <p style="font-size:13px;color:#475569;font-weight:600">Relatório de Conciliação Mensal — ${mesNome}/${data.ano}</p>
      ${dataFechamentoInfo}
    </div>
  </div>
  <div class="header-meta">
    <div>Gerado em: <strong>${dataGeracao}</strong></div>
    <div>Mês de Competência: <strong>${mesNome}/${data.ano}</strong></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Resumo Financeiro da Conciliação</div>
  <div class="cards-grid">
    <div class="card">
      <div class="card-label">Comissões Previstas</div>
      <div class="card-value">R$ ${fmt(data.comissaoPrevista)}</div>
    </div>
    <div class="card">
      <div class="card-label">Comissões Recebidas</div>
      <div class="card-value green">R$ ${fmt(data.comissaoRecebida)}</div>
    </div>
    <div class="card">
      <div class="card-label">Comissões Pendentes</div>
      <div class="card-value ${data.comissaoPendente > 0 ? 'amber' : ''}">R$ ${fmt(data.comissaoPendente)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total de Apólices</div>
      <div class="card-value">${data.totalApolices}</div>
    </div>
  </div>

  <div class="summary-box">
    <table class="summary-table">
      <tbody>
        <tr>
          <td class="label">Total Comissões Previstas:</td>
          <td class="val">R$ ${fmt(data.comissaoPrevista)}</td>
        </tr>
        <tr>
          <td class="label">Total Comissões Recebidas (Receita):</td>
          <td class="val" style="color:#16a34a">R$ ${fmt(data.comissaoRecebida)}</td>
        </tr>
        <tr>
          <td class="label">Total Comissões Pendentes do Mês:</td>
          <td class="val" style="color:${data.comissaoPendente > 0 ? '#d97706' : '#64748b'}">R$ ${fmt(data.comissaoPendente)}</td>
        </tr>
        <tr>
          <td class="label">(-) Repasses Pagos a Parceiros:</td>
          <td class="val" style="color:#dc2626">- R$ ${fmt(data.repassesPagos)}</td>
        </tr>
        <tr>
          <td class="label">Repasses Pendentes a Parceiros:</td>
          <td class="val" style="color:#64748b">R$ ${fmt(data.repassesPendentes)}</td>
        </tr>
        <tr>
          <td class="label">(-) Custos Pagos:</td>
          <td class="val" style="color:#dc2626">- R$ ${fmt(data.custosPagos)}</td>
        </tr>
        <tr>
          <td class="label">Custos Pendentes:</td>
          <td class="val" style="color:#64748b">R$ ${fmt(data.custosPendentes)}</td>
        </tr>
        <tr style="background:#eff6ff">
          <td class="label" style="font-size:14px;color:#1e293b;padding-top:8px"><strong>Resultado Líquido do Mês (Lucro Real):</strong></td>
          <td class="val" style="font-size:16px;color:#2563eb;padding-top:8px"><strong>R$ ${fmt(data.lucroReal)}</strong></td>
        </tr>
        <tr>
          <td class="label" style="font-size:11px;color:#64748b">Lucro Previsto Estimado:</td>
          <td class="val" style="font-size:11px;color:#64748b">R$ ${fmt(data.lucroPrevisto)}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<div class="section">
  <div class="section-title">Comissões do Mês (${mesNome}/${data.ano})</div>
  <table class="data-table">
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Seguradora</th>
        <th>Parceiro</th>
        <th style="text-align:right">Comissão Prevista</th>
        <th style="text-align:right">Comissão Recebida</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</div>

${
  data.pendencias && data.pendencias.length > 0
    ? `<div class="section" style="margin-top:14px">
        <div class="section-title">Pendências Identificadas no Mês</div>
        <ul style="padding-left:20px;font-size:11px;color:#b45309;line-height:1.6">
          ${pendenciasHtml}
        </ul>
      </div>`
    : ''
}

<div class="footer">
  <div class="footer-brand">
    <strong>CRED10MIX CORRETORA DE SEGUROS</strong> — CNPJ & Gestão Automatizada
  </div>
  <div class="footer-contacts">
    <span>🌐 www.cred10mix.com.br</span>
    <span>📸 @cred10mix</span>
    <span>📱 WhatsApp: (81) 98865-3534</span>
  </div>
</div>

<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
