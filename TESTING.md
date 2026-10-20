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

## Validação desta implementação

O ambiente de edição não disponibilizou terminal Node/npm. A validação disponível executou a lógica JavaScript em V8 com um adaptador de testes:

- Motor original: 87 de 88 testes passaram; falhou somente o caso 34 acima.
- Motor com as alterações: os mesmos 87 testes passaram, com a mesma falha anterior.
- 14 novos testes de bordas passaram, incluindo 25 combinações de tamanho de grade.
- 200 verificações de ida e volta em tabelas geradas também passaram.
- 5 testes do adaptador de documento/geometria passaram, inclusive com objetos congelados como os da API do VS Code.

Essa execução não substitui a compilação TypeScript nem os testes dentro do VS Code real. Esses testes foram preparados para o CI e para execução local. A geração do VSIX exige uma dessas execuções.

## Regras de edição

A edição de conteúdo deve preservar linhas, colunas e mesclagens. Alterações estruturais continuam dependendo do comando `ataula.tableTab`. Os arquivos `table_rules.md`, `.codexrules` e `AGENT_DOCS.md` continuam sendo as referências das regras originais.
