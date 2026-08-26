# Implementation Plan: Advanced Analytics (Requirements 1-4)

## Overview

This implementation plan covers the first phase of Advanced Analytics capabilities:
1. AI-Powered Insights Detection
2. Time Series Forecasting  
3. Smart Chart Recommendations
4. Advanced Data Quality Scoring

The implementation uses Angular 22 with signals, TensorFlow.js for ML capabilities, and Web Workers for heavy computation. All features work offline-first and integrate seamlessly with the existing App component.

## Tasks

- [x] 1. Install dependencies and set up infrastructure
  - Install TensorFlow.js and Comlink packages
  - Create tsconfig.worker.json for Web Worker support
  - Update angular.json to enable Web Worker compilation
  - _Requirements: 1.10, 2.10, 7.1, 8.2, 8.3_

- [x] 2. Create core analytics services
  - [x] 2.1 Create StatisticsService with pure statistical functions
    - Implement pearsonCorrelation for correlation detection
    - Implement detectOutliers using IQR method
    - Implement detectTrend for linear regression slope analysis
    - Implement detectSeasonality using autocorrelation
    - Implement exponentialSmoothing and holtWinters algorithms
    - Add helper methods: mean, median, standardDeviation, percentile
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.4, 2.5, 2.8_
  
  - [x] 2.2 Create TensorFlowService for ML model management
    - Initialize TensorFlow.js with WebGL backend (fallback to CPU)
    - Implement lazy loading of TF.js (load only when first accessed)
    - Add memory monitoring and cleanup methods
    - Handle backend initialization errors gracefully
    - _Requirements: 7.5, 7.6, 8.2, 8.3, 8.6_
  
  - [x] 2.3 Create CacheService for performance optimization
    - Implement cache for insights with 5-minute TTL
    - Implement cache for forecasts with key-based invalidation
    - Add hashDataset method using first 100 rows sample
    - Provide cache invalidation on dataset changes
    - _Requirements: 7.3, 7.8_

- [x] 3. Implement InsightDetectorService
  - [x] 3.1 Create InsightDetectorService skeleton and correlation detection
    - Create service with inject() for StatisticsService
    - Implement detectCorrelations for numeric field pairs
    - Filter correlations with |coefficient| > 0.7
    - Generate CorrelationInsight objects with confidence scores
    - _Requirements: 1.1, 1.2, 1.3, 1.8_
  
  - [x] 3.2 Implement outlier detection
    - Implement detectOutliers using IQR method (1.5 × IQR threshold)
    - Calculate z-scores for outlier confidence
    - Generate OutlierInsight objects with affected row indices
    - Limit results to fields with at least 5 outliers
    - _Requirements: 1.4, 1.8_
  
  - [x] 3.3 Implement trend and seasonality detection
    - Implement detectTrends for date-based numeric fields
    - Detect sudden changes where rate exceeds 2 standard deviations
    - Implement detectSeasonality for fields with 12+ data points
    - Generate TrendInsight and SeasonalityInsight objects
    - _Requirements: 1.5, 1.6, 1.8_
  
  - [x] 3.4 Implement insight ranking and integration
    - Create rankInsights method sorting by confidence score
    - Implement performance target: complete in < 5 seconds for 100K rows
    - Add Web Worker delegation for datasets > 10K rows
    - _Requirements: 1.2, 1.9_

- [x] 4. Implement ForecastService
  - [x] 4.1 Create ForecastService with time series validation
    - Create service structure with inject() dependencies
    - Implement prepareTimeSeries to extract date-value pairs
    - Implement isValidTimeSeries checking minimum 10 data points
    - Handle invalid time series with clear error messages
    - _Requirements: 2.1, 2.9_
  
  - [x] 4.2 Implement pattern detection for forecasting
    - Implement detectTrend identifying linear/exponential/logarithmic patterns
    - Implement detectSeasonality with configurable periodicity
    - Calculate pattern strength metrics
    - _Requirements: 2.4, 2.5_
  
  - [x] 4.3 Implement exponential smoothing forecasting
    - Implement exponentialSmoothing algorithm (Holt-Winters)
    - Generate forecast points for N periods (default 10)
    - Calculate 80% and 95% confidence intervals
    - Return ForecastResult with predictions and confidence bounds
    - _Requirements: 2.2, 2.3, 2.6, 2.8_
  
  - [x] 4.4 Add forecast accuracy metrics
    - Calculate RMSE (Root Mean Square Error) when validation possible
    - Calculate MAE (Mean Absolute Error)
    - Calculate MAPE (Mean Absolute Percentage Error)
    - Include metrics in ForecastResult
    - _Requirements: 2.7_

- [x] 5. Implement RecommendationEngineService
  - [x] 5.1 Create RecommendationEngineService with rule-based recommendations
    - Create service skeleton with inject() for StatisticsService
    - Implement getRecommendations method signature
    - Add helper methods: isDateField, isCategorical, isNumeric
    - _Requirements: 3.1, 3.2_
  
  - [x] 5.2 Implement chart type recommendation rules
    - Recommend line charts for date dimensions with 3+ points
    - Recommend bar charts for categorical dimensions with 2-20 cardinality
    - Recommend pie/donut for categorical with 2-8 cardinality (parts of whole)
    - Recommend scatter plots for two numeric measures with |correlation| > 0.3
    - Recommend histograms for single numeric fields
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 5.3 Add aggregation and filter suggestions
    - Suggest optimal aggregation functions (sum, average, count) based on field semantics
    - Suggest useful filters based on outlier detection
    - Include reasoning explanation for each recommendation
    - Return top 3 recommendations sorted by confidence
    - _Requirements: 3.8, 3.9, 3.10_

- [x] 6. Implement QualityAnalyzerService
  - [x] 6.1 Create QualityAnalyzerService and completeness assessment
    - Create service skeleton with inject() for StatisticsService
    - Implement assessCompleteness calculating missing value percentages
    - Calculate per-field and overall completeness scores
    - Identify fields with > 10% missing values
    - _Requirements: 4.1, 4.2_
  
  - [x] 6.2 Implement consistency and accuracy assessment
    - Implement assessConsistency detecting format inconsistencies
    - Implement assessAccuracy using z-score analysis (beyond 3 std devs)
    - Identify statistically improbable values
    - Generate field-level issue reports
    - _Requirements: 4.3, 4.4_
  
  - [x] 6.3 Implement uniqueness assessment and overall scoring
    - Implement assessUniqueness detecting duplicate rows
    - Identify low-cardinality fields masquerading as identifiers
    - Calculate weighted overall quality score (30% completeness, 25% consistency, 25% accuracy, 20% uniqueness)
    - _Requirements: 4.1, 4.5_
  
  - [x] 6.4 Implement quality suggestions generation
    - Generate actionable suggestions for each quality issue
    - Categorize issues as critical (>20 impact), moderate (10-20), or minor (<10)
    - Prioritize suggestions by impact on quality score
    - Display warning when quality score < 70 with top 3 issues
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 7. Create AnalyticsService coordinator
  - [x] 7.1 Create AnalyticsService with state management
    - Create service injecting all analytics sub-services
    - Define signals: insights, isAnalyzing, analyticsEnabled, currentForecast, recommendations, qualityScore
    - Define computed signals: hasInsights, topInsights (filtered and sorted)
    - Set up cache integration
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_
  
  - [x] 7.2 Implement analyzeDataset orchestration method
    - Implement analyzeDataset coordinating all analysis services
    - Add debouncing with 2-second delay
    - Check cache before running analysis
    - Show progress indicator for operations > 500ms
    - Handle errors gracefully without blocking app
    - _Requirements: 1.1, 7.2, 7.3, 7.8_
  
  - [x] 7.3 Implement forecast and recommendation methods
    - Implement generateForecast delegating to ForecastService
    - Implement getRecommendations delegating to RecommendationEngineService
    - Add dismissInsight method to hide unwanted insights
    - Add clearCache method for manual cache invalidation
    - _Requirements: 2.1, 3.1, 3.2_

- [x] 8. Create Web Worker for heavy computation
  - [x] 8.1 Create analytics.worker.ts using Comlink
    - Create Web Worker entry point with Comlink expose
    - Implement analyzeDataset method for large datasets
    - Implement generateForecast for heavy forecasting
    - Implement calculateCorrelationMatrix for large field sets
    - _Requirements: 7.1, 7.4_
  
  - [x] 8.2 Integrate Web Worker with AnalyticsService
    - Add worker instantiation logic in AnalyticsService
    - Use Worker for datasets > 10,000 rows
    - Use Worker for forecasts with > 20 periods
    - Fall back to main thread for smaller operations
    - Handle worker errors and unavailability gracefully
    - _Requirements: 7.1, 7.4, 7.9_

- [x] 9. Integrate analytics UI - Insights tab
  - [x] 9.1 Add Insights tab to App component
    - Add "insights" to selectedTab type in App component
    - Add insights button to tab bar in app.html
    - Inject AnalyticsService in App component
    - Trigger analyzeDataset on data load
    - _Requirements: 6.1, 6.2_
  
  - [x] 9.2 Create Insights tab content view
    - Create insights-view section with explainer header
    - Display analyzing indicator when isAnalyzing() is true
    - Render insights grid with insight cards
    - Show insight type badge, confidence badge, and dismiss button
    - Display empty state when no insights found
    - _Requirements: 6.2_
  
  - [x] 9.3 Implement insight visualization interaction
    - Implement visualizeInsight method in App component
    - Navigate to chart tab and configure chart based on insight type
    - Handle correlation insights with scatter plot
    - Handle outlier insights with filtering
    - Handle trend insights with line chart configuration
    - _Requirements: 6.2_

- [x] 10. Integrate analytics UI - Recommendations and Quality
  - [x] 10.1 Add smart recommendations panel to chart view
    - Add recommendations-box to right pane after chart type selection
    - Display top 3 recommendations with confidence scores
    - Implement applyRecommendation method applying suggested config
    - Show reasoning for each recommendation
    - _Requirements: 6.5_
  
  - [x] 10.2 Add quality score to status bar
    - Add quality score button to status bar
    - Display quality score with warning styling when < 70
    - Implement showQualityDetails modal/dialog
    - Show overall score and component breakdown
    - List critical and moderate issues with actionable suggestions
    - _Requirements: 6.6, 6.7_

- [x] 11. Integrate forecast visualization
  - [x] 11.1 Add forecast generation UI
    - Add canForecast computed property checking for date dimension and measure
    - Add forecast button to chart view when applicable
    - Implement generateForecast method calling AnalyticsService
    - Display forecast generation status and errors
    - _Requirements: 6.3, 6.4_
  
  - [x] 11.2 Render forecast visualization on charts
    - Extend chart x-axis to include forecast periods
    - Render forecast values as dashed line
    - Render 80% and 95% confidence interval shaded areas
    - Add vertical separator between historical and forecast data
    - Add forecast legend entries
    - Display forecast metadata in tooltips
    - _Requirements: 6.4_

- [x] 12. Add styling for analytics components
  - [x] 12.1 Create styles for Insights tab
    - Style insights-view, insights-grid, and insight-card
    - Add confidence-based border colors (green/yellow/orange)
    - Style insight-type-badge and confidence-badge
    - Style dismiss button and hover states
    - Add analyzing-indicator spinner animation
    - _Requirements: 6.2, 6.10_
  
  - [x] 12.2 Create styles for recommendations and quality UI
    - Style recommendations-box and recommendation-item
    - Style quality-score button with warning state
    - Add hover and transition effects
    - Ensure consistent spacing and typography with existing app design
    - _Requirements: 6.5, 6.6, 6.10_

- [ ] 13. Final integration and testing
  - Verify all analytics features working with sample datasets
  - Test performance with 100K row dataset (< 5 second target)
  - Test forecast generation with time series data
  - Verify Web Worker usage for large datasets
  - Test error handling and graceful degradation
  - Verify UI responsiveness during heavy computation
  - Ensure all insights, recommendations, and quality scores display correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Testing tasks are omitted per user request
- Focus is on atomic, well-organized tasks by feature area
- Dependencies are structured to allow parallel work on independent services

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "4.1", "5.1", "6.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "5.2", "6.2"] },
    { "id": 4, "tasks": ["3.4", "4.3", "5.3", "6.3"] },
    { "id": 5, "tasks": ["4.4", "6.4", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["9.1", "10.1", "11.1", "12.1"] },
    { "id": 9, "tasks": ["9.2", "10.2", "11.2", "12.2"] },
    { "id": 10, "tasks": ["9.3"] },
    { "id": 11, "tasks": ["13"] }
  ]
}
```
