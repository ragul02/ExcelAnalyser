import { CommonModule } from '@angular/common';
import { Component, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { AnalyticsService } from './services/analytics.service';
import { AIQueryService, AIQueryResult } from './services/ai-query.service';
import { AIInsightsPanelComponent } from './components/ai-insights-panel.component';
import { Insight } from './models/insight.types';
import { ChartRecommendation } from './models/recommendation.types';
import { ForecastResult } from './models/forecast.types';

type Row = Record<string, unknown>;
type FieldType = 'String' | 'Category' | 'Integer' | 'Decimal' | 'Currency' | 'Percentage' | 'Date' | 'DateTime' | 'Boolean' | 'Identifier';
type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'histogram' | 'heatmap' | 'treemap' | 'box' | 'kpi';
type Aggregation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'median';

interface FieldProfile {
  name: string;
  type: FieldType;
  missing: number;
  missingPct: number;
  unique: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stdev?: number;
  topValues: { value: string; count: number }[];
}

interface ChartPoint {
  label: string;
  value: number;
  x?: number;
  y?: number;
  series?: string;
}

interface ChartDefinition {
  id: string;
  title: string;
  subtitle: string;
  type: ChartType;
  dimension: string;
  measure: string;
  secondMeasure: string;
  series: string;
  aggregation: Aggregation;
  topN: number;
  sort: 'none' | 'asc' | 'desc';
  filterField: string;
  filterValue: string;
}

interface DashboardItem {
  id: string;
  chartId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ProjectState {
  name: string;
  sourcePath: string;
  sheets: string[];
  activeSheet: string;
  rows: Row[];
  columns: string[];
  schemaOverrides: Record<string, FieldType>;
  transformations: string[];
  calculatedFields: { name: string; formula: string }[];
  savedCharts: ChartDefinition[];
  dashboardItems: DashboardItem[];
}

const emptyChart = (): ChartDefinition => ({
  id: crypto.randomUUID(),
  title: 'Untitled chart',
  subtitle: '',
  type: 'bar',
  dimension: '',
  measure: '',
  secondMeasure: '',
  series: '',
  aggregation: 'sum',
  topN: 10,
  sort: 'desc',
  filterField: '',
  filterValue: '',
});

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, AIInsightsPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly Math = Math;
  readonly appName = 'Data Visualization Studio';
  
  // Inject services
  readonly analytics = inject(AnalyticsService);
  readonly aiQuery = inject(AIQueryService);
  
  workbook?: XLSX.WorkBook;
  workbookSheets: { name: string; rows: number; columns: number }[] = [];
  sourcePath = '';
  activeSheet = '';
  rows = signal<Row[]>([]);
  importedRows: Row[] = [];
  columns = signal<string[]>([]);
  schemaOverrides: Record<string, FieldType> = {};
  transformations: string[] = [];
  calculatedFields: { name: string; formula: string }[] = [];
  savedCharts: ChartDefinition[] = [];
  dashboardItems: DashboardItem[] = [];
  recentProjects: string[] = JSON.parse(localStorage.getItem('dvis-recent') || '[]');
  selectedTab: 'overview' | 'data' | 'profile' | 'chart' | 'dashboard' | 'export' | 'insights' = 'data';
  notification = 'Import an Excel or CSV file to begin.';
  busy = false;
  qualityScore = 100;
  qualityDetailsOpen = false;
  forecastPeriods = 10;
  forecastBusy = false;
  forecastError = '';
  undoStack: Row[][] = [];
  redoStack: Row[][] = [];
  selectedRowLimit = 100;
  chart = emptyChart();
  chartData: ChartPoint[] = [];
  globalFilterField = '';
  globalFilterValue = '';
  calcName = '';
  calcFormula = '';
  formulaError = '';
  dashboardEdit = true;

  readonly profiles = computed(() => {
    const profiles = this.columns().map((column) => this.profileColumn(column));
    const missing = profiles.reduce((sum, profile) => sum + profile.missing, 0);
    const cells = Math.max(this.rows().length * Math.max(this.columns().length, 1), 1);
    const duplicatePenalty = this.duplicateCount() * 2;
    this.qualityScore = Math.max(0, Math.round(100 - (missing / cells) * 100 - duplicatePenalty));
    return profiles;
  });

  readonly dimensions = computed(() =>
    this.profiles().filter((field) => !['Integer', 'Decimal', 'Currency', 'Percentage'].includes(field.type)),
  );

  readonly measures = computed(() =>
    this.profiles().filter((field) => ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(field.type)),
  );

  readonly canForecast = computed(() => {
    const dimension = this.profiles().find((field) => field.name === this.chart.dimension);
    return (dimension?.type === 'Date' || dimension?.type === 'DateTime')
      && !!this.chart.measure
      && this.rows().length >= 10;
  });

  readonly forecastData = computed(() => this.analytics.currentForecast());

  readonly qualityBreakdown = computed(() => {
    const analyzedQuality = this.analytics.qualityScore();
    if (analyzedQuality) return analyzedQuality.components;

    const profiles = this.profiles();
    const cells = Math.max(this.rows().length * Math.max(this.columns().length, 1), 1);
    const missing = profiles.reduce((sum, profile) => sum + profile.missing, 0);
    const completeness = Math.max(0, Math.round(100 - (missing / cells) * 100));
    const uniqueness = this.rows().length
      ? Math.max(0, Math.round(100 - (this.duplicateCount() / this.rows().length) * 100))
      : 100;
    return { completeness, consistency: 100, accuracy: 100, uniqueness };
  });

  readonly qualityIssues = computed(() => {
    const analyzedQuality = this.analytics.qualityScore();
    if (analyzedQuality) return analyzedQuality.suggestions.slice(0, 3).map((suggestion) => suggestion.description);

    const issues = this.profiles()
      .filter((field) => field.missingPct > 10)
      .sort((a, b) => b.missingPct - a.missingPct)
      .map((field) => `Fill missing values in ${field.name} (${field.missingPct}% missing)`);
    const duplicates = this.duplicateCount();
    if (duplicates > 0) issues.unshift(`Remove ${duplicates} duplicate row${duplicates === 1 ? '' : 's'}`);
    return issues.slice(0, 3);
  });

  readonly analysisOverview = computed(() => {
    const profiles = this.profiles();
    const rowCount = this.rows().length;
    const columnCount = this.columns().length;
    const missingCells = profiles.reduce((sum, profile) => sum + profile.missing, 0);
    const duplicateRows = this.duplicateCount();
    const typeCounts = profiles.reduce((counts, profile) => {
      if (['Integer', 'Decimal', 'Currency', 'Percentage'].includes(profile.type)) counts.numeric++;
      else if (['Date', 'DateTime'].includes(profile.type)) counts.date++;
      else if (profile.type === 'Category') counts.category++;
      else counts.text++;
      return counts;
    }, { numeric: 0, category: 0, date: 0, text: 0 });
    const quality = this.analytics.qualityScore()?.overall ?? this.qualityScore;

    return {
      rowCount,
      columnCount,
      sheetCount: this.workbookSheets.length,
      missingCells,
      duplicateRows,
      quality,
      completeness: rowCount * columnCount ? Math.round(100 - (missingCells / (rowCount * columnCount)) * 100) : 100,
      typeCounts,
    };
  });

  readonly priorityFields = computed(() =>
    this.profiles()
      .filter((profile) => profile.missing > 0 || profile.unique <= Math.max(1, this.rows().length * 0.02))
      .sort((a, b) => b.missingPct - a.missingPct || a.unique - b.unique)
      .slice(0, 6),
  );

  readonly visibleRows = computed(() => this.rows().slice(0, this.selectedRowLimit));

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.busy = true;
    this.sourcePath = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.workbook = XLSX.read(reader.result, { type: 'array', cellDates: true });
        this.workbookSheets = this.workbook.SheetNames.map((name) => {
          const sheet = this.workbook!.Sheets[name];
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
          return { name, rows: range.e.r + 1, columns: range.e.c + 1 };
        });
        this.loadSheet(this.workbook.SheetNames[0]);
        this.selectedTab = 'overview';
        this.notification = `Imported ${file.name}. Select a sheet, profile fields, then build charts.`;
      } catch {
        this.notification = 'This file could not be imported. Supported formats are .xlsx, .xls and .csv.';
      } finally {
        this.busy = false;
        input.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }

  loadSheet(name: string): void {
    if (!this.workbook) return;
    const sheet = this.workbook.Sheets[name];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    const cleaned = raw.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
    const columns = Array.from(new Set(cleaned.flatMap((row) => Object.keys(row).map((key) => key.trim()))));
    const rows = cleaned.map((row) => this.normalizeRow(row, columns));
    this.activeSheet = name;
    this.importedRows = structuredClone(rows);
    this.rows.set(rows);
    this.columns.set(columns);
    this.schemaOverrides = {};
    this.transformations = [];
    this.calculatedFields = [];
    this.undoStack = [];
    this.redoStack = [];
    this.setSmartChartDefaults();
    this.autosave();
    
    // Trigger analytics analysis
    this.triggerAnalytics();
  }
  
  /**
   * Triggers analytics analysis on the current dataset
   */
  async triggerAnalytics(): Promise<void> {
    if (this.rows().length > 0 && this.columns().length > 0) {
      await this.analytics.analyzeDataset(
        this.rows(),
        this.columns(),
        this.profiles()
      );
    }
  }

  insightTypeLabel(type: Insight['type']): string {
    const labels: Record<Insight['type'], string> = {
      correlation: 'Correlation',
      outlier: 'Outlier',
      trend: 'Trend',
      seasonality: 'Seasonality',
      distribution: 'Distribution',
      sudden_change: 'Sudden change',
    };
    return labels[type];
  }

  insightConfidenceClass(confidence: number): string {
    if (confidence > 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  }
  
  /**
   * Visualizes an insight by configuring the chart appropriately
   */
  visualizeInsight(insight: Insight): void {
    this.selectedTab = 'chart';
    
    const affectedFields = insight.affectedFields;
    
    switch (insight.type) {
      case 'correlation':
        // Set up scatter plot for correlated fields
        if (affectedFields.length >= 2) {
          this.chart.dimension = '';
          this.chart.measure = affectedFields[0];
          this.chart.secondMeasure = affectedFields[1];
          this.chart.type = 'scatter';
          this.chart.title = `${affectedFields[0]} vs ${affectedFields[1]}`;
        }
        break;
        
      case 'outlier':
        // Show the field with outliers
        if (affectedFields.length >= 1) {
          this.chart.measure = affectedFields[0];
          this.chart.dimension = '';
          this.chart.type = 'histogram';
          this.chart.title = `Distribution of ${affectedFields[0]}`;
        }
        break;
        
      case 'trend':
      case 'seasonality':
        // Set up line chart for trend/seasonal patterns
        if (affectedFields.length >= 2) {
          this.chart.dimension = affectedFields[0]; // Date field
          this.chart.measure = affectedFields[1]; // Numeric field
          this.chart.type = 'line';
          this.chart.title = `${affectedFields[1]} over ${affectedFields[0]}`;
        }
        break;
        
      case 'sudden_change':
        // Show the field as a line chart
        if (affectedFields.length >= 1) {
          const dateField = this.dimensions().find(d => d.type === 'Date' || d.type === 'DateTime');
          if (dateField) {
            this.chart.dimension = dateField.name;
            this.chart.measure = affectedFields[0];
            this.chart.type = 'line';
            this.chart.title = `${affectedFields[0]} - Sudden Change Detected`;
          }
        }
        break;
    }
    
    this.applyRecommendation();
  }

  /**
   * Handle visualization creation from AI insights
   */
  handleAIVisualization(result: AIQueryResult): void {
    console.log('[Visualization] Received result:', result);
    
    if (!result.visualization) {
      console.log('[Visualization] No visualization data in result');
      this.notification = 'No visualization available for this query';
      return;
    }

    const viz = result.visualization;
    console.log('[Visualization] Visualization config:', viz);
    
    // Validate that we have the necessary fields
    if (viz.type !== 'kpi' && viz.type !== 'table' && !viz.measure) {
      console.error('[Visualization] Missing measure field');
      this.notification = 'Cannot create chart: missing data field';
      return;
    }
    
    // Reset chart
    this.chart = emptyChart();
    
    // Apply AI recommendations
    if (viz.dimension) {
      this.chart.dimension = viz.dimension;
      console.log('[Visualization] Set dimension:', viz.dimension);
    }
    
    if (viz.measure) {
      this.chart.measure = viz.measure;
      console.log('[Visualization] Set measure:', viz.measure);
    }
    
    if (viz.config?.secondMeasure) {
      this.chart.secondMeasure = viz.config.secondMeasure;
      console.log('[Visualization] Set secondMeasure:', viz.config.secondMeasure);
    }
    
    // Map AI viz type to app chart type
    const typeMap: Record<string, ChartType> = {
      'table': 'kpi', // Map table to KPI for now
      'line': 'line',
      'bar': 'bar',
      'pie': 'donut',
      'scatter': 'scatter',
      'kpi': 'kpi'
    };
    
    this.chart.type = typeMap[viz.type] || 'bar';
    console.log('[Visualization] Chart type:', this.chart.type);
    
    // Generate title from the question/answer
    const measure = viz.measure || 'data';
    const dimension = viz.dimension || '';
    
    if (dimension) {
      this.chart.title = `${measure} by ${dimension}`;
    } else {
      this.chart.title = `${measure} Analysis`;
    }
    
    // Switch to chart tab
    this.selectedTab = 'chart';
    
    // Refresh chart data
    this.refreshChart();
    
    console.log('[Visualization] Chart config:', this.chart);
    console.log('[Visualization] Chart data points:', this.chartData.length);
    
    if (this.chartData.length === 0) {
      this.notification = 'Chart created but no data to display. Check field names.';
    } else {
      this.notification = `Chart created with ${this.chartData.length} data points`;
    }
  }

  setSmartChartDefaults(): void {
    const dimension = this.dimensions()[0]?.name || this.columns()[0] || '';
    const measure = this.measures()[0]?.name || '';
    this.chart = { ...emptyChart(), title: measure && dimension ? `${measure} by ${dimension}` : 'Data overview', dimension, measure };
    this.applyRecommendation();
  }

  applyRecommendation(recommendation?: ChartRecommendation): void {
    if (recommendation) {
      this.chart.type = recommendation.chartType;
      const config = recommendation.suggestedConfig;
      if (config.aggregation) this.chart.aggregation = config.aggregation;
      if (config.sort) this.chart.sort = config.sort;
      if (config.topN !== undefined) this.chart.topN = config.topN;
      this.selectedTab = 'chart';
      this.refreshChart();
      this.notification = `Applied ${recommendation.chartType} chart recommendation.`;
      return;
    }

    const recommendations = this.analytics.getRecommendations(
      this.chart.dimension || null,
      this.chart.measure || null,
      this.chart.secondMeasure || null,
      this.profiles(),
      this.rows(),
    );
    const bestRecommendation = recommendations[0];
    const dimension = this.profiles().find((field) => field.name === this.chart.dimension);
    const measure = this.profiles().find((field) => field.name === this.chart.measure);
    const secondMeasure = this.profiles().find((field) => field.name === this.chart.secondMeasure);
    if (bestRecommendation) {
      this.chart.type = bestRecommendation.chartType;
      if (bestRecommendation.suggestedConfig.aggregation) this.chart.aggregation = bestRecommendation.suggestedConfig.aggregation;
      if (bestRecommendation.suggestedConfig.sort) this.chart.sort = bestRecommendation.suggestedConfig.sort;
    } else if (dimension?.type.includes('Date') && measure) this.chart.type = 'line';
    else if (measure && secondMeasure) this.chart.type = 'scatter';
    else if (dimension && measure && dimension.unique <= 8) this.chart.type = 'donut';
    else if (dimension && measure) this.chart.type = 'bar';
    else if (measure) this.chart.type = 'histogram';
    else this.chart.type = 'kpi';
    this.refreshChart();
  }

  toggleQualityDetails(): void {
    this.qualityDetailsOpen = !this.qualityDetailsOpen;
  }

  goToAnalysisTab(tab: 'profile' | 'insights' | 'chart' | 'dashboard'): void {
    this.selectedTab = tab;
  }

  async generateForecast(): Promise<void> {
    if (!this.canForecast() || this.forecastBusy) return;

    this.forecastBusy = true;
    this.forecastError = '';
    try {
      const forecast = await this.analytics.generateForecast(
        this.chart.dimension,
        this.chart.measure,
        this.rows(),
        Math.min(100, Math.max(1, Math.round(this.forecastPeriods))),
      );
      this.forecastPeriods = forecast.predictions.length;
      this.notification = `Forecast generated using ${forecast.method.replace('_', ' ')}.`;
    } catch (error) {
      this.forecastError = error instanceof Error ? error.message : 'Unable to generate a forecast.';
      this.notification = 'Forecast generation failed.';
    } finally {
      this.forecastBusy = false;
    }
  }

  forecastApplies(def: ChartDefinition): boolean {
    return def.type === 'line'
      && def.dimension === this.chart.dimension
      && def.measure === this.chart.measure;
  }

  refreshChart(): void {
    this.chartData = this.computeChartData(this.chart);
  }

  computeChartData(def: ChartDefinition): ChartPoint[] {
    const rows = this.filteredRows(def);
    const measure = def.measure;
    const dimension = def.dimension;
    if (def.type === 'kpi') {
      return [{ label: def.aggregation.toUpperCase(), value: this.aggregate(rows.map((row) => this.toNumber(row[measure])), def.aggregation) }];
    }
    if (def.type === 'scatter' && def.secondMeasure) {
      return rows.slice(0, 500).map((row) => ({
        label: String(row[dimension] ?? ''),
        value: this.toNumber(row[measure]),
        x: this.toNumber(row[measure]),
        y: this.toNumber(row[def.secondMeasure]),
      }));
    }
    if (def.type === 'histogram') {
      return this.histogram(rows.map((row) => this.toNumber(row[measure])).filter(Number.isFinite), 12);
    }
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const label = dimension ? String(row[dimension] ?? '(blank)') || '(blank)' : 'All rows';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(this.toNumber(row[measure]));
    }
    let data = [...groups.entries()].map(([label, values]) => ({ label, value: this.aggregate(values, def.aggregation) }));
    if (def.sort !== 'none') data = data.sort((a, b) => (def.sort === 'asc' ? a.value - b.value : b.value - a.value));
    if (def.topN > 0) data = data.slice(0, def.topN);
    return data;
  }

  dashboardData(chart: ChartDefinition): ChartPoint[] {
    return this.computeChartData(chart);
  }

  exportData(): ChartPoint[] {
    return this.computeChartData(this.chart);
  }

  addFilterFromChart(point: ChartPoint, def = this.chart): void {
    if (!def.dimension) return;
    this.globalFilterField = def.dimension;
    this.globalFilterValue = point.label;
    this.refreshChart();
    this.notification = `Cross-filtered dashboard by ${this.globalFilterField}: ${point.label}`;
  }

  saveChart(): void {
    this.refreshChart();
    const chart = structuredClone({ ...this.chart, id: crypto.randomUUID() });
    this.savedCharts.unshift(chart);
    this.notification = `Saved chart "${chart.title}".`;
    this.autosave();
  }

  duplicateChart(chart: ChartDefinition): void {
    this.savedCharts.unshift({ ...structuredClone(chart), id: crypto.randomUUID(), title: `${chart.title} copy` });
    this.autosave();
  }

  editChart(chart: ChartDefinition): void {
    this.chart = structuredClone(chart);
    this.selectedTab = 'chart';
    this.refreshChart();
  }

  addToDashboard(chart: ChartDefinition): void {
    this.dashboardItems.push({ id: crypto.randomUUID(), chartId: chart.id, x: 0, y: this.dashboardItems.length, w: 2, h: 1 });
    this.notification = `Added "${chart.title}" to the dashboard.`;
    this.autosave();
  }

  deleteDashboardItem(id: string): void {
    this.dashboardItems = this.dashboardItems.filter((item) => item.id !== id);
    this.autosave();
  }

  dashboardChart(id: string): ChartDefinition | undefined {
    return this.savedCharts.find((chart) => chart.id === id);
  }

  profileColumn(column: string): FieldProfile {
    const values = this.rows().map((row) => row[column]).filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
    const missing = this.rows().length - values.length;
    const uniqueMap = new Map<string, number>();
    for (const value of values) uniqueMap.set(String(value), (uniqueMap.get(String(value)) || 0) + 1);
    const type = this.schemaOverrides[column] || this.detectType(column, values);
    const numeric = values.map((value) => this.toNumber(value)).filter(Number.isFinite).sort((a, b) => a - b);
    return {
      name: column,
      type,
      missing,
      missingPct: this.rows().length ? Math.round((missing / this.rows().length) * 10000) / 100 : 0,
      unique: uniqueMap.size,
      min: numeric.length ? numeric[0] : values.map(String).sort()[0],
      max: numeric.length ? numeric[numeric.length - 1] : values.map(String).sort().at(-1),
      mean: numeric.length ? this.aggregate(numeric, 'avg') : undefined,
      median: numeric.length ? this.aggregate(numeric, 'median') : undefined,
      stdev: numeric.length ? this.stdev(numeric) : undefined,
      topValues: [...uniqueMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count })),
    };
  }
  detectType(column: string, values: unknown[]): FieldType {
    const sample = values.slice(0, 200).map((value) => String(value).trim());
    if (!sample.length) return 'String';
    const numeric = sample.filter((value) => Number.isFinite(this.toNumber(value))).length / sample.length;
    const dates = sample.filter((value) => !Number.isNaN(Date.parse(value)) && /[-/]/.test(value)).length / sample.length;
    const booleans = sample.filter((value) => /^(true|false|yes|no|0|1)$/i.test(value)).length / sample.length;
    const unique = new Set(sample).size;
    if (/id$|^id|code|sku/i.test(column) && unique / sample.length > 0.8) return 'Identifier';
    if (booleans > 0.8) return 'Boolean';
    if (dates > 0.7) return sample.some((value) => /:\d{2}/.test(value)) ? 'DateTime' : 'Date';
    if (numeric > 0.8) {
      if (sample.some((value) => value.includes('%'))) return 'Percentage';
      if (sample.some((value) => /[$€£₹]/.test(value))) return 'Currency';
      return sample.every((value) => Number.isInteger(this.toNumber(value))) ? 'Integer' : 'Decimal';
    }
    return unique <= Math.max(20, sample.length * 0.25) ? 'Category' : 'String';
  }

  overrideType(column: string, type: FieldType): void {
    this.schemaOverrides[column] = type;
    this.autosave();
  }

  pushUndo(): void {
    this.undoStack.push(structuredClone(this.rows()));
    this.redoStack = [];
  }

  undo(): void {
    const state = this.undoStack.pop();
    if (!state) return;
    this.redoStack.push(structuredClone(this.rows()));
    this.rows.set(state);
    this.refreshChart();
  }

  redo(): void {
    const state = this.redoStack.pop();
    if (!state) return;
    this.undoStack.push(structuredClone(this.rows()));
    this.rows.set(state);
    this.refreshChart();
  }

  transform(action: 'dedupe' | 'emptyRows' | 'emptyColumns' | 'trim'): void {
    this.pushUndo();
    let rows = structuredClone(this.rows());
    if (action === 'dedupe') rows = [...new Map(rows.map((row) => [JSON.stringify(row), row])).values()];
    if (action === 'emptyRows') rows = rows.filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
    if (action === 'trim') rows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])));
    if (action === 'emptyColumns') {
      const columns = this.columns().filter((column) => rows.some((row) => String(row[column] ?? '').trim() !== ''));
      rows = rows.map((row) => this.normalizeRow(row, columns));
      this.columns.set(columns);
    }
    this.rows.set(rows);
    this.transformations.push({ dedupe: 'Removed duplicate rows', emptyRows: 'Removed empty rows', emptyColumns: 'Removed empty columns', trim: 'Trimmed text values' }[action]);
    this.refreshChart();
    this.autosave();
  }

  resetData(): void {
    this.pushUndo();
    this.rows.set(structuredClone(this.importedRows));
    this.transformations.push('Reset to imported state');
    this.refreshChart();
  }

  addCalculatedField(): void {
    this.formulaError = '';
    const name = this.calcName.trim();
    if (!name) {
      this.formulaError = 'Enter a calculated field name.';
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name)) {
      this.formulaError = 'Use a readable field name that starts with a letter.';
      return;
    }
    try {
      const rows = this.rows().map((row) => ({ ...row, [name]: this.evaluateFormula(this.calcFormula, row) }));
      this.pushUndo();
      this.rows.set(rows);
      this.columns.set([...this.columns().filter((column) => column !== name), name]);
      this.calculatedFields.push({ name, formula: this.calcFormula });
      this.calcName = '';
      this.calcFormula = '';
      this.refreshChart();
      this.autosave();
    } catch (error) {
      this.formulaError = error instanceof Error ? error.message : 'Invalid formula.';
    }
  }

  evaluateFormula(formula: string, row: Row): number {
    if (!/^[\w\s().+\-*/%]+$/.test(formula)) throw new Error('Only field names, arithmetic operators and parentheses are supported.');
    let expression = formula;
    for (const column of [...this.columns()].sort((a, b) => b.length - a.length)) {
      const value = this.toNumber(row[column]);
      expression = expression.replace(new RegExp(`\\b${this.escapeRegExp(column)}\\b`, 'g'), String(Number.isFinite(value) ? value : 0));
    }
    if (/[A-Za-z_]/.test(expression)) throw new Error('Formula references an unknown field.');
    const result = Function(`"use strict"; return (${expression});`)();
    return Number.isFinite(result) ? result : 0;
  }

  saveProject(): void {
    const project = this.projectState();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    this.download(blob, `${project.name || 'data-visualization-project'}.dvis`);
    this.rememberProject(project.name);
    this.notification = 'Project file exported. Reopen it with Open Project.';
  }

  openProject(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const project = JSON.parse(String(reader.result)) as ProjectState;
        this.restoreProject(project);
        this.rememberProject(file.name);
        this.notification = `Opened ${file.name}.`;
      } catch {
        this.notification = 'This project file could not be opened.';
      }
    };
    reader.readAsText(file);
  }

  autosave(): void {
    if (!this.rows().length) return;
    localStorage.setItem('dvis-autosave', JSON.stringify(this.projectState()));
  }

  restoreAutosave(): void {
    const saved = localStorage.getItem('dvis-autosave');
    if (saved) this.restoreProject(JSON.parse(saved));
  }

  restoreProject(project: ProjectState): void {
    this.sourcePath = project.sourcePath;
    this.activeSheet = project.activeSheet;
    this.rows.set(project.rows || []);
    this.importedRows = structuredClone(project.rows || []);
    this.columns.set(project.columns || []);
    this.schemaOverrides = project.schemaOverrides || {};
    this.transformations = project.transformations || [];
    this.calculatedFields = project.calculatedFields || [];
    this.savedCharts = project.savedCharts || [];
    this.dashboardItems = project.dashboardItems || [];
    this.setSmartChartDefaults();
  }

  exportCsv(): void {
    const rows = this.filteredRows();
    const csv = [this.columns().join(','), ...rows.map((row) => this.columns().map((column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
    this.download(new Blob([csv], { type: 'text/csv' }), 'filtered-data.csv');
  }

  exportSvg(): void {
    const svg = document.querySelector('.chart-svg')?.outerHTML;
    if (!svg) return;
    this.download(new Blob([svg], { type: 'image/svg+xml' }), `${this.slug(this.chart.title)}.svg`);
  }

  exportPng(): void {
    const svg = document.querySelector('.chart-svg') as SVGElement | null;
    if (!svg) return;
    const image = new Image();
    const xml = new XMLSerializer().serializeToString(svg);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 700;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob && this.download(blob, `${this.slug(this.chart.title)}.png`));
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;
  }

  exportDashboardPdf(): void {
    this.selectedTab = 'dashboard';
    setTimeout(() => window.print());
  }

  filteredRows(def = this.chart): Row[] {
    return this.rows().filter((row) => {
      const chartOk = !def.filterField || String(row[def.filterField] ?? '').toLowerCase().includes(def.filterValue.toLowerCase());
      const globalOk = !this.globalFilterField || String(row[this.globalFilterField] ?? '') === this.globalFilterValue;
      return chartOk && globalOk;
    });
  }

  duplicateCount(): number {
    return this.rows().length - new Set(this.rows().map((row) => JSON.stringify(row))).size;
  }

  normalizeRow(row: Row, columns: string[]): Row {
    return Object.fromEntries(columns.map((column) => [column, row[column] ?? '']));
  }

  toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    return Number(String(value ?? '').replace(/[$€£₹,%\s]/g, ''));
  }

  aggregate(values: number[], aggregation: Aggregation): number {
    const clean = values.filter(Number.isFinite);
    if (aggregation === 'count') return values.length;
    if (aggregation === 'distinct') return new Set(values.map(String)).size;
    if (!clean.length) return 0;
    if (aggregation === 'sum') return clean.reduce((a, b) => a + b, 0);
    if (aggregation === 'avg') return clean.reduce((a, b) => a + b, 0) / clean.length;
    if (aggregation === 'min') return Math.min(...clean);
    if (aggregation === 'max') return Math.max(...clean);
    return this.median(clean);
  }

  histogram(values: number[], bins: number): ChartPoint[] {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min || 1) / bins;
    return Array.from({ length: bins }, (_, index) => {
      const start = min + index * width;
      const end = start + width;
      return { label: `${this.format(start)}-${this.format(end)}`, value: values.filter((value) => value >= start && (index === bins - 1 ? value <= end : value < end)).length };
    });
  }

  median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  stdev(values: number[]): number {
    const mean = this.aggregate(values, 'avg');
    return Math.sqrt(this.aggregate(values.map((value) => (value - mean) ** 2), 'avg'));
  }

  barHeight(value: number, data = this.chartData): number {
    const max = Math.max(...data.map((point) => Math.abs(point.value)), 1);
    return Math.max(2, (Math.abs(value) / max) * 260);
  }

  pointX(index: number, data = this.chartData): number {
    return 70 + index * (980 / Math.max(data.length - 1, 1));
  }

  pointY(value: number, data = this.chartData): number {
    const values = data.map((point) => point.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    return 330 - ((value - min) / (max - min || 1)) * 260;
  }

  scatterX(value = 0, data = this.chartData): number {
    const values = data.map((point) => point.x || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return 70 + ((value - min) / (max - min || 1)) * 980;
  }

  scatterY(value = 0, data = this.chartData): number {
    const values = data.map((point) => point.y || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return 330 - ((value - min) / (max - min || 1)) * 260;
  }

  linePath(data = this.chartData, area = false): string {
    const path = data.map((point, index) => `${index ? 'L' : 'M'} ${this.pointX(index, data)} ${this.pointY(point.value, data)}`).join(' ');
    return area && data.length ? `${path} L ${this.pointX(data.length - 1, data)} 340 L 70 340 Z` : path;
  }

  forecastPointX(index: number, data: ChartPoint[], forecast: ForecastResult): number {
    const totalPoints = data.length + forecast.predictions.length;
    return 70 + index * (980 / Math.max(totalPoints - 1, 1));
  }

  forecastPointY(value: number, data: ChartPoint[], forecast: ForecastResult): number {
    const values = [
      ...data.map((point) => point.value),
      ...forecast.predictions.flatMap((point) => [point.value, point.lowerBound95, point.upperBound95]),
    ];
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    return 330 - ((value - min) / (max - min || 1)) * 260;
  }

  forecastLinePath(data: ChartPoint[], forecast: ForecastResult): string {
    return forecast.predictions
      .map((point, index) => `${index ? 'L' : 'M'} ${this.forecastPointX(data.length + index, data, forecast)} ${this.forecastPointY(point.value, data, forecast)}`)
      .join(' ');
  }

  confidenceAreaPath(data: ChartPoint[], forecast: ForecastResult, level: '80' | '95'): string {
    if (!forecast.predictions.length) return '';
    const lowerKey = level === '80' ? 'lowerBound80' : 'lowerBound95';
    const upperKey = level === '80' ? 'upperBound80' : 'upperBound95';
    const upper = forecast.predictions.map((point, index) =>
      `${index ? 'L' : 'M'} ${this.forecastPointX(data.length + index, data, forecast)} ${this.forecastPointY(point[upperKey], data, forecast)}`,
    ).join(' ');
    const lower = [...forecast.predictions].reverse().map((point, reverseIndex) => {
      const index = forecast.predictions.length - 1 - reverseIndex;
      return `L ${this.forecastPointX(data.length + index, data, forecast)} ${this.forecastPointY(point[lowerKey], data, forecast)}`;
    }).join(' ');
    return `${upper} ${lower} Z`;
  }

  pieSlices(data = this.chartData): { path: string; color: string; label: string; value: number }[] {
    const total = data.reduce((sum, point) => sum + Math.abs(point.value), 0) || 1;
    let start = -Math.PI / 2;
    return data.map((point, index) => {
      const angle = (Math.abs(point.value) / total) * Math.PI * 2;
      const end = start + angle;
      const large = angle > Math.PI ? 1 : 0;
      const r = 125;
      const x1 = 560 + r * Math.cos(start);
      const y1 = 185 + r * Math.sin(start);
      const x2 = 560 + r * Math.cos(end);
      const y2 = 185 + r * Math.sin(end);
      const path = `M 560 185 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      start = end;
      return { path, color: this.palette(index), label: point.label, value: point.value };
    });
  }

  boxStats(def = this.chart): { label: string; min: number; q1: number; median: number; q3: number; max: number }[] {
    const groups = new Map<string, number[]>();
    for (const row of this.filteredRows(def)) {
      const label = def.dimension ? String(row[def.dimension] ?? '(blank)') : 'All';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(this.toNumber(row[def.measure]));
    }
    return [...groups.entries()].slice(0, def.topN || 10).map(([label, values]) => {
      const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
      return { label, min: sorted[0] || 0, q1: sorted[Math.floor(sorted.length * 0.25)] || 0, median: this.median(sorted), q3: sorted[Math.floor(sorted.length * 0.75)] || 0, max: sorted.at(-1) || 0 };
    });
  }

  chartXLabel(def: ChartDefinition): string {
    if (def.type === 'scatter') return def.measure || 'X Axis';
    if (def.type === 'histogram') return def.measure || 'Value';
    if (def.type === 'kpi' || def.type === 'pie' || def.type === 'donut') return '';
    return def.dimension || 'X Axis';
  }

  chartYLabel(def: ChartDefinition): string {
    if (def.type === 'scatter') return def.secondMeasure || 'Y Axis';
    if (def.type === 'histogram') return 'Count';
    if (def.type === 'kpi' || def.type === 'pie' || def.type === 'donut') return '';
    return `${def.aggregation.toUpperCase()} ${def.measure || 'Y Axis'}`;
  }

  palette(index: number): string {
    return ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#4f46e5', '#65a30d'][index % 8];
  }

  format(value: number | undefined): string {
    if (value === undefined || Number.isNaN(value)) return '-';
    return Intl.NumberFormat(undefined, { maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0 }).format(value);
  }

  projectState(): ProjectState {
    return {
      name: this.sourcePath.replace(/\.[^.]+$/, '') || 'Untitled project',
      sourcePath: this.sourcePath,
      sheets: this.workbookSheets.map((sheet) => sheet.name),
      activeSheet: this.activeSheet,
      rows: this.rows(),
      columns: this.columns(),
      schemaOverrides: this.schemaOverrides,
      transformations: this.transformations,
      calculatedFields: this.calculatedFields,
      savedCharts: this.savedCharts,
      dashboardItems: this.dashboardItems,
    };
  }

  rememberProject(name: string): void {
    this.recentProjects = [name, ...this.recentProjects.filter((item) => item !== name)].slice(0, 6);
    localStorage.setItem('dvis-recent', JSON.stringify(this.recentProjects));
  }

  download(blob: Blob, name: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  slug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'export';
  }

  escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
