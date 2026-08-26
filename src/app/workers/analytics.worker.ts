import { expose } from 'comlink';
import { ForecastPoint, ForecastResult } from '../models/forecast.types';
import { Insight } from '../models/insight.types';

type Row = Record<string, unknown>;
type FieldType = 'String' | 'Category' | 'Integer' | 'Decimal' | 'Currency' | 'Percentage' | 'Date' | 'DateTime' | 'Boolean' | 'Identifier';

type FieldProfile = {
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
};

export interface AnalyticsWorkerApi {
  analyzeDataset(rows: Row[], profiles: FieldProfile[]): Promise<Insight[]>;
  generateForecast(dateField: string, measureField: string, rows: Row[], periods: number): Promise<ForecastResult>;
  calculateCorrelationMatrix(rows: Row[], fields: string[]): Promise<Record<string, Record<string, number>>>;
}

const numericTypes: FieldType[] = ['Integer', 'Decimal', 'Currency', 'Percentage'];

function numericValues(rows: Row[], field: string): number[] {
  return rows
    .map((row) => typeof row[field] === 'number'
      ? row[field] as number
      : Number(String(row[field] ?? '').replace(/[$€£₹,%\s]/g, '')))
    .filter((value) => Number.isFinite(value));
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function correlation(first: number[], second: number[]): number {
  const count = Math.min(first.length, second.length);
  if (count < 2) return 0;
  const firstMean = mean(first.slice(0, count));
  const secondMean = mean(second.slice(0, count));
  let numerator = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  for (let index = 0; index < count; index++) {
    const firstDelta = first[index] - firstMean;
    const secondDelta = second[index] - secondMean;
    numerator += firstDelta * secondDelta;
    firstVariance += firstDelta ** 2;
    secondVariance += secondDelta ** 2;
  }
  const denominator = Math.sqrt(firstVariance * secondVariance);
  return denominator ? numerator / denominator : 0;
}

function outlierIndices(values: number[]): number[] {
  if (values.length < 4) return [];
  const sorted = [...values].sort((first, second) => first - second);
  const percentile = (position: number): number => {
    const index = position * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  };
  const lowerBound = percentile(.25) - 1.5 * (percentile(.75) - percentile(.25));
  const upperBound = percentile(.75) + 1.5 * (percentile(.75) - percentile(.25));
  return values
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value < lowerBound || item.value > upperBound)
    .map((item) => item.index);
}

function profileIsDate(profile: FieldProfile): boolean {
  return profile.type === 'Date' || profile.type === 'DateTime';
}

function detectInsights(rows: Row[], profiles: FieldProfile[]): Insight[] {
  const insights: Insight[] = [];
  const numericProfiles = profiles.filter((profile) => numericTypes.includes(profile.type));

  for (let firstIndex = 0; firstIndex < numericProfiles.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < numericProfiles.length; secondIndex++) {
      const first = numericValues(rows, numericProfiles[firstIndex].name);
      const second = numericValues(rows, numericProfiles[secondIndex].name);
      const coefficient = correlation(first, second);
      if (Math.abs(coefficient) < .7) continue;
      const direction = coefficient > 0 ? 'positive' : 'negative';
      insights.push({
        id: crypto.randomUUID(),
        type: 'correlation',
        title: `Strong ${direction} correlation detected`,
        description: `${numericProfiles[firstIndex].name} and ${numericProfiles[secondIndex].name} show a strong ${direction} correlation (r = ${coefficient.toFixed(3)})`,
        confidence: Math.min(95, Math.round(Math.abs(coefficient) * 100)),
        affectedFields: [numericProfiles[firstIndex].name, numericProfiles[secondIndex].name],
        metadata: { field1: numericProfiles[firstIndex].name, field2: numericProfiles[secondIndex].name, coefficient, sampleSize: Math.min(first.length, second.length) },
        dismissed: false,
        timestamp: new Date(),
      });
    }
  }

  for (const profile of numericProfiles) {
    const values = numericValues(rows, profile.name);
    const indices = outlierIndices(values);
    if (indices.length < 5) continue;
    insights.push({
      id: crypto.randomUUID(),
      type: 'outlier',
      title: `${indices.length} outliers detected in ${profile.name}`,
      description: `${profile.name} contains ${indices.length} values outside the expected IQR range`,
      confidence: Math.min(95, Math.round(60 + (indices.length / values.length) * 100)),
      affectedFields: [profile.name],
      metadata: { field: profile.name, outlierCount: indices.length, outlierIndices: indices, method: 'iqr', threshold: 1.5 },
      dismissed: false,
      timestamp: new Date(),
    });
  }

  const dateProfiles = profiles.filter(profileIsDate);
  for (const dateProfile of dateProfiles) {
    for (const numericProfile of numericProfiles) {
      const values = rows
        .map((row) => ({ date: new Date(String(row[dateProfile.name] ?? '')), value: numericValues([row], numericProfile.name)[0] }))
        .filter((item) => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.value))
        .sort((first, second) => first.date.getTime() - second.date.getTime());
      if (values.length < 3) continue;
      const slope = linearSlope(values.map((_, index) => index), values.map((item) => item.value));
      const range = Math.max(...values.map((item) => item.value)) - Math.min(...values.map((item) => item.value));
      if (!range || Math.abs(slope / range) < .01) continue;
      const trendType = slope > 0 ? 'increasing' : 'decreasing';
      insights.push({
        id: crypto.randomUUID(),
        type: 'trend',
        title: `${trendType} trend detected in ${numericProfile.name}`,
        description: `${numericProfile.name} shows an ${trendType} trend over ${dateProfile.name}`,
        confidence: Math.min(95, Math.round(Math.abs(slope / range) * 100)),
        affectedFields: [dateProfile.name, numericProfile.name],
        metadata: { field: numericProfile.name, trendType, slope },
        dismissed: false,
        timestamp: new Date(),
      });
    }
  }

  return insights.sort((first, second) => second.confidence - first.confidence);
}

function linearSlope(first: number[], second: number[]): number {
  const count = Math.min(first.length, second.length);
  if (count < 2) return 0;
  const firstMean = mean(first.slice(0, count));
  const secondMean = mean(second.slice(0, count));
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index++) {
    numerator += (first[index] - firstMean) * (second[index] - secondMean);
    denominator += (first[index] - firstMean) ** 2;
  }
  return denominator ? numerator / denominator : 0;
}

function nextDate(date: Date, dates: Date[]): Date {
  const lastGap = dates.length > 1 ? dates[dates.length - 1].getTime() - dates[dates.length - 2].getTime() : 86400000;
  return new Date(date.getTime() + Math.max(lastGap, 86400000));
}

function forecast(dateField: string, measureField: string, rows: Row[], periods: number): ForecastResult {
  const pairs = rows
    .map((row) => ({ date: new Date(String(row[dateField] ?? '')), value: numericValues([row], measureField)[0] }))
    .filter((pair) => !Number.isNaN(pair.date.getTime()) && Number.isFinite(pair.value))
    .sort((first, second) => first.date.getTime() - second.date.getTime());
  if (pairs.length < 10) throw new Error('Requires at least 10 valid data points for forecasting');
  const values = pairs.map((pair) => pair.value);
  const level = values.reduce((current, value) => .3 * value + .7 * current, values[0]);
  const slope = linearSlope(values.map((_, index) => index), values);
  const deviation = standardDeviation(values) || Math.abs(level) * .05 || 1;
  const predictions: ForecastPoint[] = [];
  let date = pairs[pairs.length - 1].date;
  for (let index = 0; index < periods; index++) {
    date = nextDate(date, pairs.map((pair) => pair.date));
    const value = level + slope * (index + 1);
    predictions.push({ date, value, lowerBound80: value - deviation * 1.28, upperBound80: value + deviation * 1.28, lowerBound95: value - deviation * 1.96, upperBound95: value + deviation * 1.96 });
  }
  return {
    predictions,
    accuracy: {},
    method: 'exponential_smoothing',
    parameters: { alpha: .3, periods },
    patternInfo: { hasTrend: Math.abs(slope) > 0, trendType: Math.abs(slope) > 0 ? 'linear' : 'none', hasSeasonality: false },
  };
}

const api: AnalyticsWorkerApi = {
  async analyzeDataset(rows, profiles) {
    return detectInsights(rows, profiles);
  },
  async generateForecast(dateField, measureField, rows, periods) {
    return forecast(dateField, measureField, rows, periods);
  },
  async calculateCorrelationMatrix(rows, fields) {
    const matrix: Record<string, Record<string, number>> = {};
    for (const firstField of fields) {
      matrix[firstField] = {};
      for (const secondField of fields) {
        matrix[firstField][secondField] = correlation(numericValues(rows, firstField), numericValues(rows, secondField));
      }
    }
    return matrix;
  },
};

expose(api);
