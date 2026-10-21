# Alterações

## 1.0.14

- Blocos e tabelas aninhados com as mesmas bordas simples Unicode.
- Edição do bloco mais interno sob o cursor, com redimensionamento dos blocos externos.
- Criação de tabelas dentro de células usando `|RxC` ou `|-` e o comando de estrutura existente.
- Reformatação recursiva, sem transformar as divisórias internas em colunas externas.
- Regressões para digitação, Enter, colagem, Backspace, seleção, comentários e múltiplos níveis.

## 1.0.13

- Funcionamento em qualquer linguagem ou extensão de arquivo.
- Tabelas em citações e comentários, com preservação de prefixos e indentação.
- Remoção da navegação própria, das seleções automáticas e da interferência em multicursores.
- Comando Refazer formatação (Ctrl + Alt + F) para recalcular larguras e corrigir padding.
- Regressões para comentários PHP, citações, cursores nativos, Enter, colagem e conversões.

## 1.0.12 — Galastri Ataula

- Nome visível Galastri Ataula; identificador pessoal andregalastri.ataula-personal.
- Bordas simples Unicode gravadas diretamente no texto durante a edição.
- Leitura de tabelas ASCII e Unicode, com junções ajustadas a células mescladas.
- Comandos ataula.* e conversão para Markdown convencional preservados.
- Empacotamento em VSIX e workflow manual sem publicação em catálogos.
- Testes específicos de bordas, adaptação de documentos e integração no VS Code.
