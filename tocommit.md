# Resolve Merge Conflicts upstream/main
Data: 2026-05-11
Tamanho: medio

## Sumario
Resolução de conflitos de merge da branch upstream/main mantendo as modificações locais (ex: otimizador Rose, AdvancedJob/AdvancedConfigEditor, e formatação do JobLossGraph) e adicionando as novas funcionalidades da versão mais recente (ex: uPlot no JobLossGraph e otimizador Automagic2).

## Mudanças

### correcao - toolkit/optimizer.py
- Resolvido conflito de merge preservando a opção do otimizador local `Rose` e a opção nova `Automagic2`.

### correcao - ui/src/app/jobs/new/SimpleJob.tsx
- Mantido o layout com botões auxiliares para o otimizador `Rose` e adicionada a opção `Automagic2` da nova versão.

### correcao - ui/src/app/jobs/new/page.tsx
- Integrado o novo componente `AdvancedConfigEditor` no lugar do `AdvancedJob` local, mas mantendo a estrutura de layout e wrapper com overflow desenvolvida localmente.

### correcao - ui/src/components/AdvancedConfigEditor.tsx
- Renomeado de `AdvancedJob.tsx` para `AdvancedConfigEditor.tsx` pela nova versão, resolvendo conflitos nas importações do Monaco e mantendo a chamada local de configuração `configureMonaco()`.

### correcao - ui/src/components/JobLossGraph.tsx
- Mesclado o novo sistema de renderização usando `uPlot` com a formatação e configuração de escala de Learning Rate locais. A escala LR separada (lado direito) e em notação científica foi preservada e adaptada ao `uPlot`.