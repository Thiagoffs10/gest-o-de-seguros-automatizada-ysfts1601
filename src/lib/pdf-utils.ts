import logoImg from '@/assets/cred10mixlogooficialfundobranco4k-12574.jpg'
import { Policy } from '@/types'
import { formatDateDisplay } from '@/lib/utils'

export function generatePolicyPDF(policy: Policy) {
  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) return

  const fmt = (v?: number) =>
    (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const clientName = policy.expand?.client?.name || 'Cliente não informado'
  const seguradoraName =
    policy.expand?.seguradora?.nome || policy.insurance_company || 'Não informada'
  const startDate = policy.start_date ? formatDateDisplay(policy.start_date) : '-'
  const endDate = policy.end_date ? formatDateDisplay(policy.end_date) : '-'

  const html = `<!DOCTYPE html><html><head><title>Apólice ${policy.policy_number} - CRED10MIX CORRETORA DE SEGUROS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:30px;color:#1e293b}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:3px solid #2563eb;padding-bottom:16px}
.header-brand{display:flex;align-items:center;gap:16px}
.logo-box{background:#ffffff;padding:6px 12px;border:1px solid #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center}
.header-logo{height:54px;width:auto;object-fit:contain}
.header-titles h1{font-size:18px;color:#0f172a;font-weight:800;line-height:1.2}
.header-titles p{font-size:13px;color:#475569;margin-top:3px;font-weight:600}
.section{margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.section-title{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:12px;border-bottom:2px solid #3b82f6;padding-bottom:4px;display:inline-block}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.field-label{font-size:11px;color:#64748b;font-weight:600}
.field-value{font-size:13px;color:#0f172a;font-weight:700;margin-top:2px}
.footer{margin-top:40px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
</style></head><body>
<div class="header">
  <div class="header-brand">
    <div class="logo-box">
      <img src="${logoImg}" alt="CRED10MIX CORRETORA DE SEGUROS" class="header-logo" />
    </div>
    <div class="header-titles">
      <h1>CRED10MIX CORRETORA DE SEGUROS</h1>
      <p>Ficha Detalhada da Apólice nº ${policy.policy_number}</p>
    </div>
  </div>
</div>
<div class="section">
  <div class="section-title">Informações Gerais</div>
  <div class="grid">
    <div><div class="field-label">Cliente</div><div class="field-value">${clientName}</div></div>
    <div><div class="field-label">Seguradora</div><div class="field-value">${seguradoraName}</div></div>
    <div><div class="field-label">Ramo / Tipo</div><div class="field-value">${policy.tipo_de_seguro || policy.coverage_type || 'N/I'}</div></div>
    <div><div class="field-label">Status</div><div class="field-value">${policy.status}</div></div>
    <div><div class="field-label">Vigência</div><div class="field-value">${startDate} até ${endDate}</div></div>
    <div><div class="field-label">Prêmio Bruto</div><div class="field-value">R$ ${fmt(policy.valor_bruto || policy.premium_amount)}</div></div>
  </div>
</div>
<div class="footer">Documento emitido por CRED10MIX CORRETORA DE SEGUROS</div>
<script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
</body></html>`

  win.document.write(html)
  win.document.close()
}
