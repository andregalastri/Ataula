# Galastri Ataula

Versão pessoal de [Ataula, de Gerard FP](https://github.com/gerardfp/Ataula), com bordas simples de Unicode desenhadas diretamente durante a edição.

```text
┌────────────┬───────────────────┐
│ Componente │ Responsabilidade  │
├────────────┼───────────────────┤
│ Controller │ Processar pedidos │
└────────────┴───────────────────┘
```

As bordas fazem parte do texto salvo. A extensão mantém um único modo de edição e o ajuste automático de tamanho do Ataula. Células multilinha, mesclagens, seleção manual de conteúdo e comandos de estrutura continuam disponíveis. A navegação e as seleções automáticas da tabela foram removidas; os atalhos de setas e multicursores pertencem ao VS Code. Não há largura máxima nem quebra automática de palavras nesta versão.

> Agentes: não modificar `test_cell_contents_editing`, `test_selection` ou `test_table_autoadjust` sem autorização explícita. Preserve as regras de edição de `table_rules.md`.

## Uso

Funciona em qualquer arquivo de texto, incluindo PHP, JavaScript, Python, Markdown e arquivos sem extensão.

- Para criar uma tabela vazia, digite `|2x3` (duas linhas e três colunas), deixe o cursor após o número e execute **Galastri Ataula: Aplicar alterações na estrutura da tabela**. `|-` continua sendo o atalho de criação simples.
- Digite dentro das células: a extensão ajusta a largura das colunas como no Ataula original.
- **Enter** insere uma linha física dentro da célula.
- Alterações na estrutura continuam usando os marcadores ASCII do Ataula (`-` e `|`) e o comando `ataula.tableTab`.
- A formatação de documento converte tabelas geométricas ASCII existentes para bordas simples. As conversões entre Markdown e Ataula continuam na paleta de comandos.
- Os identificadores `ataula.*` foram mantidos. Seu atalho personalizado permanece válido.

O atalho original de estrutura usa `oem_5`, cuja tecla varia conforme o teclado. Para usar **Ctrl + \\**, adicione ao `keybindings.json`:

```json
{
  "key": "ctrl+oem_5",
  "command": "ataula.tableTab",
  "when": "editorTextFocus"
}
```

Na renderização de Markdown, coloque a tabela em um **bloco de código** (`text`) para preservar espaços e alinhamento. Ela continua sendo texto; não se transforma em uma tabela HTML. Para obter uma tabela Markdown convencional, use **Converter tabela para Markdown**.

Use fonte monoespaçada. O cálculo de largura original conta unidades UTF-16; emojis, caracteres de largura dupla e fontes com medidas diferentes podem desalinhá-la.

## Refazer formatação e editar em comentários

Com o cursor na tabela, use **Galastri Ataula: Refazer formatação** na paleta de comandos ou **Ctrl + Alt + F** (macOS: Cmd + Alt + Shift + F). O comando recalcula larguras, realinha o conteúdo à esquerda e remove o preenchimento excedente. Ele atua somente na tabela atual, sem precisar convertê-la para Markdown.

As bordas podem ter indentação ou prefixos de comentário/citação: `>`, `*`, `//`, `#` e `--`. Os prefixos são mantidos durante a edição, ao pressionar Enter, nas conversões e na reformatação. Por exemplo, uma tabela dentro de um comentário PHP pode ter ` * ` antes de cada linha, entre as linhas de abertura `/*` e fechamento `*/`.

**Ctrl + Alt + ↑/↓**, Shift + setas e seleções retangulares usam o comportamento nativo do VS Code. Durante a digitação com vários cursores, a extensão não reposiciona seleções nem reformata automaticamente; para ajustar as bordas depois, deixe um único cursor na tabela e execute **Refazer formatação**.

## Blocos e tabelas aninhados

Uma célula pode conter texto e outras tabelas de borda simples. Ao editar uma tabela interna, apenas suas células são reorganizadas; os blocos externos ajustam o tamanho para acomodá-la.

Para criar uma tabela interna, deixe uma linha da célula contendo apenas `|2x2` (ou `|-`) e execute o comando de estrutura, usando seu atalho habitual. O cursor vai para a primeira célula da nova tabela. O mesmo procedimento funciona em mais níveis de aninhamento.

**Refazer formatação** atua na tabela mais interna sob o cursor e ajusta os blocos que a contêm. Com o cursor no texto externo, reformata o bloco externo e suas tabelas internas. Digitação, Enter, colagem e exclusão preservam os níveis de aninhamento; os prefixos de comentários e citações continuam disponíveis.

## Instalação pessoal

A extensão tem o identificador `andregalastri.ataula-personal` e aparece como **Galastri Ataula**. Desinstale ou desative a Ataula original antes de usá-la: ambas registram os mesmos comandos.

No VS Code, abra Extensões → menu **…** → **Instalar do VSIX…** e selecione `galastri-ataula.vsix`. Também é possível usar:

```sh
code --install-extension galastri-ataula.vsix
```

O identificador próprio evita receber versões da extensão original. Atualizações desta versão pessoal são feitas instalando um novo VSIX.

## Créditos e licença

Baseado no [Ataula](https://github.com/gerardfp/Ataula), desenvolvido por Gerard FP. Adaptação pessoal de André Galastri. Licença **GPL-3.0-or-later**, preservada com os avisos e créditos do projeto original.

## Compilar e gerar o instalador

Requisitos: **Node.js 22 LTS**, npm e Git. Execute a partir da raiz:

```sh
git clone https://github.com/andregalastri/Ataula.git
cd Ataula
npm ci
npm run package:vsix
```

O pacote é criado em `packages/vscode-extension-table/galastri-ataula.vsix`. Nenhum comando publica a extensão em um catálogo.

O workflow **Validate Galastri Ataula** também gera o artefato **galastri-ataula-vsix** após os testes de cada alteração em `main`; ele fica disponível por 7 dias.

Também há o workflow manual **Package personal VSIX**, em **Actions**. Se o GitHub mantiver Actions desativado no fork, habilite-o antes. O workflow compila, executa testes e disponibiliza o instalador como artefato do workflow; não cria uma publicação no Marketplace nem no Open VSX.

Veja [instalação e Intranet](publish.md) e [testes e limitações conhecidas](TESTING.md).

## Estrutura

- `packages/shared`: tipos compartilhados.
- `packages/table-engine`: parser, formatação e desenho das bordas.
- `packages/vscode-extension-table`: integração com o editor.
