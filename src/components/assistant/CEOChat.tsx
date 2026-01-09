import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Bot, User, Sparkles, Play, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: PendingAction[];
  actionsExecuted?: boolean;
}

interface PendingAction {
  type: string;
  title?: string;
  description?: string;
  area?: string;
  payload?: Record<string, unknown>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/chat`;
const EXECUTE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-ceo/execute`;

// Parse actions from AI response - comprehensive patterns
function parseActionsFromResponse(content: string): PendingAction[] {
  const actions: PendingAction[] = [];
  
  // Helper to extract quoted or unquoted values
  const quotePattern = `["'""]([^"'""]+)["'""]`;

  // ============ STRUCTURED ACTION DETECTION ============
  // Detect structured responses like:
  // Ação: Criar Pedido
  // Cliente: DEIVIDI
  // Status: confirmado
  // Due Date: 2026-01-09
  // Valor Total: 7.00
  
  const actionBlockMatch = content.match(/Ação:\s*[`"']?([^`"'\n]+)[`"']?/i);
  if (actionBlockMatch) {
    const actionType = actionBlockMatch[1].toLowerCase().trim();
    
    // Extract common fields
    const clienteMatch = content.match(/Cliente:\s*[`"']?([^`"'\n]+)[`"']?/i);
    const statusMatch = content.match(/Status:\s*[`"']?([^`"'\n]+)[`"']?/i);
    const dueDateMatch = content.match(/Due\s*Date:\s*[`"']?([^`"'\n]+)[`"']?/i);
    const valorMatch = content.match(/Valor\s*(?:Total)?:\s*[`"']?R?\$?\s*([0-9.,]+)[`"']?/i);
    const descricaoMatch = content.match(/Descri[çc][aã]o:\s*[`"']?([^`"'\n]+)[`"']?/i);
    const tituloMatch = content.match(/T[ií]tulo:\s*[`"']?([^`"'\n]+)[`"']?/i);
    const noMatch = content.match(/(?:N[oó]|Projeto):\s*[`"']?([^`"'\n]+)[`"']?/i);
    const tipoMatch = content.match(/Tipo:\s*[`"']?([^`"'\n]+)[`"']?/i);
    
    const parseValue = (v?: string) => {
      if (!v) return undefined;
      const normalized = v.replace(/\./g, '').replace(',', '.');
      const n = parseFloat(normalized);
      return isNaN(n) ? undefined : n;
    };
    
    // Create order
    if (actionType.includes('pedido') || actionType.includes('venda') || actionType.includes('order')) {
      actions.push({
        type: 'order_create',
        title: `Pedido para "${clienteMatch?.[1]?.trim() || 'Cliente'}"`,
        area: 'Projetos',
        payload: {
          customer_name: clienteMatch?.[1]?.trim(),
          status: statusMatch?.[1]?.trim().toLowerCase() || 'pendente',
          due_date: dueDateMatch?.[1]?.trim(),
          total_value: parseValue(valorMatch?.[1]),
        }
      });
    }
    
    // Create task
    else if (actionType.includes('tarefa') || actionType.includes('task')) {
      actions.push({
        type: 'task_create',
        title: tituloMatch?.[1]?.trim() || 'Nova tarefa',
        description: descricaoMatch?.[1]?.trim(),
        area: 'Projetos',
        payload: {
          title: tituloMatch?.[1]?.trim() || 'Nova tarefa',
          description: descricaoMatch?.[1]?.trim(),
          status: statusMatch?.[1]?.trim().toLowerCase() || 'pendente',
          _nodeName: noMatch?.[1]?.trim()
        }
      });
    }
    
    // Create financial entry
    else if (actionType.includes('lançamento') || actionType.includes('lancamento') || actionType.includes('pagamento') || actionType.includes('recebimento')) {
      const type = (tipoMatch?.[1]?.toLowerCase().includes('receber') || actionType.includes('receber')) ? 'receber' : 'pagar';
      actions.push({
        type: 'financial_create',
        title: `${type === 'receber' ? 'Receber' : 'Pagar'} R$ ${valorMatch?.[1] || '0'}`,
        area: 'Financeiro',
        payload: {
          value: parseValue(valorMatch?.[1]) || 0,
          description: descricaoMatch?.[1]?.trim() || 'Lançamento via CEO IA',
          type,
          due_date: dueDateMatch?.[1]?.trim()
        }
      });
    }
    
    // Create contact
    else if (actionType.includes('cliente') || actionType.includes('contato') || actionType.includes('fornecedor')) {
      const contactType = actionType.includes('fornecedor') ? 'supplier' : 'customer';
      actions.push({
        type: 'contact_create',
        title: `${contactType === 'supplier' ? 'Fornecedor' : 'Cliente'}: ${clienteMatch?.[1]?.trim() || tituloMatch?.[1]?.trim() || 'Novo'}`,
        area: 'Recursos',
        payload: {
          name: clienteMatch?.[1]?.trim() || tituloMatch?.[1]?.trim() || 'Novo contato',
          type: contactType
        }
      });
    }
    
    // Create node/project
    else if (actionType.includes('nó') || actionType.includes('no') || actionType.includes('projeto')) {
      actions.push({
        type: 'node_create',
        title: tituloMatch?.[1]?.trim() || noMatch?.[1]?.trim() || 'Novo projeto',
        area: 'Projetos',
        payload: {
          title: tituloMatch?.[1]?.trim() || noMatch?.[1]?.trim() || 'Novo projeto',
          color: 'bg-purple-100'
        }
      });
    }
  }

  // If structured detection found actions, return early
  if (actions.length > 0) {
    return actions;
  }
  
  // ============ TASKS ============
  
  // Create task: "criar tarefa X no nó Y"
  const taskCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?criar\\s+(?:a\\s+)?tarefa\\s+${quotePattern}(?:\\s+com\\s+(?:a\\s+)?descrição\\s+${quotePattern})?.*?(?:no|na)\\s+(?:nó|projeto)\\s+${quotePattern}`, 'i')
  );
  if (taskCreateMatch) {
    actions.push({
      type: 'task_create',
      title: taskCreateMatch[1]?.trim(),
      description: taskCreateMatch[2]?.trim(),
      area: 'Projetos',
      payload: { 
        title: taskCreateMatch[1]?.trim(), 
        description: taskCreateMatch[2]?.trim(),
        status: 'pendente',
        _nodeName: taskCreateMatch[3]?.trim()
      }
    });
  }
  
  // Update task status: "atualizar/alterar tarefa X para status Y" or "marcar tarefa X como Y"
  const taskUpdateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:atualizar|alterar|marcar|mudar)\\s+(?:a\\s+)?(?:tarefa|status\\s+d[ao])\\s+${quotePattern}\\s+(?:para|como)\\s+(?:status\\s+)?["'""]?(andamento|pendente|concluído|estrutural)["'""]?`, 'i')
  );
  if (taskUpdateMatch) {
    actions.push({
      type: 'task_update',
      title: `Atualizar "${taskUpdateMatch[1]}" → ${taskUpdateMatch[2]}`,
      area: 'Projetos',
      payload: { 
        _taskTitle: taskUpdateMatch[1]?.trim(),
        status: taskUpdateMatch[2]?.toLowerCase()
      }
    });
  }
  
  // Complete task: "concluir tarefa X"
  const taskCompleteMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:concluir|finalizar|completar)\\s+(?:a\\s+)?tarefa\\s+${quotePattern}`, 'i')
  );
  if (taskCompleteMatch) {
    actions.push({
      type: 'task_update',
      title: `Concluir "${taskCompleteMatch[1]}"`,
      area: 'Projetos',
      payload: { 
        _taskTitle: taskCompleteMatch[1]?.trim(),
        status: 'concluído',
        progress: 100
      }
    });
  }
  
  // Delete task: "excluir/deletar/remover tarefa X"
  const taskDeleteMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:excluir|deletar|remover)\\s+(?:a\\s+)?tarefa\\s+${quotePattern}`, 'i')
  );
  if (taskDeleteMatch) {
    actions.push({
      type: 'task_delete',
      title: `Excluir "${taskDeleteMatch[1]}"`,
      area: 'Projetos',
      payload: { _taskTitle: taskDeleteMatch[1]?.trim() }
    });
  }
  
  // ============ NODES ============
  
  // Create node: "criar nó/projeto X"
  const nodeCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?criar\\s+(?:o\\s+)?(?:nó|projeto)\\s+${quotePattern}`, 'i')
  );
  if (nodeCreateMatch && !taskCreateMatch) {
    actions.push({
      type: 'node_create',
      title: nodeCreateMatch[1]?.trim(),
      area: 'Projetos',
      payload: { title: nodeCreateMatch[1]?.trim(), color: 'bg-purple-100' }
    });
  }
  
  // ============ ORDERS ============
  
  // Create order: "criar pedido para cliente X com valor Y"
  const orderCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?criar\\s+(?:um\\s+)?(?:pedido|venda)\\s+(?:para\\s+(?:o\\s+)?(?:cliente\\s+)?)?${quotePattern}(?:.*?(?:valor|total)\\s+(?:de\\s+)?R?\\$?\\s*([\\d.,]+))?`, 'i')
  );
  if (orderCreateMatch) {
    const valueStr = orderCreateMatch[2]?.replace(/\./g, '').replace(',', '.');
    actions.push({
      type: 'order_create',
      title: `Pedido para "${orderCreateMatch[1]}"`,
      area: 'Projetos',
      payload: { 
        customer_name: orderCreateMatch[1]?.trim(),
        total_value: valueStr ? parseFloat(valueStr) : undefined,
        status: 'pendente'
      }
    });
  }
  
  // Update order status
  const orderUpdateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:atualizar|alterar|marcar|mudar)\\s+(?:o\\s+)?(?:pedido|status\\s+do\\s+pedido)\\s+(?:#)?(\\d+|${quotePattern})\\s+(?:para|como)\\s+["'""]?(pendente|confirmado|em_producao|pronto|entregue|cancelado)["'""]?`, 'i')
  );
  if (orderUpdateMatch) {
    const orderRef = orderUpdateMatch[1] || orderUpdateMatch[2];
    actions.push({
      type: 'order_update',
      title: `Pedido ${orderRef} → ${orderUpdateMatch[3] || orderUpdateMatch[2]}`,
      area: 'Projetos',
      payload: { 
        _orderNumber: orderRef?.trim(),
        status: (orderUpdateMatch[3] || orderUpdateMatch[2])?.toLowerCase()
      }
    });
  }
  
  // ============ FINANCIAL ============
  
  // Create financial entry (pagar/receber): "criar lançamento de X reais para Y"
  const financialCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:criar|lançar|registrar)\\s+(?:um\\s+)?(?:lançamento|conta|pagamento|recebimento)\\s+(?:a\\s+)?(?:pagar|receber)?\\s*(?:de\\s+)?R?\\$?\\s*([\\d.,]+)(?:.*?(?:para|de|referente)\\s+${quotePattern})?(?:.*?(?:vencimento|vence)\\s+(?:em\\s+)?(\\d{2}[/.-]\\d{2}[/.-]\\d{2,4}))?`, 'i')
  );
  if (financialCreateMatch) {
    const valueStr = financialCreateMatch[1]?.replace(/\./g, '').replace(',', '.');
    const type = content.toLowerCase().includes('receber') ? 'receber' : 'pagar';
    actions.push({
      type: 'financial_create',
      title: `${type === 'receber' ? 'Receber' : 'Pagar'} R$ ${financialCreateMatch[1]}`,
      area: 'Financeiro',
      payload: { 
        value: parseFloat(valueStr),
        description: financialCreateMatch[2]?.trim() || 'Lançamento via CEO IA',
        type,
        due_date: financialCreateMatch[3] // Will be parsed on backend
      }
    });
  }
  
  // Pay financial entry: "dar baixa/pagar lançamento X"
  const financialPayMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:dar\\s+baixa|pagar|quitar|liquidar)\\s+(?:no\\s+)?(?:lançamento|conta|pagamento)?\\s*${quotePattern}(?:.*?(?:valor|no\\s+valor)\\s+(?:de\\s+)?R?\\$?\\s*([\\d.,]+))?`, 'i')
  );
  if (financialPayMatch) {
    const valueStr = financialPayMatch[2]?.replace(/\./g, '').replace(',', '.');
    actions.push({
      type: 'financial_pay',
      title: `Baixa: "${financialPayMatch[1]}"`,
      area: 'Financeiro',
      payload: { 
        _entryDescription: financialPayMatch[1]?.trim(),
        value: valueStr ? parseFloat(valueStr) : undefined
      }
    });
  }
  
  // ============ CONTACTS ============
  
  // Create contact: "criar cliente/fornecedor X"
  const contactCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:criar|cadastrar|adicionar)\\s+(?:um\\s+)?(?:novo\\s+)?(?:cliente|fornecedor|contato)\\s+${quotePattern}`, 'i')
  );
  if (contactCreateMatch) {
    const contactType = content.toLowerCase().includes('fornecedor') ? 'fornecedor' : 'cliente';
    actions.push({
      type: 'contact_create',
      title: `${contactType === 'fornecedor' ? 'Fornecedor' : 'Cliente'}: "${contactCreateMatch[1]}"`,
      area: 'Financeiro',
      payload: { 
        name: contactCreateMatch[1]?.trim(),
        type: contactType
      }
    });
  }
  
  // ============ PRODUCTS ============
  
  // Create product: "criar produto X com preço Y"
  const productCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:criar|cadastrar|adicionar)\\s+(?:um\\s+)?(?:novo\\s+)?produto\\s+${quotePattern}(?:.*?(?:preço|valor|custo)\\s+(?:de\\s+)?R?\\$?\\s*([\\d.,]+))?`, 'i')
  );
  if (productCreateMatch) {
    const priceStr = productCreateMatch[2]?.replace(/\./g, '').replace(',', '.');
    actions.push({
      type: 'product_create',
      title: `Produto: "${productCreateMatch[1]}"`,
      area: 'Projetos',
      payload: { 
        name: productCreateMatch[1]?.trim(),
        sku: productCreateMatch[1]?.trim().toUpperCase().replace(/\s+/g, '-'),
        price: priceStr ? parseFloat(priceStr) : undefined
      }
    });
  }
  
  // ============ ROUTINE ============
  
  // Create routine block: "criar bloco de foco/rotina X"
  const routineCreateMatch = content.match(
    new RegExp(`(?:vou\\s+)?(?:criar|agendar|adicionar)\\s+(?:um\\s+)?(?:bloco\\s+(?:de\\s+)?)?(?:foco|rotina|pausa)\\s+${quotePattern}(?:.*?(\\d+)\\s*(?:min|minutos))?`, 'i')
  );
  if (routineCreateMatch) {
    const blockType = content.toLowerCase().includes('pausa') ? 'pausa' : 'foco';
    actions.push({
      type: 'routine_create',
      title: `Bloco: "${routineCreateMatch[1]}"`,
      area: 'Tempo',
      payload: { 
        title: routineCreateMatch[1]?.trim(),
        block_type: blockType,
        duration_minutes: routineCreateMatch[2] ? parseInt(routineCreateMatch[2]) : 25,
        date: new Date().toISOString().split('T')[0]
      }
    });
  }

  return actions;
}

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  content: '👋 Olá! Sou o CEO IA, seu assistente executivo. Posso ajudar com:\n\n• **Análise** de tarefas, finanças e agenda\n• **Criar, editar ou excluir** qualquer item do sistema\n• **Orientações** sobre prioridades e decisões\n• **Resumos** do estado atual dos projetos\n\n💡 **Dica**: Quando eu propor ações, clique em "Já pode executar" para executar diretamente!\n\nComo posso ajudar você hoje?',
};

export function CEOChat() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_chat_messages')
          .select('role, content, created_at')
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const history: Message[] = data.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
          }));
          setMessages(history);
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    
    loadHistory();
  }, []);

  // Save message to database
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    try {
      await supabase.from('ai_chat_messages').insert({ role, content });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  };

  // Clear chat history
  const clearHistory = async () => {
    try {
      await supabase.from('ai_chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setMessages([WELCOME_MESSAGE]);
      toast.success('Histórico limpo');
    } catch (err) {
      console.error('Error clearing history:', err);
      toast.error('Erro ao limpar histórico');
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const executeActions = async (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message.pendingActions?.length) return;

    setIsExecuting(true);
    const results: string[] = [];

    try {
      // Fetch all reference data in parallel
      const [
        { data: nodes },
        { data: tasks },
        { data: financialEntries },
        { data: orders }
      ] = await Promise.all([
        supabase.from('nodes').select('id, title'),
        supabase.from('tasks').select('id, title').is('deleted_at', null),
        supabase.from('financial_entries').select('id, description, value'),
        supabase.from('orders').select('id, order_number, customer_name').is('deleted_at', null)
      ]);
      
      const nodeMap = new Map(nodes?.map(n => [n.title.toLowerCase(), n.id]) || []);
      const taskMap = new Map(tasks?.map(t => [t.title.toLowerCase(), t.id]) || []);
      const entryMap = new Map(financialEntries?.map(e => [e.description.toLowerCase(), { id: e.id, value: e.value }]) || []);
      const orderMap = new Map(orders?.map(o => [
        (o.order_number || o.customer_name || '').toLowerCase(), 
        o.id
      ]) || []);

      for (const action of message.pendingActions) {
        try {
          let payload = { ...action.payload };
          
          // ============ Resolve references based on action type ============
          
          // Task actions - resolve node and task references
          if (action.type === 'task_create') {
            const nodeName = payload._nodeName as string | undefined;
            
            if (nodeName) {
              let nodeId = nodeMap.get(nodeName.toLowerCase());
              
              if (!nodeId) {
                const { data: newNode, error: nodeError } = await supabase
                  .from('nodes')
                  .insert({ title: nodeName, color: 'bg-purple-100' })
                  .select()
                  .single();
                
                if (nodeError) {
                  results.push(`❌ Erro ao criar nó "${nodeName}"`);
                  continue;
                }
                
                if (newNode) {
                  nodeId = newNode.id;
                  nodeMap.set(nodeName.toLowerCase(), nodeId);
                  results.push(`✅ Nó "${nodeName}" criado`);
                }
              }
              
              if (!nodeId) {
                results.push(`❌ Nó "${nodeName}" não encontrado`);
                continue;
              }
              
              payload.node_id = nodeId;
            }
            delete payload._nodeName;
            
            if (!payload.node_id) {
              results.push(`❌ Tarefa precisa de um nó válido`);
              continue;
            }
          }
          
          // Task update/delete - resolve task title to ID
          if ((action.type === 'task_update' || action.type === 'task_delete') && payload._taskTitle) {
            const taskId = taskMap.get((payload._taskTitle as string).toLowerCase());
            if (!taskId) {
              results.push(`❌ Tarefa "${payload._taskTitle}" não encontrada`);
              continue;
            }
            payload.id = taskId;
            delete payload._taskTitle;
          }
          
          // Order update - resolve order number to ID
          if (action.type === 'order_update' && payload._orderNumber) {
            const orderId = orderMap.get((payload._orderNumber as string).toLowerCase());
            if (!orderId) {
              results.push(`❌ Pedido "${payload._orderNumber}" não encontrado`);
              continue;
            }
            payload.id = orderId;
            delete payload._orderNumber;
          }
          
          // Financial pay - resolve entry description to ID
          if (action.type === 'financial_pay' && payload._entryDescription) {
            const entry = entryMap.get((payload._entryDescription as string).toLowerCase());
            if (!entry) {
              results.push(`❌ Lançamento "${payload._entryDescription}" não encontrado`);
              continue;
            }
            payload.id = entry.id;
            if (!payload.value) payload.value = entry.value;
            delete payload._entryDescription;
          }

          const response = await fetch(EXECUTE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              action: {
                type: action.type,
                title: action.title,
                description: action.description,
                area: action.area || 'Projetos',
                payload
              }
            }),
          });

          const data = await response.json();
          if (data.success) {
            results.push(`✅ ${data.result || action.title}`);
          } else {
            results.push(`❌ Falha: ${data.error || action.title || action.type}`);
          }
        } catch (err) {
          console.error('Action execution error:', err);
          results.push(`❌ Erro: ${err instanceof Error ? err.message : action.title || action.type}`);
        }
      }

      // Mark actions as executed
      setMessages(prev => prev.map((m, i) => 
        i === messageIndex ? { ...m, actionsExecuted: true } : m
      ));

      // Add result message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `🎯 **Ações executadas:**\n\n${results.join('\n')}`
      }]);

      toast.success('Ações executadas com sucesso!');
    } catch (error) {
      console.error('Execution error:', error);
      toast.error('Erro ao executar ações');
    } finally {
      setIsExecuting(false);
    }
  };

  const streamChat = useCallback(async (userMessages: Message[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: userMessages.map(m => ({ role: m.role, content: m.content })) }),
    });

    if (!resp.ok) {
      if (resp.status === 429) throw new Error('Limite de requisições atingido. Tente novamente.');
      if (resp.status === 402) throw new Error('Créditos insuficientes.');
      throw new Error('Erro ao conectar com o CEO IA');
    }

    if (!resp.body) throw new Error('Sem resposta do servidor');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let assistantContent = '';

    const updateAssistant = (content: string, pendingActions?: PendingAction[]) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content, pendingActions } : m));
        }
        return [...prev, { role: 'assistant', content, pendingActions }];
      });
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (line.startsWith(':') || line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            // Parse actions from content
            const actions = parseActionsFromResponse(assistantContent);
            updateAssistant(assistantContent, actions.length > 0 ? actions : undefined);
          }
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Flush remaining
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split('\n')) {
        if (!raw || raw.startsWith(':') || !raw.startsWith('data: ')) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            const actions = parseActionsFromResponse(assistantContent);
            updateAssistant(assistantContent, actions.length > 0 ? actions : undefined);
          }
        } catch {}
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Save user message to database
    await saveMessage('user', userMessage.content);

    try {
      await streamChat(newMessages);

      // Salva a última resposta do assistente e executa automaticamente ações detectadas
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        const lastMsg = prev[lastIndex];

        if (lastMsg?.role === 'assistant') {
          saveMessage('assistant', lastMsg.content);

          if (lastMsg.pendingActions?.length && !lastMsg.actionsExecuted) {
            // Executa direto no chat (sem exigir aprovação)
            setTimeout(() => executeActions(lastIndex), 0);
          }
        }

        return prev;
      });
    } catch (error) {
      console.error('Chat error:', error);
      const errorContent = `❌ ${error instanceof Error ? error.message : 'Erro ao processar sua mensagem'}`;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorContent },
      ]);
      saveMessage('assistant', errorContent);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const quickActions = [
    { label: '📊 Resumo geral', prompt: 'Me dê um resumo geral do estado atual: tarefas, finanças e pendências.' },
    { label: '⚠️ Prioridades', prompt: 'Quais são as prioridades mais urgentes agora?' },
    { label: '💰 Fluxo de caixa', prompt: 'Como está o fluxo de caixa? Há contas atrasadas?' },
    { label: '📋 Tarefas críticas', prompt: 'Quais tarefas estão atrasadas ou precisam de atenção?' },
  ];

  const handleQuickAction = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-320px)] min-h-[400px]">
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Conversa</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearHistory}
          disabled={messages.length <= 1 || isLoading}
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  )}
                >
                  <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j}>{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
              
              {/* Execute button for messages with pending actions */}
              {msg.role === 'assistant' && msg.pendingActions && msg.pendingActions.length > 0 && (
                <div className="ml-11 mt-2">
                  {msg.actionsExecuted ? (
                    <Button variant="outline" size="sm" disabled className="gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Ações executadas
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => executeActions(i)}
                      disabled={isExecuting}
                      className="gap-2"
                    >
                      {isExecuting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Executar
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
        )}
      </ScrollArea>

      {/* Quick actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleQuickAction(action.prompt)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem para o CEO IA..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}
