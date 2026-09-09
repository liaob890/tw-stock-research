import { stocks } from './research';

export function calculateValuation(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('請提供股票代號與本益比。');
  const args = input as Record<string, unknown>;
  if (Object.keys(args).some(k => !['stockId', 'pe'].includes(k))) throw new Error('未知參數。');
  const stock = stocks.find(s => s.id === args.stockId);
  if (!stock || typeof args.pe !== 'number' || !Number.isInteger(args.pe) || args.pe < 10 || args.pe > 60) throw new Error('股票代號限 2426、3714 或 2409；本益比須為 10–60 的整數。');
  return { stockId: stock.id, pe: args.pe, asOf: stock.priceDate, close: stock.price, impliedAnnualEps: stock.price / args.pe, epsToBookPct: stock.price / args.pe / stock.bvps * 100, assumptionOnly: true };
}

type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };
type ModelContext = { registerTool: (tool: Tool, options?: {signal: AbortSignal}) => void | Promise<void> };

export function registerValuationTool(update: (stockId: string, pe: number) => void) {
  const context = (document as Document & {modelContext?: ModelContext}).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(context.registerTool({
      name: 'configure_stock_valuation', title: '設定股票估值假設',
      description: '更新頁面中的股票與本益比，反推目前快照價格所需的年度 EPS。僅試算，不會下單或保存投資決策。',
      inputSchema: {type:'object', properties:{stockId:{type:'string',enum:stocks.map(s=>s.id)},pe:{type:'integer',minimum:10,maximum:60}},required:['stockId','pe'],additionalProperties:false},
      annotations: {readOnlyHint:false,untrustedContentHint:false},
      execute(input) { const result = calculateValuation(input); update(result.stockId, result.pe); return result; },
    }, {signal:lifecycle.signal})).catch(() => {});
  } catch { /* 普通瀏覽器仍可使用同一組頁面控制項。 */ }
  return () => lifecycle.abort();
}
