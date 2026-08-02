# CRED10MIX — Gestão de Seguros Automatizada

Sistema para controle e gestão de corretora de seguros, com registro de apólices, cadastro de clientes, gestão financeira, lembretes, alertas e automação de comunicações.

## Tecnologias

- **Frontend:** Vite, React, TypeScript, TailwindCSS, shadcn/ui
- **Backend:** Skip Cloud (PocketBase v0.36)
- **Banco de Dados:** SQLite (via PocketBase)

## Desenvolvimento

```bash
# Instalar dependências
pnpm install

# Rodar em desenvolvimento
pnpm dev

# Build de produção
pnpm build
```

## Funcionalidades

- Dashboard com métricas e indicadores
- Cadastro e gestão de clientes (PF/PJ)
- Registro e controle de apólices
- Gestão financeira (comissões, repasses, custos)
- Lembretes e alertas de renovação/aniversário
- Comunicação por e-mail e WhatsApp
- Envio de e-mails em massa (via Resend)
- Gestão de parceiros e seguradoras
- Pipeline de vendas
- Controle de usuários e permissões (roles)
- Exportação de carteira (CSV/Excel)

## Backup e Restauração

### Importante

A exportação de código via o botão `</>` (na plataforma Skip) contém **apenas o código e a estrutura** do projeto — **não inclui os dados atuais** do banco de dados. Para obter uma cópia completa de todos os registros, usuários, configurações e arquivos, utilize o recurso de **Backup Completo** descrito abaixo.

### Gerando o Backup Completo

1. Acesse o sistema com uma conta de administrador (role `Admin`).
2. No menu lateral, clique em **Backup**.
3. A página exibirá a data e hora atuais do sistema.
4. Clique no botão **Exportar Backup Completo**.
5. Aguarde a geração — o botão ficará desabilitado com um indicador de carregamento.
6. Ao concluir, um arquivo JSON será baixado automaticamente no formato `backup_YYYY-MM-DD_HHmm.json`.
7. A página exibirá um resumo com a quantidade de registros exportados por coleção.

O backup pode ser gerado **quantas vezes for necessário** enquanto a instância estiver ativa. Cada backup reflete sempre o estado atual dos dados no momento da exportação.

### Conteúdo do Backup

O arquivo JSON exportado contém:

- **metadata:** data/hora da exportação (`exported_at`), versão do formato e origem.
- **schema:** definições de todas as coleções (nomes de campos, tipos, regras de acesso e índices).
- **records:** todos os registros de cada coleção:
  - `users` — inclui `email`, `role`, `verified`, `tokenKey` e `passwordHash` (hash bcrypt, nunca a senha em texto plano).
  - `clients`, `policies`, `payments`, `reminders`, `communications`, `seguradoras`, `parceiros`, `custos_fixos`, `tipos_seguro` — todos os campos preservados exatamente.
  - Campos de arquivo (ex.: `avatar` de usuários) incluem o nome do arquivo armazenado e a URL completa para download.

### Baixando Arquivos Anexados

O backup inclui URLs para todos os arquivos anexados (ex.: avatar de usuários). Para baixá-los:

1. Abra o arquivo `backup_YYYY-MM-DD_HHmm.json` em um editor de texto ou leitor de JSON.
2. Localize os campos do tipo `file` (ex.: `avatar` em registros de `users`).
3. Cada campo de arquivo contém um objeto com `filename` e `url`:
   ```json
   "avatar": {
     "filename": "avatar_abc123.jpg",
     "url": "https://seu-dominio.com/api/files/users/RECORD_ID/avatar_abc123.jpg"
   }
   ```
4. Acesse cada URL no navegador ou use um script de download em massa para baixar todos os arquivos.
5. Salve os arquivos mantendo a estrutura de pastas: `storage/{collectionId}/{recordId}/{filename}`.

### Restaurando em uma Nova Instância PocketBase

#### 1. Criar as Coleções

Crie todas as coleções com os mesmos campos, tipos e regras de acesso definidos na seção `schema` do backup. Você pode:

- **Opção A:** Executar as migrations do projeto (`pocketbase/migrations/`) na nova instância.
- **Opção B:** Recriar manualmente cada coleção usando as definições de `schema` do JSON exportado.

#### 2. Importar os Registros

Para cada coleção no backup:

1. Leia os registros do JSON exportado.
2. Para cada registro, crie um novo registro na coleção correspondente da nova instância.
3. Para campos de relação (`relation`), insira o ID do registro relacionado conforme exportado.
4. Para campos `autodate` (`created`, `updated`), você pode preservar os valores originais ou deixar que a nova instância os gere automaticamente.

#### 3. Restaurar Usuários e Senhas

Para cada usuário no backup:

1. Crie o registro na coleção `users` da nova instância.
2. Defina o `email` e `role` conforme exportado.
3. Para restaurar a senha, atualize diretamente o campo `passwordHash` no banco de dados da nova instância:
   ```sql
   UPDATE users SET passwordHash = 'HASH_EXPORTADO' WHERE id = 'ID_DO_USUARIO';
   ```
4. Alternativamente, use o comando `pbcollection update` via API SDK para definir a senha diretamente.
5. Restaure também os campos `tokenKey` e `verified`.

#### 4. Re-upload de Arquivos

1. Baixe todos os arquivos usando as URLs do backup (veja seção anterior).
2. Faça upload de cada arquivo para o registro correspondente na nova instância.
3. O PocketBase armazenará os arquivos em `pb_data/storage/{collectionId}/{recordId}/` e atribuirá um novo nome de arquivo.
4. Atualize o campo do arquivo no registro com o novo nome gerado pelo PocketBase.

#### 5. Verificação

Após a restauração:

- Verifique se todas as coleções têm o número esperado de registros.
- Teste o login dos usuários com suas senhas originais.
- Confirme que as relações entre registros estão íntegras.
- Verifique se os arquivos anexados estão acessíveis.

### Notas

- O backup é **somente leitura** — nenhum dado é alterado, criado ou removido durante a exportação.
- Apenas administradores (role `Admin`) podem gerar o backup.
- O backup inclui **todas** as coleções, mesmo as vazias (com array de registros vazio).
- Recomenda-se gerar backups periodicamente e armazená-los em local seguro.
- O arquivo JSON pode ser grande dependendo do volume de dados — seja paciente ao abrir ou processar o arquivo.

## Licença

© CRED10MIX CORRETORA DE SEGUROS – Todos os direitos reservados.
