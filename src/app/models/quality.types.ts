/**
 * Quality analysis result types.
 */

export type QualityCategory = 'completeness' | 'consistency' | 'accuracy' | 'uniqueness';
export type QualitySeverity = 'critical' | 'moderate' | 'minor';

export interface QualityFieldIssue {
  field: string;
  severity: QualitySeverity;
}

export interface QualityComponent {
  score: number;
  details: string;
  fieldIssues: QualityFieldIssue[];
  duplicateRows?: number;
}

export interface QualitySuggestion {
  id: string;
  category: QualityCategory;
  severity: QualitySeverity;
  impact: number;
  description: string;
  action: string;
  affectedFields: string[];
}

export interface QualityIssues {
  critical: QualitySuggestion[];
  moderate: QualitySuggestion[];
  minor: QualitySuggestion[];
}

export interface QualityScore {
  overall: number;
  components: {
    completeness: number;
    consistency: number;
    accuracy: number;
    uniqueness: number;
  };
  suggestions: QualitySuggestion[];
  issues: QualityIssues;
}
