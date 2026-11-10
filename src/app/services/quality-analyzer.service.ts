import { Service } from '@angular/core';
import {
  QualityCategory,
  QualityComponent,
  QualityFieldIssue,
  QualityScore,
  QualitySeverity,
  QualitySuggestion,
} from '../models/quality.types';

type Row = Record<string, unknown>;
type FieldType = 'String' | 'Category' | 'Integer' | 'Decimal' | 'Currency' | 'Percentage' | 'Date' | 'DateTime' | 'Boolean' | 'Identifier';

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

/**
 * Analyzes dataset quality without sending data outside the application.
 */
@Service()
export class QualityAnalyzerService {
  private readonly numericTypes: FieldType[] = ['Integer', 'Decimal', 'Currency', 'Percentage'];

  analyzeQuality(rows: Row[], columns: string[], profiles: FieldProfile[]): QualityScore {
    const completeness = this.assessCompleteness(profiles, rows.length);
    const consistency = this.assessConsistency(rows, profiles);
    const validity = this.assessValidity(rows, profiles);
    const uniqueness = this.assessUniqueness(rows, columns, profiles);
    const components = { completeness, consistency, validity, uniqueness };
    const suggestions = this.generateSuggestions(components);
    const overall = Math.round(
      completeness.score * 0.3
      + consistency.score * 0.25
      + validity.score * 0.25
      + uniqueness.score * 0.2,
    );
    const issues = {
      critical: suggestions.filter((suggestion) => suggestion.severity === 'critical'),
      moderate: suggestions.filter((suggestion) => suggestion.severity === 'moderate'),
      minor: suggestions.filter((suggestion) => suggestion.severity === 'minor'),
    };

    return {
      overall: Math.max(0, Math.min(100, overall)),
      components: {
        completeness: completeness.score,
        consistency: consistency.score,
        validity: validity.score,
        uniqueness: uniqueness.score,
      },
      suggestions,
      issues,
    };
  }

  assessCompleteness(profiles: FieldProfile[], totalRows: number): QualityComponent {
    const missingCells = profiles.reduce((sum, profile) => sum + profile.missing, 0);
    const totalCells = totalRows * profiles.length;
    const missingPct = totalCells > 0 ? (missingCells / totalCells) * 100 : 0;
    const fieldIssues = profiles
      .filter((profile) => profile.missingPct > 10)
      .map((profile) => ({
        field: profile.name,
        severity: this.severityForImpact(profile.missingPct),
      }));

    return {
      score: this.scoreFromImpact(missingPct),
      details: `${missingPct.toFixed(1)}% of cells are missing values`,
      fieldIssues,
    };
  }

  assessConsistency(rows: Row[], profiles: FieldProfile[]): QualityComponent {
    const fieldIssues: QualityFieldIssue[] = [];
    let inconsistentValues = 0;
    let inspectedValues = 0;

    for (const profile of profiles) {
      const values = rows
        .map((row) => row[profile.name])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
      const formats = new Set(values.map((value) => this.valueFormat(value, profile.type)));
      if (formats.size > 1) {
        const dominantFormat = this.dominantFormat(values, profile.type);
        const fieldInconsistencies = values.filter(
          (value) => this.valueFormat(value, profile.type) !== dominantFormat,
        ).length;
        inconsistentValues += fieldInconsistencies;
        inspectedValues += values.length;
        fieldIssues.push({
          field: profile.name,
          severity: this.severityForImpact((fieldInconsistencies / Math.max(values.length, 1)) * 100),
        });
      }
    }

    const impact = inspectedValues ? (inconsistentValues / inspectedValues) * 100 : 0;
    return {
      score: this.scoreFromImpact(impact),
      details: fieldIssues.length
        ? `${fieldIssues.length} field${fieldIssues.length === 1 ? '' : 's'} contain inconsistent formats`
        : 'No format inconsistencies detected',
      fieldIssues,
    };
  }

  assessValidity(rows: Row[], profiles: FieldProfile[]): QualityComponent {
    const fieldIssues: QualityFieldIssue[] = [];
    let invalidCount = 0;
    let inspectedCount = 0;

    for (const profile of profiles.filter((candidate) => this.numericTypes.includes(candidate.type))) {
      const values = rows.map((row) => row[profile.name])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
      const invalidValues = values.filter((value) => !Number.isFinite(
        typeof value === 'number' ? value : Number(String(value).replace(/[$€£₹,%\s]/g, '')),
      )).length;
      inspectedCount += values.length;
      invalidCount += invalidValues;
      if (invalidValues > 0) {
        fieldIssues.push({
          field: profile.name,
          severity: this.severityForImpact((invalidValues / Math.max(values.length, 1)) * 100),
        });
      }
    }

    const impact = inspectedCount ? (invalidCount / inspectedCount) * 100 : 0;
    return {
      score: this.scoreFromImpact(impact),
      details: invalidCount
        ? `${invalidCount} non-empty value${invalidCount === 1 ? '' : 's'} could not be parsed as numeric`
        : 'All non-empty values in numeric fields could be parsed',
      fieldIssues,
    };
  }

  assessUniqueness(rows: Row[], columns: string[], profiles: FieldProfile[]): QualityComponent {
    const duplicateRows = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size;
    const fieldIssues: QualityFieldIssue[] = [];
    for (const profile of profiles) {
      if (profile.type === 'Identifier' && profile.unique < rows.length * 0.8) {
        fieldIssues.push({
          field: profile.name,
          severity: this.severityForImpact(((rows.length - profile.unique) / Math.max(rows.length, 1)) * 100),
        });
      }
    }

    const duplicateImpact = rows.length ? (duplicateRows / rows.length) * 100 : 0;
    const lowCardinalityImpact = fieldIssues.length ? 10 : 0;
    const impact = Math.min(100, duplicateImpact + lowCardinalityImpact);
    return {
      score: this.scoreFromImpact(impact),
      details: duplicateRows
        ? `${duplicateRows} duplicate row${duplicateRows === 1 ? '' : 's'} detected across ${columns.length} columns`
        : fieldIssues.length
          ? 'Identifier fields contain repeated values'
          : 'No duplicate rows or suspicious identifiers detected',
      fieldIssues,
      duplicateRows,
    };
  }

  private generateSuggestions(components: {
    completeness: QualityComponent;
    consistency: QualityComponent;
    validity: QualityComponent;
    uniqueness: QualityComponent;
  }): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];
    this.addFieldSuggestions(suggestions, 'completeness', components.completeness, (field) => `Fill missing values in ${field}`);
    this.addFieldSuggestions(suggestions, 'consistency', components.consistency, (field) => `Standardize formatting in ${field}`);
    this.addFieldSuggestions(suggestions, 'validity', components.validity, (field) => `Review values that could not be parsed in ${field}`);
    this.addFieldSuggestions(suggestions, 'uniqueness', components.uniqueness, (field) => `Review repeated values in identifier field ${field}`);
    if (components.uniqueness.duplicateRows) {
      const duplicateRows = components.uniqueness.duplicateRows;
      const impact = components.uniqueness.fieldIssues.length ? 15 : 25;
      suggestions.push({
        id: 'uniqueness-duplicate-rows',
        category: 'uniqueness',
        severity: this.severityForImpact(impact),
        impact,
        description: `Remove ${duplicateRows} duplicate row${duplicateRows === 1 ? '' : 's'}`,
        action: 'Remove duplicate rows before analysis',
        affectedFields: [],
      });
    }
    return suggestions.sort((first, second) => second.impact - first.impact);
  }

  private addFieldSuggestions(
    suggestions: QualitySuggestion[],
    category: QualityCategory,
    component: QualityComponent,
    actionForField: (field: string) => string,
  ): void {
    for (const issue of component.fieldIssues) {
      const impact = issue.severity === 'critical' ? 25 : issue.severity === 'moderate' ? 15 : 5;
      suggestions.push({
        id: `${category}-${issue.field}`,
        category,
        severity: issue.severity,
        impact,
        description: actionForField(issue.field),
        action: actionForField(issue.field),
        affectedFields: [issue.field],
      });
    }
  }

  private scoreFromImpact(impact: number): number {
    return Math.max(0, Math.round(100 - Math.min(100, impact)));
  }

  private severityForImpact(impact: number): QualitySeverity {
    if (impact > 20) return 'critical';
    if (impact >= 10) return 'moderate';
    return 'minor';
  }

  private numericValues(rows: Row[], field: string): number[] {
    return rows
      .map((row) => typeof row[field] === 'number' ? row[field] as number : Number(String(row[field] ?? '').replace(/[$€£₹,%\s]/g, '')))
      .filter((value) => Number.isFinite(value));
  }

  private valueFormat(value: unknown, type: FieldType): string {
    if (type === 'Date' || type === 'DateTime') {
      const text = String(value).trim();
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text)) return 'iso';
      if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(text)) return 'local';
      return 'other';
    }
    if (this.numericTypes.includes(type)) return Number.isFinite(Number(String(value).replace(/[$€£₹,%\s]/g, ''))) ? 'numeric' : 'invalid';
    return String(value).trim().toLowerCase();
  }

  private dominantFormat(values: unknown[], type: FieldType): string {
    const counts = new Map<string, number>();
    for (const value of values) {
      const format = this.valueFormat(value, type);
      counts.set(format, (counts.get(format) || 0) + 1);
    }
    return [...counts.entries()].sort((first, second) => second[1] - first[1])[0]?.[0] || 'other';
  }
}
