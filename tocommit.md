# Criação do Recurso de Mesclagem Universal de LoRAs (Merger)
Data: 2026-05-20
Tamanho: medio

## Sumário
Implementação de um novo módulo e página de interface do usuário para mesclar múltiplos modelos LoRAs (.safetensors) de forma universal e interativa. Utiliza o script de mesclagem integrado, fornecendo inputs para configurar nome do arquivo, pesos/força das LoRAs individuais, tipo de dado (dtype) e dispositivo de processamento (CPU/GPU) com saída de logs em tempo real.

## Mudanças

### implementação - Frontend UI & API
- **ui/src/app/api/files/safetensors/route.ts**:
  - Nova rota GET para escanear recursivamente e listar todos os arquivos `.safetensors` na pasta de treinamento do usuário.
- **ui/src/app/merger/page.tsx**:
  - Nova página (em inglês, conforme solicitado pelo usuário) com o formulário de parametrização e listagem das LoRAs selecionadas com seus respectivos pesos.
  - Integração do componente de logs para monitoramento em tempo real da execução do script `merge_loras.py`.
- **ui/src/components/Sidebar.tsx**:
  - Adição da aba "Merger" no menu lateral responsivo, localizada logo abaixo da aba "Datasets", utilizando o ícone `GitMerge`.

---

# Resolução de Conflitos e Merge Upstream
Data: 2026-05-20
Tamanho: pequeno

## Sumário
Resolução dos conflitos de mesclagem (merge conflicts) resultantes da integração da branch remota `upstream/main` à branch local. As modificações mantiveram as funcionalidades exclusivas da versão HEX MOD (como presets de jobs e subtítulo estilizado na barra lateral) adaptando-as à nova estrutura responsiva e estilizações da interface atualizada.

## Mudanças

### correção - Frontend UI
- **ui/src/app/jobs/new/page.tsx**:
  - Resolução de conflitos de merge na barra de cabeçalho da página de novos jobs.
  - Preservação de todos os botões e seletores de presets de treinamento da versão HEX MOD.
  - Adaptação do contêiner do botão de visualização avançada para utilizar as novas classes responsivas de espaçamento (`pr-1 sm:pr-2 flex-shrink-0`) da branch upstream.
- **ui/src/components/Sidebar.tsx**:
  - Resolução de conflitos de merge na barra lateral de navegação.
  - Incorporação do subtítulo distintivo "HEX MOD" e do componente de logo no novo layout responsivo com suporte a dispositivos móveis (`sidebarContent`).
  - Preservação da lógica e comportamento de abertura/fechamento do menu em telas menores.
