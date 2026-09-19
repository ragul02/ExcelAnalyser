import { inject, signal, computed } from '@angular/core';
import { Service } from '@angular/core';

// Types
export type IntentType = 'aggregate' | 'filter' | 'compare' | 'trend' | 'topBottom' | 'distribution' | 'forecast' | 'unknown';
export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
export type QuestionType = 'what' | 'when' | 'where' | 'who' | 'how' | 'show' | 'unknown';

export interface ParsedQuery {
  rawQuery: string;
  tokens: string[];
  entities: {
    fields: string[];
    values: any[];
    dates: DateRange[];
    numbers: number[];
    aggregations: AggregationType[];
  };
  metadata: {
    questionType: QuestionType;
    hasComparison: boolean;
    hasTrend: boolean;
    hasTimeframe: boolean;
    hasLimit: boolean;
    limit?: number;
  };
}

export interface Intent {
  type: IntentType;
  confidence: number;
  aggregation?: AggregationType;
  field?: string;
  secondField?: string;
  filters?: QueryFilter[];
  groupBy?: string;
  sortBy?: { field: string; order: 'asc' | 'desc' };
  limit?: number;
}

export interface QueryFilter {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in';
  value: any;
}

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export interface QueryResult {
  success: boolean;
  intent: Intent;
  data?: any;
  visualization?: {
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'table';
    config: any;
  };
  narrative: string;
  confidence: number;
  suggestions?: string[];
}

@Service()
export class NLPQueryService {
  // State
  readonly queryHistory = signal<string[]>([]);
  readonly lastResult = signal<QueryResult | null>(null);
  readonly isProcessing = signal(false);

  // Synonym dictionary for field matching
  private readonly fieldSynonyms: Record<string, string[]> = {
    sales: ['revenue', 'income', 'earnings', 'receipts'],
    cost: ['expense', 'spending', 'expenditure', 'outlay'],
    profit: ['margin', 'earnings', 'net', 'gain'],
    customer: ['client', 'buyer', 'purchaser', 'account'],
    product: ['item', 'sku', 'goods', 'merchandise'],
    date: ['time', 'when', 'period', 'timestamp'],
    quantity: ['amount', 'count', 'number', 'volume'],
    price: ['cost', 'value', 'rate', 'amount']
  };

  // Intent patterns
  private readonly intentPatterns = {
    aggregate: [
      /what (is|are|was|were) (the )?(total|sum|average|avg|mean|count)/i,
      /how (much|many)/i,
      /calculate (the )?/i,
      /give me (the )?(total|sum|average|count)/i
    ],
    filter: [
      /show( me)? (all )?(records|rows|data|items)( where)?/i,
      /filter( by)?/i,
      /find (all )?/i,
      /get (all )?/i,
      /list (all )?/i
    ],
    compare: [
      /compare .+ (with|to|vs|versus)/i,
      /difference between/i,
      /how does .+ compare/i,
      /(vs|versus)/i
    ],
    trend: [
      /trend (in|of|for)/i,
      /over time/i,
      /change (in|of) .+ (over|across)/i,
      /growth (in|of)/i,
      /decline (in|of)/i
    ],
    topBottom: [
      /top \d+/i,
      /bottom \d+/i,
      /highest|lowest|best|worst/i,
      /most|least/i,
      /largest|smallest/i
    ],
    distribution: [
      /distribution (of|for)/i,
      /spread (of|for)/i,
      /frequency (of|for)/i,
      /breakdown (of|by)/i
    ],
    forecast: [
      /forecast|predict|projection/i,
      /what will (be )?/i,
      /future (values?|trends?)/i
    ]
  };

  // Aggregation patterns
  private readonly aggregationPatterns: Record<AggregationType, RegExp[]> = {
    sum: [/total|sum/i],
    avg: [/average|avg|mean/i],
    count: [/count|number of|how many/i],
    min: [/minimum|min|lowest|smallest/i],
    max: [/maximum|max|highest|largest|biggest/i],
    median: [/median|middle/i]
  };

  // Date patterns
  private readonly datePatterns: Record<string, any> = {
    'q1|quarter 1|first quarter': { quarter: 1 },
    'q2|quarter 2|second quarter': { quarter: 2 },
    'q3|quarter 3|third quarter': { quarter: 3 },
    'q4|quarter 4|fourth quarter': { quarter: 4 },
    'last month': { type: 'relative', offset: -1, unit: 'month' },
    'this month': { type: 'relative', offset: 0, unit: 'month' },
    'last year': { type: 'relative', offset: -1, unit: 'year' },
    'this year': { type: 'relative', offset: 0, unit: 'year' },
    'ytd|year to date': { type: 'ytd' },
    'last quarter': { type: 'relative', offset: -1, unit: 'quarter' }
  };

  /**
   * Main entry point: Process natural language query
   */
  async processQuery(query: string, availableFields: string[], data: any[]): Promise<QueryResult> {
    this.isProcessing.set(true);
    
    try {
      // Step 1: Parse the query
      const parsed = this.parseQuery(query, availableFields);
      
      // Step 2: Classify intent
      const intent = this.classifyIntent(parsed);
      
      // Step 3: Execute query if confidence is high enough
      if (intent.confidence < 0.6) {
        return this.createLowConfidenceResponse(query);
      }
      
      // Step 4: Execute the data query
      const result = this.executeQuery(intent, data);
      
      // Step 5: Generate natural language response
      const narrative = this.generateNarrative(intent, result);
      
      // Step 6: Recommend visualization
      const visualization = this.recommendVisualization(intent, result);
      
      // Store in history
      this.addToHistory(query);
      
      const queryResult: QueryResult = {
        success: true,
        intent,
        data: result,
        narrative,
        visualization,
        confidence: intent.confidence
      };
      
      this.lastResult.set(queryResult);
      return queryResult;
      
    } catch (error) {
      console.error('Query processing error:', error);
      return {
        success: false,
        intent: { type: 'unknown', confidence: 0 },
        narrative: 'Sorry, I encountered an error processing your question. Please try rephrasing it.',
        confidence: 0,
        suggestions: this.getSuggestedQueries(availableFields)
      };
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Step 1: Parse natural language query into structured format
   */
  private parseQuery(query: string, availableFields: string[]): ParsedQuery {
    const normalized = query.toLowerCase().trim();
    
    // Tokenize
    const tokens = normalized
      .split(/\s+/)
      .filter(token => token.length > 0);
    
    // Extract entities
    const fields = this.extractFields(normalized, availableFields);
    const numbers = this.extractNumbers(normalized);
    const dates = this.extractDates(normalized);
    const aggregations = this.extractAggregations(normalized);
    
    // Determine question type
    const questionType = this.detectQuestionType(normalized);
    
    return {
      rawQuery: query,
      tokens,
      entities: {
        fields,
        values: [],
        dates,
        numbers,
        aggregations
      },
      metadata: {
        questionType,
        hasComparison: /compare|vs|versus|difference/.test(normalized),
        hasTrend: /trend|over time|growth|decline/.test(normalized),
        hasTimeframe: dates.length > 0,
        hasLimit: /top|bottom|\d+/.test(normalized),
        limit: this.extractLimit(normalized)
      }
    };
  }

  /**
   * Extract field names from query
   */
  private extractFields(query: string, availableFields: string[]): string[] {
    const found: string[] = [];
    
    for (const field of availableFields) {
      const fieldLower = field.toLowerCase();
      
      // Direct match
      if (query.includes(fieldLower)) {
        found.push(field);
        continue;
      }
      
      // Check synonyms
      for (const [canonical, synonyms] of Object.entries(this.fieldSynonyms)) {
        if (fieldLower.includes(canonical)) {
          for (const syn of synonyms) {
            if (query.includes(syn)) {
              found.push(field);
              break;
            }
          }
        }
      }
    }
    
    return [...new Set(found)]; // Remove duplicates
  }

  /**
   * Extract numbers from query
   */
  private extractNumbers(query: string): number[] {
    const matches = query.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Extract date ranges from query
   */
  private extractDates(query: string): DateRange[] {
    const ranges: DateRange[] = [];
    const now = new Date();
    
    for (const [pattern, config] of Object.entries(this.datePatterns)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(query)) {
        const range = this.calculateDateRange(config, now);
        if (range) ranges.push(range);
      }
    }
    
    return ranges;
  }

  /**
   * Calculate date range from pattern config
   */
  private calculateDateRange(config: any, referenceDate: Date): DateRange | null {
    const year = referenceDate.getFullYear();
    
    if (config.quarter) {
      const startMonth = (config.quarter - 1) * 3;
      return {
        start: new Date(year, startMonth, 1),
        end: new Date(year, startMonth + 3, 0),
        label: `Q${config.quarter} ${year}`
      };
    }
    
    if (config.type === 'ytd') {
      return {
        start: new Date(year, 0, 1),
        end: referenceDate,
        label: 'Year to Date'
      };
    }
    
    if (config.type === 'relative') {
      const start = new Date(referenceDate);
      const end = new Date(referenceDate);
      
      if (config.unit === 'month') {
        start.setMonth(start.getMonth() + config.offset);
        start.setDate(1);
        end.setMonth(end.getMonth() + config.offset + 1);
        end.setDate(0);
      } else if (config.unit === 'year') {
        start.setFullYear(start.getFullYear() + config.offset, 0, 1);
        end.setFullYear(end.getFullYear() + config.offset, 11, 31);
      }
      
      return {
        start,
        end,
        label: config.offset === 0 ? `This ${config.unit}` : `Last ${config.unit}`
      };
    }
    
    return null;
  }

  /**
   * Extract aggregation types
   */
  private extractAggregations(query: string): AggregationType[] {
    const found: AggregationType[] = [];
    
    for (const [type, patterns] of Object.entries(this.aggregationPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          found.push(type as AggregationType);
          break;
        }
      }
    }
    
    return found;
  }

  /**
   * Extract limit (top/bottom N)
   */
  private extractLimit(query: string): number | undefined {
    const match = query.match(/(?:top|bottom)\s+(\d+)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  /**
   * Detect question type
   */
  private detectQuestionType(query: string): QuestionType {
    if (/^what\b/i.test(query)) return 'what';
    if (/^when\b/i.test(query)) return 'when';
    if (/^where\b/i.test(query)) return 'where';
    if (/^who\b/i.test(query)) return 'who';
    if (/^how\b/i.test(query)) return 'how';
    if (/^show\b/i.test(query)) return 'show';
    return 'unknown';
  }

  /**
   * Step 2: Classify intent from parsed query
   */
  private classifyIntent(parsed: ParsedQuery): Intent {
    const scores: Map<IntentType, number> = new Map();
    
    // Score each intent type
    for (const [intentType, patterns] of Object.entries(this.intentPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(parsed.rawQuery)) {
          score += 1;
        }
      }
      if (score > 0) {
        scores.set(intentType as IntentType, score);
      }
    }
    
    // Find highest scoring intent
    let bestIntent: IntentType = 'unknown';
    let maxScore = 0;
    
    for (const [intent, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }
    
    // Calculate confidence
    const confidence = Math.min(maxScore * 0.4, 1.0);
    
    // Build intent object
    const intent: Intent = {
      type: bestIntent,
      confidence
    };
    
    // Add intent-specific properties
    if (parsed.entities.aggregations.length > 0) {
      intent.aggregation = parsed.entities.aggregations[0];
    }
    
    if (parsed.entities.fields.length > 0) {
      intent.field = parsed.entities.fields[0];
      if (parsed.entities.fields.length > 1) {
        intent.secondField = parsed.entities.fields[1];
      }
    }
    
    if (parsed.metadata.hasLimit && parsed.metadata.limit) {
      intent.limit = parsed.metadata.limit;
      intent.sortBy = {
        field: intent.field || '',
        order: parsed.rawQuery.toLowerCase().includes('top') ? 'desc' : 'asc'
      };
    }
    
    // Add filters for date ranges
    if (parsed.entities.dates.length > 0) {
      intent.filters = parsed.entities.dates.map(dateRange => ({
        field: parsed.entities.fields.find(f => /date|time/i.test(f)) || 'date',
        operator: '>=' as const,
        value: dateRange.start
      }));
    }
    
    return intent;
  }

  /**
   * Step 3: Execute query against data
   */
  private executeQuery(intent: Intent, data: any[]): any {
    if (!intent.field || data.length === 0) {
      return null;
    }
    
    let filtered = [...data];
    
    // Apply filters
    if (intent.filters) {
      for (const filter of intent.filters) {
        filtered = filtered.filter(row => {
          const value = row[filter.field];
          switch (filter.operator) {
            case '=': return value === filter.value;
            case '!=': return value !== filter.value;
            case '>': return value > filter.value;
            case '<': return value < filter.value;
            case '>=': return value >= filter.value;
            case '<=': return value <= filter.value;
            case 'contains': return String(value).includes(String(filter.value));
            default: return true;
          }
        });
      }
    }
    
    // Execute based on intent type
    switch (intent.type) {
      case 'aggregate':
        return this.executeAggregation(filtered, intent);
      case 'topBottom':
        return this.executeTopBottom(filtered, intent);
      case 'compare':
        return this.executeComparison(filtered, intent);
      case 'trend':
        return this.executeTrend(filtered, intent);
      default:
        return filtered;
    }
  }

  /**
   * Execute aggregation
   */
  private executeAggregation(data: any[], intent: Intent): any {
    if (!intent.field) return null;
    
    const values = data
      .map(row => row[intent.field!])
      .filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) return null;
    
    switch (intent.aggregation) {
      case 'sum':
        return { value: values.reduce((a, b) => a + b, 0), count: values.length };
      case 'avg':
        return { value: values.reduce((a, b) => a + b, 0) / values.length, count: values.length };
      case 'count':
        return { value: values.length, count: values.length };
      case 'min':
        return { value: Math.min(...values), count: values.length };
      case 'max':
        return { value: Math.max(...values), count: values.length };
      case 'median':
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return { 
          value: sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
          count: values.length
        };
      default:
        return { value: values.reduce((a, b) => a + b, 0), count: values.length };
    }
  }

  /**
   * Execute top/bottom query
   */
  private executeTopBottom(data: any[], intent: Intent): any[] {
    if (!intent.field || !intent.sortBy) return [];
    
    const sorted = [...data].sort((a, b) => {
      const aVal = a[intent.field!];
      const bVal = b[intent.field!];
      return intent.sortBy!.order === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    return sorted.slice(0, intent.limit || 10);
  }

  /**
   * Execute comparison
   */
  private executeComparison(data: any[], intent: Intent): any {
    if (!intent.field) return null;
    
    // Group by second field if available, otherwise compare time periods
    if (intent.secondField) {
      const groups = new Map<string, number>();
      
      for (const row of data) {
        const key = row[intent.secondField];
        const value = row[intent.field];
        
        if (typeof value === 'number') {
          groups.set(key, (groups.get(key) || 0) + value);
        }
      }
      
      return Array.from(groups.entries()).map(([key, value]) => ({
        category: key,
        value
      }));
    }
    
    return null;
  }

  /**
   * Execute trend analysis
   */
  private executeTrend(data: any[], intent: Intent): any[] {
    if (!intent.field) return [];
    
    // Find date field
    const dateField = Object.keys(data[0] || {}).find(k => /date|time/i.test(k));
    if (!dateField) return [];
    
    // Sort by date and return time series
    return data
      .sort((a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime())
      .map(row => ({
        date: row[dateField],
        value: row[intent.field!]
      }));
  }

  /**
   * Step 4: Generate natural language response
   */
  private generateNarrative(intent: Intent, result: any): string {
    if (!result) {
      return "I couldn't find data matching your query.";
    }
    
    switch (intent.type) {
      case 'aggregate':
        return this.narrateAggregation(intent, result);
      case 'topBottom':
        return this.narrateTopBottom(intent, result);
      case 'compare':
        return this.narrateComparison(intent, result);
      case 'trend':
        return this.narrateTrend(intent, result);
      default:
        return `Found ${Array.isArray(result) ? result.length : 1} result(s).`;
    }
  }

  private narrateAggregation(intent: Intent, result: any): string {
    const { value, count } = result;
    const field = intent.field || 'value';
    const formatted = typeof value === 'number' ? value.toLocaleString() : value;
    
    switch (intent.aggregation) {
      case 'sum':
        return `The total ${field} is ${formatted} (from ${count} records).`;
      case 'avg':
        return `The average ${field} is ${formatted} (across ${count} records).`;
      case 'count':
        return `There are ${formatted} ${field} records.`;
      case 'min':
        return `The minimum ${field} is ${formatted}.`;
      case 'max':
        return `The maximum ${field} is ${formatted}.`;
      case 'median':
        return `The median ${field} is ${formatted}.`;
      default:
        return `The ${field} is ${formatted}.`;
    }
  }

  private narrateTopBottom(intent: Intent, result: any[]): string {
    const direction = intent.sortBy?.order === 'desc' ? 'top' : 'bottom';
    const limit = intent.limit || result.length;
    const field = intent.field || 'value';
    
    const list = result
      .slice(0, 5)
      .map((item, i) => `${i + 1}. ${Object.values(item)[0]} (${item[field]})`)
      .join(', ');
    
    return `The ${direction} ${limit} by ${field}: ${list}${result.length > 5 ? '...' : ''}`;
  }

  private narrateComparison(intent: Intent, result: any): string {
    if (!Array.isArray(result)) return '';
    
    const items = result.map(r => `${r.category}: ${r.value.toLocaleString()}`).join(', ');
    return `Comparison by ${intent.secondField}: ${items}`;
  }

  private narrateTrend(intent: Intent, result: any[]): string {
    if (result.length < 2) return 'Insufficient data for trend analysis.';
    
    const first = result[0].value;
    const last = result[result.length - 1].value;
    const change = ((last - first) / first) * 100;
    
    const direction = change > 0 ? 'increasing' : 'decreasing';
    return `The ${intent.field} shows a ${direction} trend, changing by ${Math.abs(change).toFixed(1)}% over the period.`;
  }

  /**
   * Step 5: Recommend visualization
   */
  private recommendVisualization(intent: Intent, result: any): QueryResult['visualization'] {
    switch (intent.type) {
      case 'aggregate':
        return { type: 'table', config: {} };
      case 'topBottom':
        return { type: 'bar', config: { horizontal: true } };
      case 'compare':
        return { type: 'bar', config: {} };
      case 'trend':
        return { type: 'line', config: {} };
      case 'distribution':
        return { type: 'pie', config: {} };
      default:
        return { type: 'table', config: {} };
    }
  }

  /**
   * Handle low confidence queries
   */
  private createLowConfidenceResponse(query: string): QueryResult {
    return {
      success: false,
      intent: { type: 'unknown', confidence: 0 },
      narrative: "I'm not sure what you're asking. Here are some examples of questions I can answer:",
      confidence: 0,
      suggestions: [
        "What is the total revenue?",
        "Show me top 10 products by sales",
        "Compare Q1 vs Q2 performance",
        "What's the average order value?",
        "Show sales trend over last 6 months"
      ]
    };
  }

  /**
   * Generate suggested queries based on available fields
   */
  private getSuggestedQueries(fields: string[]): string[] {
    const suggestions: string[] = [];
    
    // Find common field types
    const numericFields = fields.filter(f => /sales|revenue|amount|price|cost|value|quantity/i.test(f));
    const dateFields = fields.filter(f => /date|time/i.test(f));
    const categoryFields = fields.filter(f => /category|type|region|product|customer/i.test(f));
    
    if (numericFields.length > 0) {
      suggestions.push(`What is the total ${numericFields[0]}?`);
      suggestions.push(`What's the average ${numericFields[0]}?`);
    }
    
    if (categoryFields.length > 0 && numericFields.length > 0) {
      suggestions.push(`Show me top 10 ${categoryFields[0]} by ${numericFields[0]}`);
      suggestions.push(`Compare ${numericFields[0]} by ${categoryFields[0]}`);
    }
    
    if (dateFields.length > 0 && numericFields.length > 0) {
      suggestions.push(`Show ${numericFields[0]} trend over time`);
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Add query to history
   */
  private addToHistory(query: string): void {
    const history = this.queryHistory();
    this.queryHistory.set([query, ...history].slice(0, 50)); // Keep last 50
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.queryHistory.set([]);
  }
}
