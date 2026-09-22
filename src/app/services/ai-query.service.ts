import { inject, signal, computed } from '@angular/core';
import { Service } from '@angular/core';
import { AIModelService } from './ai-model.service';

type Row = Record<string, unknown>;

export interface AIQueryResult {
  success: boolean;
  answer: string;
  data?: any;
  visualization?: {
    type: 'bar' | 'line' | 'pie' | 'scatter' | 'table' | 'kpi';
    dimension?: string;
    measure?: string;
    config?: any;
  };
  confidence: number;
  reasoning: string;
  suggestions?: string[];
  executionTime: number;
}

export interface QueryContext {
  columns: string[];
  rows: Row[];
  profiles: any[];
  sampleData: Row[];
}

interface FieldMatch {
  field: string;
  similarity: number;
  type: 'dimension' | 'measure';
}

/**
 * AI Query Service - Advanced natural language query processing
 * 
 * Handles ANY type of question about data using semantic understanding:
 * - "Why did sales drop in March?"
 * - "What factors influenced our best quarter?"
 * - "Show me unusual patterns in customer behavior"
 * - "How do different regions compare?"
 */
@Service()
export class AIQueryService {
  private aiModel = inject(AIModelService);

  // State
  readonly isEnabled = signal(false);
  readonly queryHistory = signal<string[]>([]);
  readonly lastResult = signal<AIQueryResult | null>(null);
  readonly isProcessing = signal(false);

  // Statistics for performance tracking
  private queryCount = 0;
  private totalExecutionTime = 0;

  readonly averageExecutionTime = computed(() => 
    this.queryCount > 0 ? this.totalExecutionTime / this.queryCount : 0
  );

  /**
   * Enable AI insights feature
   */
  async enable(): Promise<void> {
    if (this.isEnabled()) return;

    try {
      await this.aiModel.initialize();
      this.isEnabled.set(true);
      console.log('[AI Query] Service enabled');
    } catch (error) {
      console.error('[AI Query] Failed to enable:', error);
      throw error;
    }
  }

  /**
   * Disable AI insights feature
   */
  async disable(): Promise<void> {
    await this.aiModel.dispose();
    this.isEnabled.set(false);
    console.log('[AI Query] Service disabled');
  }

  /**
   * Process any natural language question about the data
   */
  async processQuery(question: string, context: QueryContext): Promise<AIQueryResult> {
    const startTime = performance.now();

    if (!this.isEnabled()) {
      throw new Error('AI Insights is not enabled. Please enable it in settings.');
    }

    if (!question.trim()) {
      throw new Error('Please enter a question');
    }

    if (context.rows.length === 0) {
      return {
        success: false,
        answer: 'No data available to analyze. Please load data first.',
        confidence: 0,
        reasoning: 'Empty dataset',
        executionTime: performance.now() - startTime
      };
    }

    this.isProcessing.set(true);

    try {
      // Check for greetings or non-data questions
      if (this.isGreetingOrSmallTalk(question)) {
        return this.handleGreeting(question, context, startTime);
      }

      // Step 1: Understand the question using AI
      const intent = await this.aiModel.classifyIntent(question);
      console.log('[AI Query] Intent:', intent);

      // Step 2: Match question keywords to data fields
      const fieldMatches = await this.matchFieldsToQuestion(question, context);
      console.log('[AI Query] Field matches:', fieldMatches);

      // If no fields matched, provide better error message
      if (fieldMatches.length === 0 && intent.intent !== 'unknown') {
        return this.createNoFieldsMatchedResponse(question, context, startTime);
      }

      // Step 3: Determine what analysis to perform
      const analysis = this.determineAnalysis(intent, fieldMatches, context);
      console.log('[AI Query] Analysis plan:', analysis);

      // Step 4: Execute the analysis
      const result = this.executeAnalysis(analysis, context);

      // Step 5: Generate natural language answer
      const answer = this.generateAnswer(question, intent, result, analysis);

      // Step 6: Recommend visualization
      const visualization = this.recommendVisualization(analysis, result);

      const executionTime = performance.now() - startTime;
      
      // Track statistics
      this.queryCount++;
      this.totalExecutionTime += executionTime;

      // Store in history
      this.addToHistory(question);

      const queryResult: AIQueryResult = {
        success: true,
        answer,
        data: result.data,
        visualization,
        confidence: Math.max(intent.confidence, 0.5), // Boost confidence
        reasoning: result.reasoning,
        executionTime
      };

      this.lastResult.set(queryResult);
      return queryResult;

    } catch (error) {
      console.error('[AI Query] Processing failed:', error);
      
      const executionTime = performance.now() - startTime;
      
      return {
        success: false,
        answer: error instanceof Error ? error.message : 'An error occurred while processing your question.',
        confidence: 0,
        reasoning: 'Error during processing',
        suggestions: this.generateSuggestions(context),
        executionTime
      };
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Check if question is a greeting or small talk
   */
  private isGreetingOrSmallTalk(question: string): boolean {
    const greetings = /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|yo|sup|what's up|howdy)[\s!.?]*$/i;
    const smallTalk = /^(how are you|what's your name|who are you|what can you do|help|thanks|thank you|bye|goodbye)[\s!.?]*$/i;
    
    return greetings.test(question.trim()) || smallTalk.test(question.trim());
  }

  /**
   * Handle greetings and small talk
   */
  private handleGreeting(question: string, context: QueryContext, startTime: number): AIQueryResult {
    let answer = '';
    
    const q = question.toLowerCase().trim();
    
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|yo|sup|howdy)/.test(q)) {
      answer = `Hello! I can help you analyze your data. You have ${context.rows.length} rows with ${context.columns.length} columns. Try asking questions like "What is the total revenue?" or "Show me trends over time."`;
    } else if (/what can you do|help/i.test(q)) {
      answer = `I can help you analyze your data by:\n• Calculating totals, averages, and other statistics\n• Finding trends over time\n• Comparing values across categories\n• Detecting unusual patterns\n• Finding correlations between fields\n\nJust ask a question about your data!`;
    } else if (/how are you/i.test(q)) {
      answer = `I'm ready to help you analyze your data! You have ${context.rows.length} rows loaded. What would you like to know?`;
    } else if (/what's your name|who are you/i.test(q)) {
      answer = `I'm your AI Data Assistant. I help you understand your data through natural language questions. What would you like to analyze?`;
    } else if (/thanks|thank you/i.test(q)) {
      answer = `You're welcome! Feel free to ask more questions about your data.`;
    } else if (/bye|goodbye/i.test(q)) {
      answer = `Goodbye! Come back anytime you need help analyzing your data.`;
    } else {
      answer = `I'm here to help you analyze your data. Try asking specific questions like "What is the average sales?" or "Show me the top products."`;
    }

    return {
      success: true,
      answer,
      confidence: 1.0,
      reasoning: 'Handled greeting/small talk',
      suggestions: this.generateSuggestions(context),
      executionTime: performance.now() - startTime
    };
  }

  /**
   * Handle case when no fields matched
   */
  private createNoFieldsMatchedResponse(question: string, context: QueryContext, startTime: number): AIQueryResult {
    const availableFields = context.columns.slice(0, 10).join(', ');
    
    return {
      success: false,
      answer: `I couldn't find any fields matching your question. Your data has these fields: ${availableFields}${context.columns.length > 10 ? '...' : ''}. Try using the exact field names in your question.`,
      confidence: 0,
      reasoning: 'No field matches found',
      suggestions: this.generateSuggestions(context),
      executionTime: performance.now() - startTime
    };
  }

  /**
   * Match fields in the question to actual data columns using semantic similarity
   */
  private async matchFieldsToQuestion(question: string, context: QueryContext): Promise<FieldMatch[]> {
    const matches: FieldMatch[] = [];
    const lowerQuestion = question.toLowerCase();
    const keywords = this.aiModel.extractKeyPhrases(question);

    console.log('[AI Query] Matching fields. Keywords:', keywords, 'Columns:', context.columns);

    // Priority 1: Exact and direct substring matching (highest confidence)
    const directMatches = this.directFieldMatching(question, context);
    matches.push(...directMatches);

    // Priority 2: Fuzzy matching for each field
    for (const field of context.columns) {
      const fieldLower = field.toLowerCase();
      
      // Skip if already matched directly
      if (matches.some(m => m.field === field)) continue;

      // Check if any keyword is similar to field name (fuzzy)
      let maxSimilarity = 0;
      
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // Partial match - keyword contains field or field contains keyword
        if (keywordLower.includes(fieldLower) || fieldLower.includes(keywordLower)) {
          maxSimilarity = Math.max(maxSimilarity, 0.7);
        }
        
        // Edit distance similarity (for typos)
        const editSimilarity = this.calculateEditDistanceSimilarity(keywordLower, fieldLower);
        if (editSimilarity > 0.6) {
          maxSimilarity = Math.max(maxSimilarity, editSimilarity * 0.8);
        }
      }

      // Also check semantic similarity (but lower threshold since our embeddings are basic)
      for (const keyword of keywords) {
        const similarity = await this.aiModel.calculateSimilarity(keyword, field);
        maxSimilarity = Math.max(maxSimilarity, similarity * 0.5); // Weight down semantic similarity
      }

      if (maxSimilarity > 0.15) { // Much lower threshold
        const profile = context.profiles.find(p => p.name === field);
        const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
          ? 'measure'
          : 'dimension';

        matches.push({ field, similarity: maxSimilarity, type });
      }
    }

    // Remove duplicates (keep highest similarity)
    const uniqueMatches = new Map<string, FieldMatch>();
    for (const match of matches) {
      const existing = uniqueMatches.get(match.field);
      if (!existing || match.similarity > existing.similarity) {
        uniqueMatches.set(match.field, match);
      }
    }

    const result = Array.from(uniqueMatches.values()).sort((a, b) => b.similarity - a.similarity);
    
    console.log('[AI Query] Field matches found:', result.map(m => `${m.field}(${m.similarity.toFixed(2)})`));
    
    return result;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateEditDistanceSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
    if (len2 === 0) return 0.0;

    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Calculate edit distance
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // deletion
          matrix[i][j - 1] + 1,      // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    const distance = matrix[len1][len2];
    
    return 1.0 - (distance / maxLen);
  }

  /**
   * Direct field matching for common patterns
   */
  private directFieldMatching(question: string, context: QueryContext): FieldMatch[] {
    const matches: FieldMatch[] = [];
    const lowerQuestion = question.toLowerCase();

    // Expanded synonyms for business terms
    const synonyms: Record<string, string[]> = {
      sales: ['revenue', 'income', 'earnings', 'receipts', 'proceeds'],
      cost: ['expense', 'spending', 'expenditure', 'outlay', 'payment'],
      profit: ['margin', 'earnings', 'net', 'gain', 'return'],
      customer: ['client', 'buyer', 'account', 'consumer', 'user'],
      product: ['item', 'sku', 'goods', 'merchandise', 'article'],
      date: ['time', 'when', 'period', 'timestamp', 'datetime'],
      quantity: ['amount', 'count', 'number', 'volume', 'total'],
      price: ['cost', 'value', 'rate', 'amount', 'charge'],
      name: ['title', 'label', 'description'],
      status: ['state', 'condition', 'stage'],
      category: ['type', 'group', 'class', 'segment'],
      region: ['area', 'location', 'territory', 'zone'],
      year: ['annual', 'yearly'],
      month: ['monthly'],
      day: ['daily', 'date'],
      total: ['sum', 'aggregate', 'combined'],
      average: ['mean', 'avg'],
      percent: ['percentage', 'rate', 'ratio']
    };

    for (const field of context.columns) {
      const fieldLower = field.toLowerCase();
      
      // Exact match - highest priority
      if (lowerQuestion === fieldLower || lowerQuestion.includes(` ${fieldLower} `) || 
          lowerQuestion.startsWith(fieldLower + ' ') || lowerQuestion.endsWith(' ' + fieldLower)) {
        const profile = context.profiles.find(p => p.name === field);
        const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
          ? 'measure'
          : 'dimension';
        
        matches.push({ field, similarity: 1.0, type });
        continue;
      }

      // Partial match - field name appears anywhere in question
      if (lowerQuestion.includes(fieldLower)) {
        const profile = context.profiles.find(p => p.name === field);
        const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
          ? 'measure'
          : 'dimension';
        
        matches.push({ field, similarity: 0.9, type });
        continue;
      }

      // Synonym matching - bidirectional
      let synonymMatched = false;
      for (const [canonical, syns] of Object.entries(synonyms)) {
        // Check if field contains canonical and question contains synonym
        if (fieldLower.includes(canonical)) {
          for (const syn of syns) {
            if (lowerQuestion.includes(syn)) {
              const profile = context.profiles.find(p => p.name === field);
              const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
                ? 'measure'
                : 'dimension';
              
              matches.push({ field, similarity: 0.75, type });
              synonymMatched = true;
              break;
            }
          }
          if (synonymMatched) break;
        }

        // Check if question contains canonical and field contains synonym
        if (lowerQuestion.includes(canonical) && !synonymMatched) {
          for (const syn of syns) {
            if (fieldLower.includes(syn)) {
              const profile = context.profiles.find(p => p.name === field);
              const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
                ? 'measure'
                : 'dimension';
              
              matches.push({ field, similarity: 0.75, type });
              synonymMatched = true;
              break;
            }
          }
          if (synonymMatched) break;
        }
      }
    }

    return matches;
  }

  /**
   * Determine what type of analysis to perform
   */
  private determineAnalysis(
    intent: Awaited<ReturnType<typeof AIModelService.prototype.classifyIntent>>,
    fieldMatches: FieldMatch[],
    context: QueryContext
  ): {
    type: 'aggregate' | 'trend' | 'comparison' | 'distribution' | 'correlation' | 'anomaly' | 'summary';
    measures: string[];
    dimensions: string[];
    operation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
    groupBy?: string;
    sortBy?: 'asc' | 'desc';
    limit?: number;
  } {
    let measures = fieldMatches.filter(m => m.type === 'measure').map(m => m.field);
    let dimensions = fieldMatches.filter(m => m.type === 'dimension').map(m => m.field);

    console.log('[AI Query] determineAnalysis - Initial matches:', { measures, dimensions, intent: intent.intent });

    // If no matches at all and it's a meaningful question, be more intelligent about picking fields
    if (measures.length === 0 && dimensions.length === 0 && intent.confidence > 0) {
      console.log('[AI Query] No field matches, trying intelligent field selection based on intent');
      
      // Try to pick relevant fields based on question intent
      const questionLower = intent.keywords.join(' ').toLowerCase();
      
      // Look for numeric fields that might be relevant
      const numericFields = context.profiles.filter(p => 
        ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(p.type)
      );
      
      // Look for categorical/grouping fields
      const categoricalFields = context.profiles.filter(p => 
        p.type === 'Category' || p.type === 'String'
      );

      // Look for date fields
      const dateFields = context.profiles.filter(p => 
        p.type === 'Date' || p.type === 'DateTime'
      );

      // Pick first numeric field (prioritize fields with common names)
      const preferredMeasures = ['amount', 'total', 'value', 'count', 'sales', 'revenue', 'price', 'cost'];
      let measureField = numericFields.find(f => 
        preferredMeasures.some(pm => f.name.toLowerCase().includes(pm))
      );
      if (!measureField && numericFields.length > 0) {
        measureField = numericFields[0];
      }
      if (measureField) measures.push(measureField.name);

      // Pick first categorical field (avoid 'index' or 'id' fields)
      const avoidDimensions = ['index', 'id', 'row'];
      let dimensionField = categoricalFields.find(f => 
        !avoidDimensions.some(ad => f.name.toLowerCase().includes(ad))
      );
      if (!dimensionField && categoricalFields.length > 0) {
        dimensionField = categoricalFields.find(f => 
          !avoidDimensions.some(ad => f.name.toLowerCase() === ad)
        ) || categoricalFields[0];
      }
      if (dimensionField) dimensions.push(dimensionField.name);

      // For trend questions, prefer date fields
      if (intent.intent === 'trend' && dateFields.length > 0) {
        dimensions = [dateFields[0].name];
      }

      console.log('[AI Query] Intelligent field selection result:', { measures, dimensions });
    } else if (measures.length === 0) {
      // Only pick numeric field if we have some field matches
      const numericField = context.profiles.find(p => 
        ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(p.type) &&
        !p.name.toLowerCase().includes('index') &&
        !p.name.toLowerCase().includes('id')
      );
      if (numericField) {
        measures.push(numericField.name);
        console.log('[AI Query] Added default measure:', numericField.name);
      }
    }

    if (dimensions.length === 0 && measures.length > 0) {
      const categoricalField = context.profiles.find(p => 
        (p.type === 'Category' || p.type === 'String') &&
        !p.name.toLowerCase().includes('index') &&
        !p.name.toLowerCase().includes('id')
      );
      if (categoricalField) {
        dimensions.push(categoricalField.name);
        console.log('[AI Query] Added default dimension:', categoricalField.name);
      }
    }

    // Determine operation from keywords
    const questionLower = intent.keywords.join(' ').toLowerCase();
    let operation: 'sum' | 'avg' | 'count' | 'min' | 'max' = 'sum';
    
    if (/average|avg|mean/.test(questionLower)) operation = 'avg';
    else if (/count|number|how many/.test(questionLower)) operation = 'count';
    else if (/minimum|min|lowest/.test(questionLower)) operation = 'min';
    else if (/maximum|max|highest|largest/.test(questionLower)) operation = 'max';
    else if (/total|sum/.test(questionLower)) operation = 'sum';

    // Determine analysis type based on intent and fields
    if (intent.intent === 'trend' || dimensions.some(d => {
      const profile = context.profiles.find(p => p.name === d);
      return profile && (profile.type === 'Date' || profile.type === 'DateTime');
    })) {
      return {
        type: 'trend',
        measures,
        dimensions: dimensions.filter(d => {
          const profile = context.profiles.find(p => p.name === d);
          return profile && (profile.type === 'Date' || profile.type === 'DateTime');
        }),
        operation
      };
    }

    if (intent.intent === 'comparison' || /compare|versus|vs|difference/.test(questionLower)) {
      return {
        type: 'comparison',
        measures,
        dimensions,
        groupBy: dimensions[0],
        operation
      };
    }

    if (/top|bottom|best|worst/.test(questionLower)) {
      const limit = this.extractNumber(questionLower) || 10;
      const sortBy = /bottom|worst/.test(questionLower) ? 'asc' : 'desc';
      
      return {
        type: 'aggregate',
        measures,
        dimensions,
        operation,
        groupBy: dimensions[0],
        sortBy,
        limit
      };
    }

    if (/distribution|spread|breakdown/.test(questionLower)) {
      return {
        type: 'distribution',
        measures,
        dimensions,
        groupBy: dimensions[0]
      };
    }

    if (intent.intent === 'insight' || /pattern|anomaly|unusual/.test(questionLower)) {
      return {
        type: 'anomaly',
        measures,
        dimensions
      };
    }

    if (measures.length > 1) {
      return {
        type: 'correlation',
        measures,
        dimensions
      };
    }

    // Default to summary
    return {
      type: 'summary',
      measures,
      dimensions,
      operation
    };
  }

  /**
   * Execute the determined analysis
   */
  private executeAnalysis(
    analysis: ReturnType<typeof this.determineAnalysis>,
    context: QueryContext
  ): { data: any; reasoning: string } {
    const rows = context.rows;

    switch (analysis.type) {
      case 'aggregate':
        return this.executeAggregate(analysis, rows);
      
      case 'trend':
        return this.executeTrend(analysis, rows);
      
      case 'comparison':
        return this.executeComparison(analysis, rows);
      
      case 'distribution':
        return this.executeDistribution(analysis, rows);
      
      case 'correlation':
        return this.executeCorrelation(analysis, rows);
      
      case 'anomaly':
        return this.executeAnomalyDetection(analysis, rows);
      
      case 'summary':
      default:
        return this.executeSummary(analysis, rows);
    }
  }

  private executeAggregate(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];
    const dimension = analysis.groupBy;

    if (!measure) {
      return {
        data: { count: rows.length },
        reasoning: 'Counted total rows'
      };
    }

    if (!dimension) {
      // Single aggregate
      const values = rows.map(r => this.toNumber(r[measure])).filter(Number.isFinite);
      const result = this.aggregate(values, analysis.operation || 'sum');
      
      return {
        data: { value: result, count: values.length },
        reasoning: `Calculated ${analysis.operation} of ${measure}`
      };
    }

    // Group by dimension
    const groups = new Map<string, number[]>();
    
    for (const row of rows) {
      const key = String(row[dimension] || '(blank)');
      if (!groups.has(key)) groups.set(key, []);
      
      const value = this.toNumber(row[measure]);
      if (Number.isFinite(value)) {
        groups.get(key)!.push(value);
      }
    }

    let results = Array.from(groups.entries()).map(([key, values]) => ({
      [dimension]: key,
      [measure]: this.aggregate(values, analysis.operation || 'sum'),
      count: values.length
    }));

    // Sort if requested
    if (analysis.sortBy) {
      results.sort((a, b) => {
        const aVal = a[measure] as number;
        const bVal = b[measure] as number;
        const diff = aVal - bVal;
        return analysis.sortBy === 'asc' ? diff : -diff;
      });
    }

    // Limit if requested
    if (analysis.limit) {
      results = results.slice(0, analysis.limit);
    }

    return {
      data: results,
      reasoning: `Grouped by ${dimension}, calculated ${analysis.operation} of ${measure}`
    };
  }

  private executeTrend(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];
    const dateField = analysis.dimensions[0];

    if (!measure || !dateField) {
      return {
        data: [],
        reasoning: 'Insufficient fields for trend analysis'
      };
    }

    // Sort by date
    const sorted = [...rows]
      .filter(r => r[dateField] && r[measure] !== null && r[measure] !== undefined)
      .sort((a, b) => {
        const dateA = new Date(String(a[dateField])).getTime();
        const dateB = new Date(String(b[dateField])).getTime();
        return dateA - dateB;
      });

    const trendData = sorted.map(r => ({
      date: String(r[dateField]),
      value: this.toNumber(r[measure])
    }));

    // Calculate trend direction
    if (trendData.length >= 2) {
      const first = trendData[0].value;
      const last = trendData[trendData.length - 1].value;
      const change = ((last - first) / first) * 100;
      
      return {
        data: {
          series: trendData,
          change: change,
          direction: change > 0 ? 'increasing' : 'decreasing'
        },
        reasoning: `Analyzed trend of ${measure} over ${dateField}, ${change.toFixed(1)}% ${change > 0 ? 'increase' : 'decrease'}`
      };
    }

    return {
      data: { series: trendData },
      reasoning: `Showing ${measure} over ${dateField}`
    };
  }

  private executeComparison(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];
    const dimension = analysis.groupBy;

    if (!measure || !dimension) {
      return {
        data: [],
        reasoning: 'Insufficient fields for comparison'
      };
    }

    // Group and aggregate
    const groups = new Map<string, number[]>();
    
    for (const row of rows) {
      const key = String(row[dimension] || '(blank)');
      if (!groups.has(key)) groups.set(key, []);
      
      const value = this.toNumber(row[measure]);
      if (Number.isFinite(value)) {
        groups.get(key)!.push(value);
      }
    }

    const comparisons = Array.from(groups.entries()).map(([key, values]) => ({
      category: key,
      value: this.aggregate(values, analysis.operation || 'sum'),
      count: values.length
    }));

    // Calculate differences
    if (comparisons.length >= 2) {
      const sorted = comparisons.sort((a, b) => b.value - a.value);
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      const diff = highest.value - lowest.value;
      const diffPct = (diff / lowest.value) * 100;

      return {
        data: {
          comparisons,
          highest,
          lowest,
          difference: diff,
          differencePercent: diffPct
        },
        reasoning: `Compared ${measure} across ${dimension}. Highest: ${highest.category} (${highest.value.toFixed(2)}), Lowest: ${lowest.category} (${lowest.value.toFixed(2)})`
      };
    }

    return {
      data: { comparisons },
      reasoning: `Compared ${measure} by ${dimension}`
    };
  }

  private executeDistribution(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];
    const dimension = analysis.groupBy;

    if (!dimension) {
      return {
        data: [],
        reasoning: 'No dimension specified for distribution'
      };
    }

    // Count frequency
    const distribution = new Map<string, number>();
    
    for (const row of rows) {
      const key = String(row[dimension] || '(blank)');
      distribution.set(key, (distribution.get(key) || 0) + 1);
    }

    const results = Array.from(distribution.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: (count / rows.length) * 100
      }))
      .sort((a, b) => b.count - a.count);

    return {
      data: results,
      reasoning: `Distribution of ${dimension} across ${rows.length} records`
    };
  }

  private executeCorrelation(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const [measure1, measure2] = analysis.measures;

    if (!measure1 || !measure2) {
      return {
        data: null,
        reasoning: 'Need two numeric fields for correlation'
      };
    }

    const pairs: Array<{ x: number; y: number }> = [];
    
    for (const row of rows) {
      const x = this.toNumber(row[measure1]);
      const y = this.toNumber(row[measure2]);
      
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pairs.push({ x, y });
      }
    }

    if (pairs.length < 3) {
      return {
        data: null,
        reasoning: 'Insufficient data for correlation'
      };
    }

    // Calculate correlation coefficient
    const correlation = this.calculateCorrelation(
      pairs.map(p => p.x),
      pairs.map(p => p.y)
    );

    let interpretation = 'no correlation';
    if (Math.abs(correlation) > 0.7) interpretation = 'strong correlation';
    else if (Math.abs(correlation) > 0.4) interpretation = 'moderate correlation';
    else if (Math.abs(correlation) > 0.2) interpretation = 'weak correlation';

    return {
      data: {
        correlation,
        interpretation,
        points: pairs,
        measure1,
        measure2
      },
      reasoning: `Found ${interpretation} (${correlation.toFixed(3)}) between ${measure1} and ${measure2}`
    };
  }

  private executeAnomalyDetection(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];

    if (!measure) {
      return {
        data: [],
        reasoning: 'No measure specified for anomaly detection'
      };
    }

    const values = rows
      .map((r, i) => ({ value: this.toNumber(r[measure]), index: i, row: r }))
      .filter(v => Number.isFinite(v.value));

    if (values.length < 10) {
      return {
        data: [],
        reasoning: 'Insufficient data for anomaly detection'
      };
    }

    // Calculate statistics
    const nums = values.map(v => v.value);
    const mean = this.aggregate(nums, 'avg');
    const stdev = this.calculateStdDev(nums);

    // Find outliers (> 2 standard deviations)
    const anomalies = values
      .map(v => ({
        ...v,
        zScore: Math.abs((v.value - mean) / stdev),
        deviation: v.value - mean
      }))
      .filter(v => v.zScore > 2)
      .sort((a, b) => b.zScore - a.zScore);

    return {
      data: {
        anomalies: anomalies.slice(0, 10),
        mean,
        stdev,
        count: anomalies.length
      },
      reasoning: `Found ${anomalies.length} anomalies in ${measure} (values > 2 standard deviations from mean)`
    };
  }

  private executeSummary(analysis: any, rows: Row[]): { data: any; reasoning: string } {
    const measure = analysis.measures[0];

    if (!measure) {
      return {
        data: { totalRows: rows.length },
        reasoning: `Dataset contains ${rows.length} rows`
      };
    }

    const values = rows.map(r => this.toNumber(r[measure])).filter(Number.isFinite);

    if (values.length === 0) {
      return {
        data: null,
        reasoning: `No numeric values found in ${measure}`
      };
    }

    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      data: {
        field: measure,
        count: values.length,
        sum: this.aggregate(values, 'sum'),
        avg: this.aggregate(values, 'avg'),
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: this.aggregate(values, 'median'),
        stdev: this.calculateStdDev(values)
      },
      reasoning: `Summary statistics for ${measure}`
    };
  }

  /**
   * Generate natural language answer
   */
  private generateAnswer(
    question: string,
    intent: Awaited<ReturnType<typeof AIModelService.prototype.classifyIntent>>,
    result: { data: any; reasoning: string },
    analysis: any
  ): string {
    const { data } = result;

    if (!data) {
      return "I couldn't find enough information to answer that question. Try asking about specific fields in your data.";
    }

    switch (analysis.type) {
      case 'aggregate':
        if (Array.isArray(data)) {
          const items = data.slice(0, 5).map(d => 
            `${Object.values(d)[0]}: ${this.formatNumber(Object.values(d)[1] as number)}`
          ).join(', ');
          return `Here are the results: ${items}${data.length > 5 ? '...' : ''}`;
        } else if (data.value !== undefined) {
          return `The ${analysis.operation || 'total'} is ${this.formatNumber(data.value)} (from ${data.count} records).`;
        }
        return "Here's what I found: " + JSON.stringify(data);

      case 'trend':
        if (data.series && data.change !== undefined) {
          const direction = data.change > 0 ? 'increased' : 'decreased';
          return `The data shows a ${data.direction} trend. Overall, there's been a ${Math.abs(data.change).toFixed(1)}% ${direction} from the beginning to the end of the period.`;
        }
        return "I've analyzed the trend over time. The data shows changes across the selected period.";

      case 'comparison':
        if (data.highest && data.lowest) {
          const diffPct = data.differencePercent?.toFixed(1) || '0';
          return `${data.highest.category} has the highest value at ${this.formatNumber(data.highest.value)}, while ${data.lowest.category} has the lowest at ${this.formatNumber(data.lowest.value)}. That's a difference of ${diffPct}%.`;
        }
        return "I've compared the values across different categories in your data.";

      case 'distribution':
        if (Array.isArray(data) && data.length > 0) {
          const top3 = data.slice(0, 3).map(d => 
            `${d.category} (${d.percentage.toFixed(1)}%)`
          ).join(', ');
          return `The distribution shows: ${top3}. In total, there are ${data.length} distinct categories.`;
        }
        return "I've analyzed the distribution of values in your data.";

      case 'correlation':
        if (data.correlation !== undefined) {
          const strength = data.interpretation;
          const direction = data.correlation > 0 ? 'positive' : 'negative';
          return `There is a ${direction} ${strength} between ${data.measure1} and ${data.measure2} (correlation coefficient: ${data.correlation.toFixed(3)}).`;
        }
        return "I've analyzed the relationship between the specified fields.";

      case 'anomaly':
        if (data.anomalies && data.anomalies.length > 0) {
          return `I found ${data.count} unusual values in the data. The most significant anomaly is ${this.formatNumber(data.anomalies[0].value)}, which is ${data.anomalies[0].zScore.toFixed(1)} standard deviations from the mean.`;
        }
        return "I didn't find any significant anomalies in the data. All values appear normal.";

      case 'summary':
        if (data.field) {
          return `${data.field} summary: Average = ${this.formatNumber(data.avg)}, Range = ${this.formatNumber(data.min)} to ${this.formatNumber(data.max)}, Total = ${this.formatNumber(data.sum)} (${data.count} values).`;
        }
        return `Your dataset contains ${data.totalRows} rows.`;

      default:
        return result.reasoning || "I've analyzed your data based on the question.";
    }
  }

  /**
   * Recommend appropriate visualization
   */
  private recommendVisualization(analysis: any, result: any): AIQueryResult['visualization'] {
    console.log('[AI Query] recommendVisualization - analysis:', analysis);
    
    const measure = analysis.measures[0];
    const dimension = analysis.dimensions[0];
    
    console.log('[AI Query] recommendVisualization - measure:', measure, 'dimension:', dimension);
    
    switch (analysis.type) {
      case 'trend':
        if (!measure || !dimension) {
          console.warn('[AI Query] Trend visualization missing fields:', { measure, dimension });
          return { type: 'table' };
        }
        return {
          type: 'line',
          dimension: dimension,
          measure: measure
        };

      case 'comparison':
      case 'distribution':
        if (!measure || !analysis.groupBy) {
          console.warn('[AI Query] Comparison/distribution visualization missing fields:', { measure, groupBy: analysis.groupBy });
          return { type: 'table' };
        }
        return {
          type: 'bar',
          dimension: analysis.groupBy,
          measure: measure
        };

      case 'correlation':
        if (!analysis.measures[0] || !analysis.measures[1]) {
          console.warn('[AI Query] Correlation visualization missing measures');
          return { type: 'table' };
        }
        return {
          type: 'scatter',
          measure: analysis.measures[0],
          config: { secondMeasure: analysis.measures[1] }
        };

      case 'aggregate':
        if (analysis.groupBy && measure) {
          return {
            type: 'bar',
            dimension: analysis.groupBy,
            measure: measure
          };
        }
        if (measure) {
          return { 
            type: 'kpi',
            measure: measure
          };
        }
        return { type: 'table' };

      case 'summary':
        if (measure) {
          return {
            type: 'kpi',
            measure: measure
          };
        }
        return { type: 'table' };

      default:
        return { type: 'table' };
    }
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(context: QueryContext): string[] {
    const suggestions: string[] = [];

    const measures = context.profiles.filter(p => 
      ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(p.type)
    );
    
    const dimensions = context.profiles.filter(p => 
      ['Category', 'String', 'Date', 'DateTime'].includes(p.type)
    );

    if (measures.length > 0) {
      suggestions.push(`What is the total ${measures[0].name}?`);
      suggestions.push(`Show me the average ${measures[0].name}`);
    }

    if (dimensions.length > 0 && measures.length > 0) {
      suggestions.push(`Compare ${measures[0].name} across ${dimensions[0].name}`);
      suggestions.push(`Show me the top 10 ${dimensions[0].name} by ${measures[0].name}`);
    }

    const dateField = dimensions.find(d => d.type === 'Date' || d.type === 'DateTime');
    if (dateField && measures.length > 0) {
      suggestions.push(`How has ${measures[0].name} changed over time?`);
      suggestions.push(`What's the trend in ${measures[0].name}?`);
    }

    if (measures.length > 1) {
      suggestions.push(`Is there a correlation between ${measures[0].name} and ${measures[1].name}?`);
    }

    suggestions.push(`What unusual patterns exist in the data?`);

    return suggestions.slice(0, 5);
  }

  // ========== Helper Methods ==========

  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    return Number(String(value ?? '').replace(/[$€£₹,%\s]/g, ''));
  }

  private aggregate(values: number[], operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median'): number {
    if (operation === 'count') return values.length;
    if (values.length === 0) return 0;

    switch (operation) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      case 'median': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      }
      default: return values[0];
    }
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const meanX = this.aggregate(x, 'avg');
    const meanY = this.aggregate(y, 'avg');

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.aggregate(values, 'avg');
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.aggregate(squaredDiffs, 'avg'));
  }

  private extractNumber(text: string): number | null {
    const match = text.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  private addToHistory(question: string): void {
    const history = this.queryHistory();
    this.queryHistory.set([question, ...history].slice(0, 50));
  }

  clearHistory(): void {
    this.queryHistory.set([]);
  }

  getMemoryStats() {
    return this.aiModel.getMemoryStats();
  }
}
