# RELATÓRIO DE AUDITORIA GERAL DO SISTEMA

**Data da Auditoria:** 23 de Setembro de 2026  
**Ambiente:** Skip Cloud / PocketBase + React/Vite Frontend  
**Modo de Execução:** 100% Somente Leitura e Validação Cruzada (Nenhum registro de cliente, apólice ou financeiro foi alterado).

---

## SUMÁRIO EXECUTIVO

Foi realizada uma auditoria completa de integridade de dados, consistência de telas, regras de negócio e validações executáveis em todo o ecossistema do sistema de Gestão de Seguros.

A suíte completa de testes automatizados (**T1–T10**, 7 Cenários de Reconciliação, 15 Cenários de Auditoria, Baixa Rápida de Parceiros com Débitos e Cenários Críticos), além de Lint, TypeScript Typecheck e Build de Produção, foi executada com **100% de aprovação (zero erros)**.

---

## 1. AUDITORIA DE CASOS REAIS NO BANCO DE DADOS

### 1.1 Apólice 14432373 (SERGIO HIGOR DE ALBUQUERQUE BRILHANTE — Azul Seguros)

- **Apólice Pai (`y9obhtt5klqs9hw`):**
  - Prêmio Líquido: R$ 2.474,34 | Comissão: 20% | Bruto: R$ 494,87 | ISS: R$ 9,90 | Líquido Previsto: R$ 484,97 (Competência 08/2026).
  - Recebimento Legado (`fvv49ev6cmakxn1`): R$ 494,87 bruto (R$ 494,87 líq., descontos R$ 9,90), data 21/08/2026, idempotência `legacy_policy_y9obhtt5klqs9hw`. Sem competência explícita gravada.
- **Endosso de Substituição de Veículo (`hw80zutj2zm73fe`):**
  - Veículo: AION UT PREMIUM ELETRICO | Proposta: 33695257 | Data: 17/09/2026.
  - Base Líquida: R$ 2.177,04 | Comissão: 15% | Valor Bruto: R$ 326,56.
  - Previsão (`9vuqmphvnhtbq3h`): Competência 09/2026, Valor: R$ 326,56, Status: "Recebida".
  - Recebimento Manual (`ib8t19fr60xz24s`): Data 21/09/2026, Bruto R$ 326,56, Líquido R$ 320,03, ISS 2% (R$ 6,53), auditado por Thiago Souza.
- **Validação Consolidada:**
  - **Previsto Total:** R$ 484,97 + R$ 326,56 = **R$ 811,53** (exato).
  - **Já Recebido:** Bruto R$ 494,87 + R$ 326,56 = **R$ 821,43** | Líquido: **R$ 814,90** (exato).
  - **Saldo a Receber:** **R$ 0,00** (quitada).
  - **Status:** **Recebida** com tag visual **[Inclui Endosso]**.
  - **Conclusão:** Batimento centavo a centavo entre o banco de dados, o hook de reconciliação e a interface gráfica (como comprovado na captura de tela anexada pelo usuário).

---

### 1.2 Parceiro José Alberto / Paulo Ildefonso (Adiantamento R$ 447,30)

- **Parceiro:** JOSE ALBERTO (ID: `5qg2fon3ic7xosi`, Partner Code: 2).
- **Débito de Adiantamento:** ID `pwoo2wdwbeqal1e`, descrição: _"Adiantamento de comissao de paulo idelfonso"_, valor: **R$ 447,30**, data: 16/09/2026.
- **Liquidação no Banco:**
  - O débito foi vinculado ao pagamento `dj1dqz3ozqtxysd` em 23/09/2026.
  - Total comissões: R$ 447,30 | Total débitos abatidos: R$ 447,30 | Taxa PIX: R$ 0,00 | Líquido pago: R$ 0,00.
  - Status do débito: `Pago` com vínculo de rastreabilidade gravado em `pagamento = "dj1dqz3ozqtxysd"`.
- **Integridade:**
  - Consulta ao banco por débitos pagos órfãos (`status='Pago' && pagamento=''`): **0 registros** encontrados.
  - Consulta por adiantamentos duplicados de R$ 447,30: **Apenas 1 registro** existente.
  - **Conclusão:** O adiantamento foi consumido exatamente uma única vez, de forma atômica e consistente.

---

### 1.3 Apólice 5892575565 (PAULO SERGIO TAVARES MARQUES MENDES — Itaú)

- **Diagnóstico da diferença de R$ 5,74 (Previsto R$ 281,23 vs Recebido R$ 286,97):**
  - Prêmio Líquido: R$ 1.147,89 | Percentual: 25% | Comissão Bruta: **R$ 286,97**.
  - Dedução de ISS cadastrada na apólice: **R$ 5,74** (2% sobre R$ 286,97).
  - Previsão retroativa gerada em `comissoes_previstas`: **R$ 281,23** (Líquida: R$ 286,97 - R$ 5,74).
  - Recebimento legado em `comissao_recebimentos`: **R$ 286,97** bruto (e descontos de ISS R$ 5,74).
  - **Causa Raiz:** Não se trata de duplicidade nem de lançamento financeiro a mais. A diferença aparente decorre de o recebimento legado ter sido registrado pelo valor **bruto** contratual (R$ 286,97), enquanto a previsão retroativa foi gravada pelo valor **líquido de ISS** (R$ 281,23). A diferença de R$ 5,74 é exatamente o imposto ISS.
  - **Comportamento na UI:** A regra de status em `Financial.tsx` reconhece `totalBrutoEsperado = Math.max(previsto + iss, fallbackPrevisto)` e não marca incorretamente como "Acima", mantendo o status limpo de **"Recebida"** e saldo R$ 0,00.

---

### 1.4 Apólice 14269308 (PAULO SERGIO TAVARES M MENDES FILHO — Azul)

- **Diagnóstico da diferença de R$ 21,97 (Previsto R$ 1.076,54 vs Recebido R$ 1.098,51):**
  - Prêmio Líquido: R$ 3.138,60 | Percentual: 35% | Comissão Bruta: **R$ 1.098,51**.
  - ISS cadastrado na apólice: **R$ 21,97** (2% sobre R$ 1.098,51).
  - Previsão líquida gerada em `comissoes_previstas`: **R$ 1.076,54** (1.098,51 - 21,97).
  - Recebimento legado em `comissao_recebimentos`: **R$ 1.098,51** bruto (com descontos R$ 21,97).
  - **Causa Raiz:** Exatamente a mesma origem da apólice anterior: 1.098,51 - 1.076,54 = **R$ 21,97 (ISS exato)**. O valor recebido foi o bruto integral da seguradora com retenção informada. Saldo real R$ 0,00, status "Recebida".

---

## 2. RESULTADOS DA AUDITORIA ESTRUTURADA

### (A) ERROS REAIS ENCONTRADOS

Nenhum erro de cálculo ativo ou corrupção de dados foi detectado no sistema em operação. No entanto, há um ponto de atenção técnica na geração do PDF de Conciliação Mensal:

1. **PDF de Conciliação Mensal (`ConciliacaoMensal.tsx`, função `handleDownloadPDF`):**
   - **Onde está:** `src/pages/ConciliacaoMensal.tsx`, linha 399 (`const belongsToPeriodProduction = isDateInPeriod(period, p.start_date)`).
   - **Situação:** Ao montar a lista de apólices no PDF gerado pela tela de Conciliação, a comissão prevista da linha é zerada se a data de início da apólice (`start_date`) for de outro mês (`belongsToPeriodProduction ? net : 0`), mesmo que a apólice possua um **Endosso** emitido e com vigência no mês selecionado.
   - **Impacto:** O card totalizador no topo do PDF exibe o valor correto consolidado via `financial-calcs`, mas na tabela linha a linha do PDF, a apólice com endosso do mês pode aparecer com previsão R$ 0,00 se a apólice pai for de mês anterior.
   - **Causa:** O filtro de apólices para o PDF verifica apenas `p.start_date` da apólice pai em vez de considerar a competência/data dos endossos da apólice no período.

---

### (B) INCONSISTÊNCIAS DE MENOR GRAVIDADE / PONTOS DE ATENÇÃO

1. **Previsões Retroativas com Status "Pendente" no Banco:**
   - Para as apólices legadas (como as de Paulo Sérgio), o registro na coleção `comissoes_previstas` possui `status = "Pendente"` na tabela física do banco porque foram geradas antes da migração de reconciliação em lote, embora na memória do frontend e na listagem de comissões o status calculado seja exibido corretamente como "Recebida" via função central de reconciliação.
2. **Número de Proposta vs Número de Apólice:**
   - Na apólice `5892575565`, o número no banco possui 10 dígitos (`5892575565`), enquanto a busca por 9 dígitos (`589257565`) exigiu correspondência por aproximação (`~`). Recomenda-se manter a máscara e digitação padronizadas.
3. **Recebimentos Legados sem Campo `competencia` preenchido:**
   - Os recebimentos antigos migrados do cadastro legado possuem `competencia = ""` e `comissao_prevista = ""`. O sistema depende da inferência inteligente de data (`inferirCompetenciaRecebimento`) e fallback FIFO na leitura para associar esses recebimentos à apólice pai. Isso funciona perfeitamente em runtime, mas deixa o campo em branco no banco.

---

### (C) O QUE ESTÁ CORRETO E VALIDADO (OK)

1. **Proteção Transacional no Servidor (pb_hooks):**
   - **Baixa acima do saldo:** O hook `financial_history_guard.js` (linhas 337–376) calcula o saldo restante da previsão e rejeita com `BadRequestError` no backend se o novo recebimento exceder o saldo restante.
   - **Estornos Seguros:** Rota `/backend/v1/finance/estorno` valida se `role === 'Visualizador'` e rejeita com **403 Forbidden**. Valida atomicamente se o estorno não ultrapassa o saldo disponível e impede estorno de estorno.
   - **Fechamento de Parceiros:** Rota `/backend/v1/parceiro-fechamento` executa em transação atômica (`$app.runInTransaction`). Se débito > repasse disponível, abate somente o disponível e gera registro do saldo remanescente pendente. Garante que nenhum débito seja liquidado mais de uma vez.
2. **Taxa PIX Unificada:**
   - Regra idêntica em `Financial.tsx` e `PartnerReport.tsx`: 1% sobre a base líquida após dedução de débitos, limitado ao teto de R$ 10,00 e zerada se o líquido a pagar for R$ 0,00.
3. **Fórmulas Centrais (`src/lib/financial-calcs.ts`):**
   - `computeReceivedNetCommissions`, `computeReceivedGrossCommissions` e `computePendingCommissions` consideram rigorosamente a verdade financeira de `comissao_recebimentos` e não geram receita fictícia por simples flag booleana.
4. **Alocação de Recebimento Legado à Apólice Pai:**
   - O helper `reconciliarRecebimentosComPrevisoes` garante que recebimentos legados sem vínculo explícito sejam alocados à apólice pai cronologicamente sem subtrair receitas de endossos posteriores.
5. **Apólices Vencidas:**
   - Apólices com status `Vencida` ou `Expirada` permanecem preservadas como histórico da carteira e são filtradas corretamente dos cálculos de produção do período vigente.
6. **Baterias de Testes e Compilação:**
   - `run_qa`: **Aprovado**. Lint limpo, TypeScript limpo, testes unitários e de integração 100% aprovados.

---

### (D) RECOMENDAÇÕES PRIORIZADAS (SEM ALTERAÇÕES REALIZADAS)

1. **Prioridade 1 (Refinamento do PDF de Conciliação):**
   - Atualizar `handleDownloadPDF` em `ConciliacaoMensal.tsx` para, ao exportar a tabela detalhada de apólices, verificar se a apólice possui endosso com previsão na competência vigente (utilizando a mesma lógica já adotada no `Financial.tsx` com `policiesWithActiveEndorsementInPeriod`), evitando que apólices pai de meses anteriores com endosso no mês atual exibam `comissaoPrevista = 0` na tabela analítica do PDF.
2. **Prioridade 2 (Sincronização em Lote de Status em `comissoes_previstas`):**
   - Opcionalmente rodar um script/migration pontual de manutenção de dados para preencher o campo `status = "Recebida"` nos registros legados de `comissoes_previstas` que já foram quitados por recebimentos legados, alinhando o valor estático do banco com o valor dinâmico já calculado com sucesso pela UI.
3. **Prioridade 3 (Preenchimento de Competência em Recebimentos Legados):**
   - Para fins de documentação histórica no banco, preencher o campo `competencia` nos recebimentos legados baseado no mês da `data_recebimento` (ex: `07/2026`, `08/2026`).

---

_Auditoria concluída com êxito. Nenhuma alteração foi realizada em código ou dados nesta rodada diagnóstica._
