# Testes da Galastri Ataula

## Comandos

Execute na raiz, com Node.js 22:

```sh
npm ci
npm run build
npm run test:unit
npm run test:props
npm test
npm run test:integration
npm run package:vsix
```

- `test:unit`: testes unitários, snapshot e regressões de bordas/documentos.
- `test:props`: 100 tabelas geradas com seed reproduzível, formatos ASCII e Unicode.
- `npm test`: suíte completa do motor, incluindo os arquivos de exemplos originais.
- `test:integration` / `test:e2e`: compila e abre o host de extensões real do VS Code com Mocha. Verifica criação, digitação, Enter, seleção, conversões, marcador de coluna e células mescladas. Requer interface gráfica; no Linux sem desktop, use `xvfb-run -a npm run test:integration`.
- `package:vsix`: compila e empacota; não publica em catálogos.

Os testes de propriedade e snapshot anteriores usavam uma assinatura incorreta do parser. Foram corrigidos para testar o formato real. O runner de integração agora transpila os testes com a dependência TypeScript existente, sem depender de `ts-node` ou de arquivos JavaScript desatualizados.

Os arquivos Playwright antigos permanecem no repositório como histórico; `test:e2e` usa os testes do host de extensões.

## Falha anterior preservada

O teste **should simulate Content Editing Case 34 correctly**, em `table-editing-integration.test.ts`, falha também no motor original do commit `882118cf1c23385d3d8d47bd897176782a77f482`.

Ao reconstruir uma tabela com múltiplas mesclagens verticais, o motor perde uma linha vazia: o resultado tem 15 linhas físicas, enquanto o exemplo espera 16. Isso não depende das bordas Unicode.

Os três arquivos protegidos `test_cell_contents_editing`, `test_selection` e `test_table_autoadjust` não foram modificados. A falha continua visível em `npm test`; não há teste ignorado nem alteração do resultado esperado.

No CI, a suíte completa gera relatório JSON e `scripts/check-test-baseline.cjs` aceita exclusivamente esse teste como falha anterior. Qualquer outra falha, interrupção ou perda de cobertura faz o job falhar. Os testes unitários, de propriedade e do editor não têm essa exceção.

## Validação da base 1.0.12

Validação completa executada pelo [GitHub Actions em 20/10/2026](https://github.com/andregalastri/Ataula/actions/runs/39482765348), no commit `1a4d9e896906449e8da6f924388b756da5f40ebc`:

- Instalação das dependências e compilação TypeScript passaram.
- 33 testes unitários passaram.
- Teste de propriedade com 100 tabelas geradas passou, nos formatos ASCII e Unicode.
- Suíte completa: 108 testes passaram; permanece apenas a falha anterior do caso 34, descrita acima.
- Os 8 testes no host real do VS Code passaram em Linux e Windows.
- VSIX gerado com sucesso: `ataula-personal-1.0.12.vsix`, aproximadamente 1,05 MB.

O CI agora gera o artefato `galastri-ataula-vsix` em pushes para `main`, somente depois que os jobs de testes passam. O artefato fica disponível por 7 dias. O workflow manual **Package personal VSIX** continua disponível.

A validação inicial em V8, antes da habilitação de Actions, também havia confirmado os 19 novos testes e reproduzido o mesmo resultado de 87/88 testes do motor original.

## Cobertura adicional da versão 1.0.13

- 13 testes unitários de prefixos, coordenadas e reconstrução manual de tabelas.
- 16 novos testes no host real para linguagens PHP/JavaScript/Python, multicursores nativos, seleção com Shift, comentários, citações, digitação, Enter, colagem, conversões e reformatação.
- A suíte completa contém 122 testes; a única exceção continua sendo o caso 34 original. Os testes unitários totalizam 46 casos.
- O instalador continua sendo `galastri-ataula.vsix`, com a versão interna 1.0.13.

## Cobertura adicional da versão 1.0.14

- 13 testes unitários de isolamento das grades, redimensionamento, células mescladas, criação e três níveis de aninhamento.
- 13 regressões no host real do VS Code para formatação, digitação, Enter, colagem nativa, Backspace, substituição de seleção, criação, reformatação, comentários e multicursores.
- A suíte completa contém 135 testes; a única exceção continua sendo o caso 34 original. Os testes unitários totalizam 59 casos.
- O instalador mantém o nome `galastri-ataula.vsix`, com versão interna 1.0.14.

## Cobertura adicional da versão 1.0.15

- 15 testes unitários de expansão, preservação de conteúdo e topologia, prefixos, mesclagens, limite da célula do pai, três níveis, CRLF e retorno ao ajuste normal.
- 9 testes adicionais no host real do VS Code: configuração, indentação/comentários, digitação, colagem, Backspace, Enter, aninhamento e comandos sem efeito fora da tabela ou além do limite.
- A suíte completa contém 150 testes; a única exceção continua sendo o caso 34 original. Os testes unitários totalizam 74 casos, e o host real contém 46 testes.
- O instalador mantém o nome `galastri-ataula.vsix`, com versão interna 1.0.15.

## Regras de edição

A edição de conteúdo deve preservar linhas, colunas e mesclagens. Alterações estruturais continuam dependendo do comando `ataula.tableTab`. Os arquivos `table_rules.md`, `.codexrules` e `AGENT_DOCS.md` continuam sendo as referências das regras originais.
