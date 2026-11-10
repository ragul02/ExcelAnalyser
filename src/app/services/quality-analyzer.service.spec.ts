import { TestBed } from '@angular/core/testing';
import { QualityAnalyzerService } from './quality-analyzer.service';

describe('QualityAnalyzerService', () => {
  let service: QualityAnalyzerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QualityAnalyzerService);
  });

  it('reports unparsable numeric values as validity issues', () => {
    const profiles = [{
      name: 'Revenue', type: 'Currency' as const, missing: 0, missingPct: 0, unique: 3,
      topValues: [],
    }];
    const result = service.analyzeQuality(
      [{ Revenue: '$12' }, { Revenue: 'not available' }, { Revenue: '$9000' }],
      ['Revenue'],
      profiles,
    );

    expect(result.components.validity).toBeLessThan(100);
    expect(result.suggestions.some((suggestion) => suggestion.category === 'validity')).toBe(true);
  });

  it('does not call statistically unusual values inaccurate', () => {
    const profiles = [{
      name: 'Value', type: 'Decimal' as const, missing: 0, missingPct: 0, unique: 4,
      topValues: [],
    }];
    const result = service.analyzeQuality(
      [{ Value: 1 }, { Value: 2 }, { Value: 3 }, { Value: 1000 }],
      ['Value'],
      profiles,
    );

    expect(result.components.validity).toBe(100);
    expect(result.suggestions.some((suggestion) => suggestion.description.includes('inaccurate'))).toBe(false);
  });
});
