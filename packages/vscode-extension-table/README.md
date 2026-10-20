# Galastri Ataula

Versão pessoal de [Ataula, de Gerard FP](https://github.com/gerardfp/Ataula), com bordas simples de Unicode desenhadas diretamente durante a edição.

```text
┌────────────┬───────────────────┐
│ Componente │ Responsabilidade  │
├────────────┼───────────────────┤
│ Controller │ Processar pedidos │
└────────────┴───────────────────┘
```

As bordas fazem parte do texto salvo. A extensão mantém um único modo de edição e o ajuste automático de tamanho do Ataula. Células multilinha, mesclagens, seleção e comandos de estrutura continuam disponíveis. Não há largura máxima nem quebra automática de palavras nesta versão.

## Uso

Abra um arquivo Markdown, texto simples ou EduMark (`.md`, `.txt` ou `.edu`).

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
  "when": "editorTextFocus && (editorLangId == markdown || editorLangId == plaintext || editorLangId == edumark)"
}
```

Na renderização de Markdown, coloque a tabela em um **bloco de código** (`text`) para preservar espaços e alinhamento. Ela continua sendo texto; não se transforma em uma tabela HTML. Para obter uma tabela Markdown convencional, use **Converter tabela para Markdown**.

Use fonte monoespaçada. O cálculo de largura original conta unidades UTF-16; emojis, caracteres de largura dupla e fontes com medidas diferentes podem desalinhá-la.

## Instalação pessoal

A extensão tem o identificador `andregalastri.ataula-personal` e aparece como **Galastri Ataula**. Desinstale ou desative a Ataula original antes de usá-la: ambas registram os mesmos comandos.

No VS Code, abra Extensões → menu **…** → **Instalar do VSIX…** e selecione `galastri-ataula.vsix`. Também é possível usar:

```sh
code --install-extension galastri-ataula.vsix
```

O identificador próprio evita receber versões da extensão original. Atualizações desta versão pessoal são feitas instalando um novo VSIX.

## Créditos e licença

Baseado no [Ataula](https://github.com/gerardfp/Ataula), desenvolvido por Gerard FP. Adaptação pessoal de André Galastri. Licença **GPL-3.0-or-later**, preservada com os avisos e créditos do projeto original.
