# Instalador pessoal e Intranet

Esta versão não é publicada no Marketplace nem no Open VSX. Não precisa de conta de publisher, token de publicação ou catálogo próprio.

## Gerar o VSIX

Com Node.js 22 e npm, na raiz do repositório:

```sh
npm ci
npm run package:vsix
```

Resultado: `packages/vscode-extension-table/ataula-personal-1.0.12.vsix`.

Alternativa: **GitHub → Actions → Package personal VSIX → Run workflow**. Ao terminar, baixe e extraia o artefato `galastri-ataula-vsix`. Forks podem precisar habilitar Actions na primeira vez.

O workflow automático **Validate Galastri Ataula** também gera o mesmo artefato após os testes de alterações em `main`. Abra a execução bem-sucedida e baixe **galastri-ataula-vsix** em **Artifacts**. Esse arquivo fica disponível por 7 dias; copie-o para a Intranet se precisar guardá-lo por mais tempo.

## Instalar

1. Desinstale ou desative a extensão Ataula original para evitar conflito de comandos.
2. No VS Code, abra Extensões → **…** → **Instalar do VSIX…**.
3. Escolha o arquivo e recarregue a janela se solicitado.

Pelo terminal:

```sh
code --install-extension ataula-personal-1.0.12.vsix
```

A identificação é `andregalastri.ataula-personal`, com nome visível **Galastri Ataula**. Ela não recebe as atualizações do Ataula original.

## Disponibilizar na Intranet

Copie o VSIX para uma pasta servida pelo seu servidor HTTP interno e crie um link de download na página da Intranet. O usuário baixa o arquivo e segue a instalação acima. Não é necessário montar um servidor de extensões do VS Code.

O servidor e seu endereço serão definidos na instalação da Intranet; este repositório apenas prepara o instalador e as instruções. Nenhum servidor foi configurado automaticamente.

Para atualizar, aumente a versão em `packages/vscode-extension-table/package.json`, atualize o lockfile com `npm install --package-lock-only`, gere outro VSIX e substitua o link interno. A instalação da nova versão também é manual.

Mantenha o arquivo LICENSE e os créditos no pacote. A licença do projeto continua sendo GPL-3.0-or-later.
