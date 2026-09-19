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
      // Step 1: Understand the question using AI
      const intent = await this.aiModel.classifyIntent(question);
      console.log('[AI Query] Intent:', intent);

      // Step 2: Match question keywords to data fields
      const fieldMatches = await this.matchFieldsToQuestion(question, context);
      console.log('[AI Query] Field matches:', fieldMatches);

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
        confidence: intent.confidence,
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
   * Match fields in the question to actual data columns using semantic similarity
   */
  private async matchFieldsToQuestion(question: string, context: QueryContext): Promise<FieldMatch[]> {
    const keywords = this.aiModel.extractKeyPhrases(question);
    const matches: FieldMatch[] = [];

    // Find fields semantically similar to keywords
    for (const field of context.columns) {
      let maxSimilarity = 0;
      
      for (const keyword of keywords) {
        const similarity = await this.aiModel.calculateSimilarity(keyword, field);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      if (maxSimilarity > 0.3) { // Threshold for relevance
        const profile = context.profiles.find(p => p.name === field);
        const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
          ? 'measure'
          : 'dimension';

        matches.push({ field, similarity: maxSimilarity, type });
      }
    }

    // Also do direct name matching for common terms
    const directMatches = this.directFieldMatching(question, context);
    matches.push(...directMatches);

    // Remove duplicates and sort by similarity
    const uniqueMatches = Array.from(
      new Map(matches.map(m => [m.field, m])).values()
    );

    return uniqueMatches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Direct field matching for common patterns
   */
  private directFieldMatching(question: string, context: QueryContext): FieldMatch[] {
    const matches: FieldMatch[] = [];
    const lowerQuestion = question.toLowerCase();

    // Common synonyms
    const synonyms: Record<string, string[]> = {
      sales: ['revenue', 'income', 'earnings'],
      cost: ['expense', 'spending', 'expenditure'],
      profit: ['margin', 'earnings', 'net'],
      customer: ['client', 'buyer', 'account'],
      product: ['item', 'sku', 'goods'],
      date: ['time', 'when', 'period'],
      quantity: ['amount', 'count', 'number'],
      price: ['cost', 'value', 'rate']
    };

    for (const field of context.columns) {
      const fieldLower = field.toLowerCase();
      
      // Direct match
      if (lowerQuestion.includes(fieldLower)) {
        const profile = context.profiles.find(p => p.name === field);
        const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
          ? 'measure'
          : 'dimension';
        
        matches.push({ field, similarity: 1.0, type });
        continue;
      }

      // Synonym match
      for (const [canonical, syns] of Object.entries(synonyms)) {
        if (fieldLower.includes(canonical)) {
          for (const syn of syns) {
            if (lowerQuestion.includes(syn)) {
              const profile = context.profiles.find(p => p.name === field);
              const type = profile && ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)
                ? 'measure'
                : 'dimension';
              
              matches.push({ field, similarity: 0.8, type });
              break;
            }
          }
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
    const measures = fieldMatches.filter(m => m.type === 'measure').map(m => m.field);
    const dimensions = fieldMatches.filter(m => m.type === 'dimension').map(m => m.field);

    // If no matches, try to infer from profiles
    if (measures.length === 0) {
      const numericField = context.profiles.find(p => 
        ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(p.type)
      );
      if (numericField) measures.push(numericField.name);
    }

    if (dimensions.length === 0) {
      const categoricalField = context.profiles.find(p => 
        p.type === 'Category' || p.type === 'String'
      );
      if (categoricalField) dimensions.push(categoricalField.name);
    }

    // Determine operation from keywords
    const questionLower = intent.keywords.join(' ');
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
    switch (analysis.type) {
      case 'trend':
        return {
          type: 'line',
          dimension: analysis.dimensions[0],
          measure: analysis.measures[0]
        };

      case 'comparison':
      case 'distribution':
        return {
          type: 'bar',
          dimension: analysis.groupBy,
          measure: analysis.measures[0]
        };

      case 'correlation':
        return {
          type: 'scatter',
          measure: analysis.measures[0],
          config: { secondMeasure: analysis.measures[1] }
        };

      case 'aggregate':
        if (analysis.groupBy) {
          return {
            type: 'bar',
            dimension: analysis.groupBy,
            measure: analysis.measures[0]
          };
        }
        return { type: 'kpi' };

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
