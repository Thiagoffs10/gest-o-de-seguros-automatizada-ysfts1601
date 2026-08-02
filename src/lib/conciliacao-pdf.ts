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
  dataFechamento: string
  usuarioFechamento: string
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

  const html = `<!DOCTYPE html><html><head><title>Conciliação Mensal - ${mesNome}/${data.ano}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:3px solid #2563eb;padding-bottom:16px}
.header-brand{display:flex;align-items:center;gap:16px}
.logo-box{background:#fff;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px}
.header-logo{height:54px;width:auto;object-fit:contain}
.section{margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.section-title{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:12px;border-bottom:2px solid #3b82f6;padding-bottom:4px;display:inline-block}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
.row:last-child{border:none}
.row .label{color:#64748b;font-weight:600}
.row .value{font-weight:700;color:#0f172a}
.profit{background:#eff6ff;border:2px solid #2563eb;padding:12px;border-radius:8px;margin-top:8px}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
</style></head><body>
<div class="header">
  <div class="header-brand">
    <div class="logo-box"><img src="${logoImg}" alt="Logo" class="header-logo" /></div>
    <div><h1 style="font-size:18px;font-weight:800;color:#0f172a">CRED10MIX CORRETORA DE SEGUROS</h1>
    <p style="font-size:13px;color:#475569;font-weight:600">Fechamento Mensal — ${mesNome} ${data.ano}</p></div>
  </div>
</div>
<div class="section"><div class="section-title">Produção</div>
  <div class="row"><span class="label">Total de Apólices</span><span class="value">${data.totalApolices}</span></div>
  <div class="row"><span class="label">Comissão Prevista</span><span class="value">R$ ${fmt(data.comissaoPrevista)}</span></div>
</div>
<div class="section"><div class="section-title">Comissões</div>
  <div class="row"><span class="label">Previstas</span><span class="value">R$ ${fmt(data.comissaoPrevista)}</span></div>
  <div class="row"><span class="label">Recebidas</span><span class="value">R$ ${fmt(data.comissaoRecebida)}</span></div>
  <div class="row"><span class="label">Pendentes</span><span class="value">R$ ${fmt(data.comissaoPendente)}</span></div>
</div>
<div class="section"><div class="section-title">Repasses</div>
  <div class="row"><span class="label">Pagos</span><span class="value">R$ ${fmt(data.repassesPagos)}</span></div>
  <div class="row"><span class="label">Pendentes</span><span class="value">R$ ${fmt(data.repassesPendentes)}</span></div>
</div>
<div class="section"><div class="section-title">Custos</div>
  <div class="row"><span class="label">Pagos</span><span class="value">R$ ${fmt(data.custosPagos)}</span></div>
  <div class="row"><span class="label">Pendentes</span><span class="value">R$ ${fmt(data.custosPendentes)}</span></div>
</div>
<div class="section"><div class="section-title">Resultado</div>
  <div class="row"><span class="label">Lucro Previsto</span><span class="value">R$ ${fmt(data.lucroPrevisto)}</span></div>
  <div class="profit"><div class="row" style="border:none"><span class="label" style="font-size:15px">Lucro Real</span><span class="value" style="font-size:18px;color:#2563eb">R$ ${fmt(data.lucroReal)}</span></div></div>
</div>
<div class="section"><div class="section-title">Pendências no Fechamento</div><ul style="padding-left:20px;font-size:13px">${pendenciasHtml}</ul></div>
<div class="footer">
  <p>Fecha em ${new Date(data.dataFechamento).toLocaleString('pt-BR')} por ${data.usuarioFechamento}</p>
  <p>Documento gerado por CRED10MIX CORRETORA DE SEGUROS — Sistema de Gestão de Seguros</p>
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
