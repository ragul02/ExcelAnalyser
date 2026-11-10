import { TestBed } from '@angular/core/testing';
import { ForecastService } from './forecast.service';

describe('ForecastService', () => {
  let service: ForecastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ForecastService);
  });

  it('aggregates repeated timestamps and reports possible gaps', () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 0, index + 1)),
      revenue: `$${index + 1}`,
    }));
    rows.push({ date: new Date(Date.UTC(2025, 0, 10)), revenue: '$5' });
    rows.push({ date: new Date(Date.UTC(2025, 0, 12)), revenue: '$12' });

    const series = service.prepareTimeSeries(rows, 'date', 'revenue');

    expect(series.values).toHaveLength(11);
    expect(series.values.at(-2)).toBe(15);
    expect(series.duplicatePeriods).toBe(1);
    expect(series.missingPeriods).toBe(1);
  });
});
