# Requirements Document

## Introduction

This requirements document defines the Advanced Analytics capabilities for the Data Visualization Studio, an Electron-based data visualization application built with Angular 22. The Advanced Analytics feature transforms the application from a basic visualization tool into a professional SaaS analytics platform by adding AI-powered proactive insights, forecasting, smart recommendations, data quality scoring, and automated narrative generation.

The centerpiece of this feature is the **Proactive Business Insights** capability, which automatically generates comprehensive business intelligence reports when data is loaded. Unlike passive analysis tools that wait for user queries, this feature proactively identifies:

- **Executive summaries** providing immediate business context
- **Key findings** highlighting the most significant data characteristics  
- **Risks** alerting users to potential problems and data quality issues
- **Opportunities** revealing growth areas and positive trends
- **Anomalies** detecting unusual patterns requiring investigation
- **Suggested actions** providing specific, actionable recommendations
- **Department recommendations** tailoring insights to business functions
- **Exploratory questions** guiding users to deeper analysis

These capabilities work offline-first using local machine learning models and statistical algorithms while maintaining fast performance and seamless integration with the existing UI. The insights are presented in business-friendly language suitable for executives, managers, and analysts across all departments.

## Glossary

- **Analytics_Engine**: The core service that coordinates AI-powered analysis, forecasting, and insights generation
- **Insight_Detector**: Component that identifies patterns, anomalies, and trends in datasets and generates proactive business intelligence reports
- **ProactiveInsightReport**: Comprehensive business intelligence report containing executive summary, key findings, risks, opportunities, anomalies, suggested actions, department recommendations, and exploratory questions
- **Forecast_Service**: Component that performs time series prediction and trend analysis
- **Recommendation_Engine**: Component that suggests optimal chart types, filters, and transformations
- **Quality_Analyzer**: Component that evaluates data quality and provides actionable improvement suggestions
- **Narrative_Generator**: Component that creates natural language summaries of analytical findings
- **ML_Model**: TensorFlow.js-based machine learning model running client-side
- **Insight**: A discovered pattern, anomaly, or trend in the data
- **Key_Finding**: A significant fact about the dataset highlighted in the proactive insights report
- **Risk**: A potential business concern or data quality issue identified through analysis
- **Opportunity**: A potential business advantage or growth area identified through analysis
- **Anomaly**: An unusual pattern, outlier, or unexpected value requiring investigation
- **Suggested_Action**: A specific, actionable recommendation based on discovered insights
- **Department_Recommendation**: A business function-specific recommendation tailored to departmental concerns
- **Exploratory_Question**: A suggested question to help users discover additional insights
- **Executive_Summary**: A concise 2-4 sentence overview of the dataset's business significance
- **Forecast**: A predicted future value or trend based on historical data
- **Data_Quality_Score**: Numerical assessment (0-100) of dataset completeness, consistency, and accuracy
- **Narrative**: Natural language summary of data analysis findings
- **User**: Person using the Data Visualization Studio application
- **Dataset**: The currently loaded Excel or CSV data in the application
- **Field_Profile**: Statistical summary of a data column (existing feature)
- **Chart_Definition**: Configuration object defining chart type, dimensions, and measures (existing feature)
- **Dashboard**: Collection of saved visualizations (existing feature)
- **Free_Tier**: User tier without paid subscription
- **Pro_Tier**: User tier with paid subscription enabling advanced features
- **Confidence_Score**: A numerical measure (0-100) of the statistical reliability of an insight

## Requirements

### Requirement 1: Proactive Business Insights Generation

**User Story:** As a business user, I want the AI to automatically generate a comprehensive business intelligence report when I load data, so that I can immediately understand key findings, risks, opportunities, and actionable recommendations without manual analysis.

#### Acceptance Criteria

1. WHEN a Dataset is loaded, THE Insight_Detector SHALL automatically generate a ProactiveInsightReport containing all eight insight categories
2. THE Insight_Detector SHALL generate the executive summary within 3 seconds of data load completion
3. THE Insight_Detector SHALL generate key findings (minimum 3, maximum 5) highlighting the most significant data characteristics
4. THE Insight_Detector SHALL generate risk statements (0-5) identifying potential business concerns based on data patterns
5. THE Insight_Detector SHALL generate opportunity statements (0-5) identifying potential business advantages based on data patterns
6. THE Insight_Detector SHALL generate anomaly statements (0-5) identifying unusual patterns requiring attention
7. THE Insight_Detector SHALL generate suggested actions (3-7) providing specific, actionable recommendations
8. THE Insight_Detector SHALL generate department-specific recommendations for at least 3 relevant business functions
9. THE Insight_Detector SHALL generate questions to ask (5-10) helping users explore the data further
10. THE Insight_Detector SHALL present insights using business language appropriate for non-technical executives

### Requirement 2: Executive Summary Generation

**User Story:** As an executive, I want a concise summary of the dataset's business significance, so that I can quickly understand if the data requires my attention.

#### Acceptance Criteria

1. THE Insight_Detector SHALL generate an executive summary of 2-4 sentences
2. THE executive summary SHALL include dataset size, completeness percentage, and overall data quality assessment
3. WHEN critical risks exist (3 or more), THE executive summary SHALL prominently mention risk count
4. WHEN significant anomalies exist (2 or more), THE executive summary SHALL mention anomaly count and impact
5. THE executive summary SHALL use confident, assertive language (e.g., "The dataset shows...", not "The dataset might show...")
6. THE executive summary SHALL avoid technical jargon such as "standard deviation", "correlation coefficient", "IQR"
7. WHEN completeness is below 70%, THE executive summary SHALL flag data quality as a concern
8. WHEN completeness is above 95%, THE executive summary SHALL affirm data reliability
9. THE executive summary SHALL set the tone for the detailed findings that follow
10. WHERE no significant patterns exist, THE executive summary SHALL state "This dataset requires deeper investigation to uncover patterns"

### Requirement 3: Key Findings Generation

**User Story:** As a business analyst, I want to see the most important facts about my data first, so that I can focus on what matters most.

#### Acceptance Criteria

1. THE Insight_Detector SHALL generate between 3 and 5 key findings ranked by business significance
2. THE first key finding SHALL always describe dataset dimensions (row count, column count, completeness)
3. WHEN numeric measures exist, THE Insight_Detector SHALL generate findings about the primary measure's range, average, or total
4. WHEN categorical dimensions exist, THE Insight_Detector SHALL generate findings about segment distribution or top categories
5. WHEN date fields exist, THE Insight_Detector SHALL generate findings about time range coverage and trend direction
6. THE Insight_Detector SHALL prioritize findings about business-critical fields (revenue, sales, cost, profit, customer, product)
7. WHEN a measure varies significantly across segments (standard deviation > 50% of mean), THE Insight_Detector SHALL generate a finding about variability
8. WHEN time series data shows a trend (>15% change from first to last period), THE Insight_Detector SHALL generate a finding about trend direction and magnitude
9. Each key finding SHALL be a complete, grammatically correct sentence with specific numbers and percentages
10. THE Insight_Detector SHALL avoid generic findings like "The data contains numbers" in favor of specific insights

### Requirement 4: Risk Identification

**User Story:** As a business manager, I want to be alerted to potential problems in my data, so that I can address issues before they impact decisions.

#### Acceptance Criteria

1. WHEN data completeness is below 70%, THE Insight_Detector SHALL generate a risk statement: "Low data completeness (X%) may lead to unreliable analysis"
2. WHEN duplicate rows exceed 5% of total rows, THE Insight_Detector SHALL generate a risk statement: "X duplicate rows detected may skew analysis results"
3. WHEN a time series shows a negative trend exceeding 15% decline, THE Insight_Detector SHALL generate a risk statement describing the declining metric
4. WHEN outliers exceed 10% of rows for a critical measure, THE Insight_Detector SHALL generate a risk statement about data quality or unusual events
5. WHEN missing values in a single field exceed 30%, THE Insight_Detector SHALL generate a risk statement about that specific field
6. WHEN revenue, sales, cost, or profit fields show high variance (CV > 1.0), THE Insight_Detector SHALL generate a risk statement about unpredictability
7. THE Insight_Detector SHALL limit risk statements to maximum 5 to avoid overwhelming users
8. THE Insight_Detector SHALL rank risks by severity (data quality issues first, business metric issues second)
9. Each risk statement SHALL be actionable and specific, not vague warnings
10. WHERE no significant risks exist, THE Insight_Detector SHALL return an empty risks array

### Requirement 5: Opportunity Identification

**User Story:** As a business strategist, I want to discover positive trends and growth areas, so that I can capitalize on them.

#### Acceptance Criteria

1. WHEN a time series shows positive growth exceeding 15% increase, THE Insight_Detector SHALL generate an opportunity statement describing the growing metric
2. WHEN a segment performs significantly above average (>50% above mean), THE Insight_Detector SHALL generate an opportunity statement highlighting that segment
3. WHEN a positive correlation exists between controllable and outcome measures (r > 0.7), THE Insight_Detector SHALL generate an opportunity statement about leveraging that relationship
4. WHEN a categorical dimension shows uneven distribution with a clear leader (top category > 40% share), THE Insight_Detector SHALL generate an opportunity statement about focusing on winners
5. WHEN recent periods show acceleration (last quarter growth > previous quarter growth), THE Insight_Detector SHALL generate an opportunity statement about momentum
6. WHEN multiple measures show consistent positive trends, THE Insight_Detector SHALL generate an opportunity statement about overall business health
7. THE Insight_Detector SHALL limit opportunity statements to maximum 5 to maintain focus
8. THE Insight_Detector SHALL rank opportunities by magnitude and business impact
9. Each opportunity statement SHALL suggest specific actions to capitalize on the opportunity
10. WHERE no significant opportunities exist, THE Insight_Detector SHALL return an empty opportunities array

### Requirement 6: Anomaly Detection and Reporting

**User Story:** As a data analyst, I want to be notified of unusual patterns that require investigation, so that I can validate data quality or discover exceptional events.

#### Acceptance Criteria

1. THE Insight_Detector SHALL identify statistical outliers in numeric fields using the IQR method (values beyond 1.5 × IQR)
2. WHEN outliers exist in critical business measures, THE Insight_Detector SHALL generate anomaly statements describing the field and outlier count
3. THE Insight_Detector SHALL identify sudden changes in time series where rate of change exceeds 2 standard deviations from historical variance
4. WHEN a sudden change is detected, THE Insight_Detector SHALL generate an anomaly statement with the time period and magnitude of change
5. THE Insight_Detector SHALL identify unexpected zero values in measures where mean > 0 and zero count > 5% of rows
6. THE Insight_Detector SHALL identify unexpected null value clusters where missing values concentrate in specific segments
7. THE Insight_Detector SHALL identify distribution anomalies where a typically stable categorical field shows unusual new values
8. Each anomaly statement SHALL include the affected field, nature of the anomaly, and row count or percentage affected
9. THE Insight_Detector SHALL differentiate between data quality anomalies and potentially significant business events
10. THE Insight_Detector SHALL limit anomaly statements to maximum 5, prioritizing those affecting the most rows

### Requirement 7: Suggested Actions Generation

**User Story:** As a decision maker, I want specific, actionable recommendations based on the data, so that I know what steps to take next.

#### Acceptance Criteria

1. THE Insight_Detector SHALL generate between 3 and 7 suggested actions based on identified risks, opportunities, and anomalies
2. WHEN risks are identified, THE Insight_Detector SHALL generate at least one action addressing the highest-priority risk
3. WHEN opportunities are identified, THE Insight_Detector SHALL generate at least one action to capitalize on the top opportunity
4. WHEN data quality issues exist, THE Insight_Detector SHALL suggest specific remediation actions (e.g., "Remove 47 duplicate rows" not "Clean the data")
5. WHEN anomalies are detected, THE Insight_Detector SHALL suggest investigation actions (e.g., "Investigate 12 outlier transactions in Q3")
6. WHEN trends exist, THE Insight_Detector SHALL suggest forecasting or monitoring actions
7. Each suggested action SHALL begin with an action verb (Investigate, Review, Remove, Monitor, Focus, Analyze, Improve, Compare)
8. Each suggested action SHALL be specific enough to be assigned as a task (who, what, where clearly defined)
9. THE Insight_Detector SHALL prioritize actions by expected impact on decision quality or business outcomes
10. THE Insight_Detector SHALL avoid generic actions like "Review the data" in favor of specific, targeted recommendations

### Requirement 8: Department-Specific Recommendations

**User Story:** As a department head, I want recommendations tailored to my business function, so that I can see how the data impacts my area of responsibility.

#### Acceptance Criteria

1. THE Insight_Detector SHALL generate department-specific recommendations for at least 3 relevant business functions
2. THE Insight_Detector SHALL identify relevant departments based on field names and data context (Sales, Finance, Operations, Marketing, HR, Customer Service)
3. WHEN revenue, sales, or customer fields exist, THE Insight_Detector SHALL generate a recommendation for the Sales department
4. WHEN cost, expense, budget, or profit fields exist, THE Insight_Detector SHALL generate a recommendation for the Finance department
5. WHEN inventory, production, or fulfillment fields exist, THE Insight_Detector SHALL generate a recommendation for the Operations department
6. WHEN campaign, channel, or acquisition fields exist, THE Insight_Detector SHALL generate a recommendation for the Marketing department
7. Each department recommendation SHALL be specific to that function's concerns and KPIs
8. Each department recommendation SHALL reference specific data findings relevant to that function
9. THE Insight_Detector SHALL limit recommendations to 5 departments to maintain focus
10. WHERE department context cannot be determined, THE Insight_Detector SHALL provide general "Management" and "Analytics Team" recommendations

### Requirement 9: Exploratory Questions Generation

**User Story:** As a curious analyst, I want suggested questions to explore, so that I can discover insights beyond the automatic analysis.

#### Acceptance Criteria

1. THE Insight_Detector SHALL generate between 5 and 10 exploratory questions based on available fields and detected patterns
2. WHEN multiple numeric measures exist, THE Insight_Detector SHALL suggest correlation questions (e.g., "How does X relate to Y?")
3. WHEN categorical dimensions exist, THE Insight_Detector SHALL suggest segmentation questions (e.g., "Which category has the highest Z?")
4. WHEN date fields exist, THE Insight_Detector SHALL suggest temporal questions (e.g., "What is the trend over time?", "Did performance change in Q3?")
5. WHEN anomalies are detected, THE Insight_Detector SHALL suggest investigative questions (e.g., "What caused the spike in March?")
6. WHEN opportunities are identified, THE Insight_Detector SHALL suggest explorative questions (e.g., "Can we replicate the success of segment X?")
7. Each question SHALL be open-ended and thought-provoking, not yes/no questions
8. Each question SHALL reference specific fields from the dataset by name
9. THE Insight_Detector SHALL prioritize questions that could lead to actionable insights
10. THE Insight_Detector SHALL vary question types (comparison, causation, prediction, segmentation, temporal) for comprehensive exploration

### Requirement 10: Pattern and Correlation Detection

**User Story:** As a data analyst, I want to discover hidden relationships and patterns in my data, so that I can understand causal factors and interdependencies.

#### Acceptance Criteria

1. THE Insight_Detector SHALL calculate correlation coefficients for all pairs of numeric measures
2. WHEN correlation magnitude exceeds 0.7, THE Insight_Detector SHALL include the relationship in key findings or opportunities
3. THE Insight_Detector SHALL identify positive correlations (r > 0.7) as potential leverage points for business improvement
4. THE Insight_Detector SHALL identify negative correlations (r < -0.7) as potential trade-offs requiring management attention
5. THE Insight_Detector SHALL identify seasonal patterns in date-based fields with at least 12 data points using autocorrelation
6. WHEN seasonal patterns exist, THE Insight_Detector SHALL include seasonality in key findings with period description (monthly, quarterly, annual)
7. THE Insight_Detector SHALL identify sudden changes in time series data where rate of change exceeds 2 standard deviations
8. THE Insight_Detector SHALL identify distribution patterns (normal, skewed, bimodal) for primary numeric measures
9. THE Insight_Detector SHALL complete correlation analysis for datasets up to 100,000 rows within 5 seconds
10. WHERE offline mode is active, THE Insight_Detector SHALL use local statistical algorithms without network requests

### Requirement 11: Time Series Forecasting

**User Story:** As a business analyst, I want to forecast future values based on historical trends, so that I can make data-driven predictions.

#### Acceptance Criteria

1. WHEN a date field and numeric field are selected, THE Forecast_Service SHALL detect if the data represents a valid time series (minimum 10 data points)
2. WHEN time series data is valid, THE Forecast_Service SHALL generate forecasts for the next N periods (configurable, default 10)
3. THE Forecast_Service SHALL calculate forecast confidence intervals at 80% and 95% confidence levels
4. THE Forecast_Service SHALL detect and account for trend patterns (linear, exponential, logarithmic)
5. THE Forecast_Service SHALL detect and account for seasonal patterns with configurable periodicity
6. WHEN forecasting completes, THE Forecast_Service SHALL return predicted values with upper and lower confidence bounds
7. THE Forecast_Service SHALL provide forecast accuracy metrics (RMSE, MAE, MAPE) when historical data permits validation
8. THE Forecast_Service SHALL support univariate forecasting using exponential smoothing algorithms
9. THE Forecast_Service SHALL complete forecasting for datasets with up to 10,000 time points within 3 seconds
10. WHERE offline mode is active, THE Forecast_Service SHALL use local ML_Model implementations

### Requirement 12: Smart Chart Recommendations

**User Story:** As a non-technical user, I want intelligent suggestions for chart types and configurations, so that I can create effective visualizations without expertise.

#### Acceptance Criteria

1. WHEN field selections change, THE Recommendation_Engine SHALL analyze field types, cardinality, and relationships
2. WHEN analysis completes, THE Recommendation_Engine SHALL suggest the 3 most appropriate chart types with confidence scores
3. THE Recommendation_Engine SHALL recommend bar charts when visualizing categorical dimension with numeric measure and dimension cardinality is between 2 and 20
4. THE Recommendation_Engine SHALL recommend line charts when the dimension is a date field with at least 3 data points
5. THE Recommendation_Engine SHALL recommend scatter plots when two numeric measures are selected and correlation magnitude exceeds 0.3
6. THE Recommendation_Engine SHALL recommend pie charts when categorical dimension has cardinality between 2 and 8 and represents parts of a whole
7. THE Recommendation_Engine SHALL recommend histograms for single numeric fields to show distribution
8. THE Recommendation_Engine SHALL suggest optimal aggregation functions (sum, average, count) based on field semantics
9. THE Recommendation_Engine SHALL suggest useful filters based on outlier detection and data distribution
10. WHEN recommendations are presented, THE Recommendation_Engine SHALL include reasoning explanation for each suggestion

### Requirement 13: Advanced Data Quality Scoring

**User Story:** As a data engineer, I want detailed quality assessment with actionable suggestions, so that I can improve my datasets systematically.

#### Acceptance Criteria

1. WHEN a Dataset is loaded, THE Quality_Analyzer SHALL calculate an overall Data_Quality_Score from 0 to 100
2. THE Quality_Analyzer SHALL assess completeness by calculating missing value percentage for each field
3. THE Quality_Analyzer SHALL assess consistency by detecting format inconsistencies within fields (e.g., mixed date formats)
4. THE Quality_Analyzer SHALL assess accuracy by identifying statistically improbable values using z-score analysis (beyond 3 standard deviations)
5. THE Quality_Analyzer SHALL assess uniqueness by detecting duplicate rows and fields with low cardinality masquerading as identifiers
6. WHEN quality issues are detected, THE Quality_Analyzer SHALL provide specific actionable suggestions for improvement
7. THE Quality_Analyzer SHALL prioritize suggestions by impact on Data_Quality_Score
8. THE Quality_Analyzer SHALL categorize issues as critical (score impact > 20), moderate (10-20), or minor (< 10)
9. THE Quality_Analyzer SHALL generate quality improvement suggestions such as "Remove 47 duplicate rows" or "Fill missing values in Revenue field"
10. WHERE the Data_Quality_Score is below 70, THE Quality_Analyzer SHALL display a prominent warning with top 3 issues

### Requirement 14: Automated Narrative Generation

**User Story:** As an executive, I want natural language summaries of my data analysis, so that I can quickly understand key findings without interpreting charts.

#### Acceptance Criteria

1. WHEN a chart is created, THE Narrative_Generator SHALL create a Narrative describing key findings
2. THE Narrative_Generator SHALL identify and describe the highest value, lowest value, and average in numeric measures
3. THE Narrative_Generator SHALL identify and describe significant trends (increasing, decreasing, stable) in time series data
4. THE Narrative_Generator SHALL describe correlations between fields in plain language (e.g., "Revenue strongly correlates with Marketing Spend")
5. THE Narrative_Generator SHALL describe anomalies and outliers in contextual terms (e.g., "Q3 sales were 47% above average")
6. THE Narrative_Generator SHALL generate narratives in grammatically correct English with proper sentence structure
7. WHEN multiple Insights exist, THE Narrative_Generator SHALL synthesize them into a coherent multi-sentence summary
8. THE Narrative_Generator SHALL limit narratives to 3-5 sentences for individual charts and 5-10 sentences for dashboards
9. THE Narrative_Generator SHALL use domain-appropriate language based on field names and data context
10. WHERE a Dashboard contains multiple charts, THE Narrative_Generator SHALL create an executive summary narrative connecting related findings

### Requirement 15: Analytics UI Integration

**User Story:** As a user, I want analytics features integrated seamlessly into the existing interface, so that I can access insights without disrupting my workflow.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL add an "Insights" tab to the existing tab bar (Data, Profile, Chart, Dashboard, Export)
2. WHEN the Insights tab is selected, THE Analytics_Engine SHALL display the ProactiveInsightReport as the primary content
3. THE Analytics_Engine SHALL display the executive summary prominently at the top in a highlighted card with larger font
4. THE Analytics_Engine SHALL display key findings in an expandable "Key Findings" section with bullet points
5. THE Analytics_Engine SHALL display risks in a warning-styled section with amber/orange visual indicators
6. THE Analytics_Engine SHALL display opportunities in a success-styled section with green visual indicators
7. THE Analytics_Engine SHALL display anomalies in an alert-styled section with red/yellow visual indicators
8. THE Analytics_Engine SHALL display suggested actions as an actionable checklist with checkboxes
9. THE Analytics_Engine SHALL display department recommendations in an expandable accordion grouped by department name
10. THE Analytics_Engine SHALL display exploratory questions as clickable items that trigger AI query when selected
11. THE Analytics_Engine SHALL provide "Regenerate Insights" button to refresh the ProactiveInsightReport on demand
12. THE Analytics_Engine SHALL provide "Export Report" button to export the complete ProactiveInsightReport as markdown or PDF
13. THE Analytics_Engine SHALL display a "Forecast" button in the right pane when a valid time series is detected
14. WHEN the Forecast button is clicked, THE Analytics_Engine SHALL overlay forecast visualization on the current chart
15. THE Analytics_Engine SHALL display smart chart recommendations in the right pane below chart type selection
16. THE Analytics_Engine SHALL display the advanced Data_Quality_Score prominently in the status bar
17. WHEN Data_Quality_Score is clicked, THE Analytics_Engine SHALL show detailed quality breakdown in a modal dialog
18. THE Analytics_Engine SHALL display chart narratives below chart visualizations in italic text
19. THE Analytics_Engine SHALL provide "Copy Narrative" button to copy generated text to clipboard
20. THE Analytics_Engine SHALL use existing application colors, typography, and spacing for visual consistency

### Requirement 16: Performance and Resource Management

**User Story:** As a user with large datasets, I want analytics features to remain fast and responsive, so that my analysis workflow is not interrupted.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL execute insight detection asynchronously without blocking the UI thread
2. THE Analytics_Engine SHALL display a progress indicator when analysis duration exceeds 500 milliseconds
3. THE Analytics_Engine SHALL cache analysis results and invalidate cache only when Dataset changes
4. THE Analytics_Engine SHALL process datasets with up to 100,000 rows without application freeze
5. THE Analytics_Engine SHALL lazy-load ML_Model weights only when analytics features are first accessed
6. THE Analytics_Engine SHALL limit memory usage for ML_Model to maximum 150 MB
7. WHEN memory usage exceeds 200 MB, THE Analytics_Engine SHALL unload unused ML_Model weights
8. THE Analytics_Engine SHALL debounce insight recalculation to occur no more than once per 2 seconds when filters change
9. THE Analytics_Engine SHALL provide "Cancel Analysis" button for long-running operations exceeding 3 seconds
10. WHERE Pro_Tier features require more computation, THE Analytics_Engine SHALL show estimated completion time

### Requirement 17: Offline-First ML Model Management

**User Story:** As a user, I want analytics features to work without internet connection, so that I can analyze sensitive data offline.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL bundle essential ML_Model weights with the Electron application installer
2. THE Analytics_Engine SHALL load ML_Model using TensorFlow.js WebGL backend for GPU acceleration when available
3. WHERE GPU is unavailable, THE Analytics_Engine SHALL fall back to CPU backend without feature loss
4. THE Analytics_Engine SHALL never transmit Dataset contents to external servers for analysis
5. THE Analytics_Engine SHALL store ML_Model weights in the application resources directory
6. WHEN the application starts, THE Analytics_Engine SHALL verify ML_Model integrity using checksums
7. IF ML_Model files are corrupted, THE Analytics_Engine SHALL display error and disable analytics features gracefully
8. THE Analytics_Engine SHALL support optional model updates via application update mechanism
9. THE Analytics_Engine SHALL provide "Download Enhanced Models" option for Pro_Tier users (requires internet once)
10. WHERE enhanced models are unavailable, THE Analytics_Engine SHALL use bundled models without feature degradation

### Requirement 18: Feature Tier Management

**User Story:** As a product manager, I want to differentiate free and paid tiers, so that we can offer value at both levels while monetizing advanced features.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL enable basic insight detection for Free_Tier users (up to 5 insights per dataset)
2. THE Analytics_Engine SHALL enable unlimited insight detection for Pro_Tier users
3. THE Analytics_Engine SHALL enable forecasting with 5 future periods for Free_Tier users
4. THE Analytics_Engine SHALL enable forecasting with unlimited future periods for Pro_Tier users
5. THE Analytics_Engine SHALL enable smart chart recommendations for all users
6. THE Analytics_Engine SHALL enable basic narrative generation (chart-level) for all users
7. THE Analytics_Engine SHALL enable advanced narrative generation (dashboard-level, executive summaries) for Pro_Tier users only
8. THE Analytics_Engine SHALL enable advanced quality suggestions for Pro_Tier users (Free_Tier gets basic quality score only)
9. WHEN a Free_Tier user attempts Pro_Tier features, THE Analytics_Engine SHALL display an upgrade prompt with feature benefits
10. THE Analytics_Engine SHALL store tier information in application settings and verify on feature access

### Requirement 19: Analytics Export and Sharing

**User Story:** As a business user, I want to export insights and narratives, so that I can share findings with stakeholders.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL add "Export Insights" button to the Insights tab
2. WHEN Export Insights is clicked, THE Analytics_Engine SHALL generate a formatted markdown file containing the complete ProactiveInsightReport
3. THE exported ProactiveInsightReport SHALL include all sections: executive summary, key findings, risks, opportunities, anomalies, suggested actions, department recommendations, and exploratory questions
4. THE exported report SHALL include metadata header with dataset name, analysis date, row count, column count, and application version
5. THE Analytics_Engine SHALL provide "Export as PDF" option that converts the ProactiveInsightReport to a professionally formatted PDF document
6. THE Analytics_Engine SHALL include chart narratives in dashboard PDF exports
7. THE Analytics_Engine SHALL add "Export Forecast Data" button that outputs forecast values as CSV with confidence intervals
8. THE Analytics_Engine SHALL include Data_Quality_Score and top issues in project .dvis files
9. THE Analytics_Engine SHALL provide "Copy Executive Summary" button to copy just the executive summary to clipboard
10. THE Analytics_Engine SHALL provide "Copy All Insights" button to copy the complete insights report to clipboard in plain text format
11. WHEN exporting charts as PNG or SVG, THE Analytics_Engine SHALL include the chart narrative as caption below visualization
12. THE Analytics_Engine SHALL format exported narratives with proper markdown headers, lists, and emphasis
13. WHERE forecast data is exported, THE Analytics_Engine SHALL include column headers (Date, Forecast, Lower_Bound, Upper_Bound)
14. THE exported PDF SHALL use business presentation formatting with company logo placeholder and professional styling

### Requirement 20: User Preferences and Settings

**User Story:** As a user, I want to control analytics behavior, so that I can customize features to my workflow.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL add an "Analytics Settings" section to application settings
2. THE Analytics_Engine SHALL provide toggle to enable or disable automatic insight detection on data load
3. THE Analytics_Engine SHALL provide slider to set insight sensitivity (low, medium, high) affecting confidence threshold
4. THE Analytics_Engine SHALL provide toggle to enable or disable automatic narrative generation
5. THE Analytics_Engine SHALL provide option to select narrative verbosity (concise, normal, detailed)
6. THE Analytics_Engine SHALL provide toggle to show or hide forecast confidence intervals on charts
7. THE Analytics_Engine SHALL provide dropdown to select preferred forecast periods (5, 10, 20, 30, custom)
8. THE Analytics_Engine SHALL persist all settings to localStorage with key "dvis-analytics-settings"
9. WHEN settings change, THE Analytics_Engine SHALL apply new settings immediately without application restart
10. THE Analytics_Engine SHALL provide "Reset to Defaults" button that restores factory settings

### Requirement 21: Error Handling and Graceful Degradation

**User Story:** As a user, I want analytics features to fail gracefully, so that I can continue using the application even if analytics encounter errors.

#### Acceptance Criteria

1. IF insight detection fails, THE Analytics_Engine SHALL display error message without blocking other features
2. IF ML_Model fails to load, THE Analytics_Engine SHALL disable advanced features and display explanatory notification
3. IF forecasting fails due to insufficient data, THE Analytics_Engine SHALL display specific requirement (e.g., "Requires at least 10 time points")
4. IF narrative generation fails, THE Analytics_Engine SHALL display chart without narrative rather than showing error
5. WHERE a Dataset is too large for analysis (exceeds 100,000 rows), THE Analytics_Engine SHALL offer to sample data for analysis
6. IF memory limits are exceeded, THE Analytics_Engine SHALL unload ML_Model and display "Analytics temporarily unavailable due to memory constraints"
7. THE Analytics_Engine SHALL log all errors to console for debugging without exposing technical details to User
8. WHEN an analytics operation times out (exceeds 30 seconds), THE Analytics_Engine SHALL cancel operation and notify User
9. IF GPU acceleration fails, THE Analytics_Engine SHALL fall back to CPU with notification "Using CPU mode (slower)"
10. THE Analytics_Engine SHALL never crash the application due to analytics errors

### Requirement 22: Insight Visualization and Interaction

**User Story:** As a data analyst, I want to visualize and interact with discovered insights, so that I can explore findings in detail.

#### Acceptance Criteria

1. WHEN an Insight is clicked, THE Analytics_Engine SHALL create or update the chart to visualize the relevant data
2. THE Analytics_Engine SHALL highlight affected fields in the Field_Profile when an Insight is selected
3. WHEN a correlation Insight exists, THE Analytics_Engine SHALL offer to create a scatter plot of correlated fields
4. WHEN an outlier Insight is clicked, THE Analytics_Engine SHALL filter the data view to show only outlier rows
5. WHEN a seasonal pattern Insight exists, THE Analytics_Engine SHALL overlay seasonal markers on line charts
6. THE Analytics_Engine SHALL display insight confidence score as a visual indicator (color-coded: green > 80, yellow 60-80, orange < 60)
7. THE Analytics_Engine SHALL provide "Dismiss" action to hide insights that are not relevant
8. WHEN insights are dismissed, THE Analytics_Engine SHALL remember dismissed insights and not show them again for the current Dataset
9. THE Analytics_Engine SHALL provide "Show All Insights" toggle to reveal dismissed insights
10. THE Analytics_Engine SHALL sort insights by confidence score by default with option to sort by type or affected fields

### Requirement 23: Proactive Insight Quality and Confidence

**User Story:** As a business user, I want to know how reliable each insight is, so that I can prioritize my attention and trust the recommendations.

#### Acceptance Criteria

1. THE Insight_Detector SHALL assign a confidence score (0-100) to each generated insight based on statistical significance
2. WHEN an insight is based on > 100 data points, THE Insight_Detector SHALL assign confidence ≥ 80
3. WHEN an insight is based on 30-100 data points, THE Insight_Detector SHALL assign confidence 60-79
4. WHEN an insight is based on < 30 data points, THE Insight_Detector SHALL assign confidence < 60 and display "limited data" warning
5. WHEN a risk or opportunity is based on < 10% of dataset rows, THE Insight_Detector SHALL lower confidence by 20 points
6. WHEN a correlation has p-value < 0.01, THE Insight_Detector SHALL assign high confidence (90-100)
7. WHEN a correlation has p-value 0.01-0.05, THE Insight_Detector SHALL assign medium confidence (70-89)
8. WHEN a trend shows R² > 0.7, THE Insight_Detector SHALL assign high confidence to trend statements
9. THE Insight_Detector SHALL NOT generate insights with confidence < 40 unless no higher-confidence insights exist
10. THE Analytics_Engine SHALL display confidence visually using color coding and percentage badges on each insight card

### Requirement 13b: Insight Interactivity and Follow-Up Actions

**User Story:** As a business analyst, I want to interact with insights to explore them in depth, so that I can validate findings and discover related patterns.

#### Acceptance Criteria

1. WHEN a key finding is clicked, THE Analytics_Engine SHALL navigate to the relevant data view or chart that supports the finding
2. WHEN a risk is clicked, THE Analytics_Engine SHALL show detailed breakdown of affected rows and suggest remediation options
3. WHEN an opportunity is clicked, THE Analytics_Engine SHALL create a visualization highlighting the opportunity (e.g., top-performing segment chart)
4. WHEN an anomaly is clicked, THE Analytics_Engine SHALL filter the dataset to show only anomalous rows for investigation
5. WHEN a suggested action is clicked, THE Analytics_Engine SHALL mark it as acknowledged and optionally create a task or note
6. WHEN a department recommendation is clicked, THE Analytics_Engine SHALL show data relevant to that department's view
7. WHEN an exploratory question is clicked, THE Analytics_Engine SHALL automatically submit it to the AI query service and display results
8. THE Analytics_Engine SHALL provide "Dive Deeper" button on each insight card that opens a modal with detailed statistical information
9. THE Analytics_Engine SHALL provide "Share This Insight" button that copies the insight text and supporting data to clipboard
10. THE Analytics_Engine SHALL track which insights users interact with most to improve future insight prioritization

### Requirement 14: Forecast Visualization

**User Story:** As a business analyst, I want to visualize forecasts with confidence intervals, so that I can understand prediction uncertainty.

#### Acceptance Criteria

1. WHEN a forecast is generated, THE Analytics_Engine SHALL extend the chart's x-axis to include forecast periods
2. THE Analytics_Engine SHALL render forecast values as a dashed line to distinguish from historical data
3. THE Analytics_Engine SHALL render confidence intervals as semi-transparent shaded areas around the forecast line
4. THE Analytics_Engine SHALL use different colors for 80% confidence (darker) and 95% confidence (lighter) intervals
5. THE Analytics_Engine SHALL display a vertical line or visual marker separating historical data from forecast data
6. WHEN hovering over forecast points, THE Analytics_Engine SHALL display tooltip with predicted value and confidence bounds
7. THE Analytics_Engine SHALL add legend entries for "Historical", "Forecast", "80% Confidence", "95% Confidence"
8. THE Analytics_Engine SHALL provide toggle button to show or hide confidence intervals without recalculating forecast
9. WHEN forecast data includes seasonality, THE Analytics_Engine SHALL display seasonal decomposition chart option
10. THE Analytics_Engine SHALL allow users to save forecasted charts to Dashboard with forecast visualization preserved

### Requirement 16: Proactive Insights Generation Triggers

**User Story:** As a user, I want insights to be generated automatically at the right times, so that I always have current analysis without manual effort.

#### Acceptance Criteria

1. WHEN a Dataset is loaded for the first time, THE Insight_Detector SHALL automatically generate a ProactiveInsightReport within 3 seconds
2. WHEN a Dataset changes (filter applied, data edited, new data loaded), THE Insight_Detector SHALL automatically regenerate insights within 2 seconds
3. THE Insight_Detector SHALL debounce insight regeneration to occur no more than once per 2 seconds when multiple rapid changes occur
4. THE Analytics_Engine SHALL display a "Generating Insights..." progress indicator during insight generation
5. THE Analytics_Engine SHALL cache the most recent ProactiveInsightReport and display cached results immediately when switching tabs
6. WHEN the user clicks "Regenerate Insights" button, THE Insight_Detector SHALL force regeneration regardless of cache
7. WHEN the user navigates to the Insights tab, THE Analytics_Engine SHALL check if cached insights are stale (> 30 seconds old with data changes) and regenerate if needed
8. THE Insight_Detector SHALL generate insights asynchronously without blocking the UI or other operations
9. WHERE insight generation fails, THE Analytics_Engine SHALL display the last successfully generated insights with a "Insights may be outdated" warning
10. THE Analytics_Engine SHALL persist the most recent ProactiveInsightReport to localStorage and restore it on application restart for the same dataset

### Requirement 17: Business Intelligence Rules for Insight Quality

**User Story:** As a product manager, I want insights to follow consistent business intelligence best practices, so that users receive reliable and actionable analysis.

#### Acceptance Criteria

1. THE Insight_Detector SHALL prioritize insights about revenue, sales, profit, cost, and customer-related fields over operational fields
2. THE Insight_Detector SHALL avoid generating obvious insights (e.g., "The dataset has data" or "Some values are higher than others")
3. THE Insight_Detector SHALL avoid generating contradictory insights (e.g., both a risk and opportunity about the same metric)
4. THE Insight_Detector SHALL use business-friendly field names by converting camelCase and snake_case to Title Case with spaces
5. THE Insight_Detector SHALL round numeric values to 2 decimal places in insight text for readability
6. THE Insight_Detector SHALL use percentage changes for trends rather than absolute changes when percentage is more meaningful
7. THE Insight_Detector SHALL use comparative language (higher, lower, above, below) rather than absolute values when comparing segments
8. THE Insight_Detector SHALL identify time periods by standard business terms (Q1, Q2, Q3, Q4, January, February, etc.) when date fields follow standard formats
9. THE Insight_Detector SHALL avoid technical statistical terms in insight text (use "unusual" instead of "3 standard deviations")
10. THE Insight_Detector SHALL ensure every generated insight answers at least one of: What? Why? So what? What next?

### Requirement 18: Insight Completeness and Coverage

**User Story:** As a comprehensive user, I want insights to cover all important aspects of my data, so that I don't miss critical patterns.

#### Acceptance Criteria

1. THE Insight_Detector SHALL analyze at least 90% of numeric fields for outliers and distribution patterns
2. THE Insight_Detector SHALL analyze at least 90% of categorical fields for distribution and concentration patterns
3. WHEN date fields exist, THE Insight_Detector SHALL analyze 100% of date fields for trends and seasonality
4. THE Insight_Detector SHALL analyze relationships between all pairs of primary measures (up to 10 measures)
5. THE Insight_Detector SHALL analyze segmentation patterns for up to 5 most relevant categorical dimensions
6. THE Insight_Detector SHALL generate at least one insight per major insight category (findings, risks, opportunities, anomalies) when patterns exist
7. WHERE no patterns exist in a category, THE Insight_Detector SHALL skip that category rather than generating weak insights
8. THE Insight_Detector SHALL ensure at least 80% of generated insights reference specific field names and numeric values
9. THE Insight_Detector SHALL ensure suggested actions map to identified risks (at least 1 action per risk) and opportunities (at least 1 action per opportunity)
10. THE Insight_Detector SHALL ensure exploratory questions cover multiple analysis types (comparison, temporal, correlation, segmentation)

**User Story:** As a new user, I want to understand analytics features and how to use them, so that I can leverage AI capabilities effectively.

#### Acceptance Criteria

1. THE Analytics_Engine SHALL display a "What's This?" icon next to each analytics feature
2. WHEN the What's This icon is clicked, THE Analytics_Engine SHALL show a tooltip or popover with feature explanation
3. THE Analytics_Engine SHALL provide an "Analytics Guide" accessible from the help menu
4. THE Analytics_Engine SHALL show onboarding tooltips for analytics features on first use (dismissible)
5. THE Analytics_Engine SHALL explain statistical terms (correlation, outlier, confidence interval) in plain language when displayed
6. WHEN an Insight type is unfamiliar, THE Analytics_Engine SHALL provide "Learn More" link to contextual help
7. THE Analytics_Engine SHALL include example use cases in the Analytics Guide ("How to forecast sales", "How to find correlations")
8. THE Analytics_Engine SHALL display keyboard shortcuts for analytics features (if applicable) in the help menu
9. WHEN Pro_Tier features are shown to Free_Tier users, THE Analytics_Engine SHALL explain tier differences clearly
10. THE Analytics_Engine SHALL provide "Give Feedback" button that opens email client with pre-filled analytics feedback template

## Notes

### Proactive Insights Implementation Approach

The ProactiveInsightReport generation uses a hybrid approach:

**Statistical Analysis (Primary):**
- Correlation detection: Pearson's correlation coefficient calculation
- Outlier detection: Interquartile Range (IQR) method and z-score analysis  
- Trend detection: Linear regression and moving averages
- Distribution analysis: Descriptive statistics (mean, median, std dev, skewness)
- Time series analysis: Autocorrelation for seasonality detection

**Business Logic Rules:**
- Risk identification: Threshold-based rules (completeness < 70%, duplicates > 5%, negative trends > 15%)
- Opportunity identification: Threshold-based rules (growth > 15%, top performers > 50% above mean)
- Department mapping: Field name pattern matching to business functions
- Action generation: Template-based recommendations triggered by detected patterns

**Natural Language Generation:**
- Template-based text generation with dynamic value insertion
- Business-friendly terminology mapping (technical terms → plain language)
- Sentence structure rules ensuring grammatical correctness
- No LLM required initially; uses deterministic text templates

**Quality Criteria:**
- Minimum data points for reliable insights: 30 rows for basic patterns, 100 rows for high confidence
- Statistical significance thresholds: p-value < 0.05 for correlations, R² > 0.7 for trends
- Confidence scoring based on sample size, statistical significance, and pattern strength

### Parser and Serializer Requirements

This feature does not introduce new data parsing or serialization formats beyond existing Excel/CSV support and standard JSON for settings persistence. The existing XLSX library handles data import, and standard JSON.stringify/parse handle settings. No custom parsers or pretty printers are required for this feature.

### Machine Learning Model Selection

The initial implementation will use TensorFlow.js with the following models:
- **Outlier Detection**: Local Outlier Factor (LOF) or Isolation Forest implementation
- **Forecasting**: Exponential Smoothing (Holt-Winters) and simple ARIMA-like models
- **Correlation Detection**: Statistical correlation matrix calculation (Pearson's r)
- **Narrative Generation**: Template-based generation with dynamic value insertion (no LLM required initially)

Enhanced models for Pro_Tier may include more sophisticated neural network models for pattern recognition and forecasting.

### Integration Points

Analytics features integrate with existing components:
- **Field Profiling**: Quality_Analyzer extends existing profileColumn() method
- **Chart Builder**: Recommendation_Engine enhances existing applyRecommendation() method  
- **Dashboard**: Narrative_Generator adds text summaries to dashboard items
- **Export**: Analytics data included in existing export functions
- **AI Query Service**: ProactiveInsightReport generation added to existing AIQueryService

### Performance Targets

- Proactive insights generation: < 3 seconds for initial report on data load
- Insight regeneration: < 2 seconds when data changes
- Insight detection: < 5 seconds for 100K rows
- Forecasting: < 3 seconds for 10K time points
- Quality analysis: < 2 seconds for any dataset size
- Narrative generation: < 500ms per chart
- ML model initial load: < 2 seconds
- Memory footprint: < 150 MB for ML models

### User Experience Principles

1. **Proactive over Reactive**: Show insights immediately on data load, don't wait for user queries
2. **Actionable over Descriptive**: Every insight should suggest what to do next
3. **Business Language over Technical Jargon**: Use terms executives understand
4. **Prioritized over Comprehensive**: Show top 5 insights per category, not everything discovered
5. **Visual over Textual**: Use color coding, icons, and layout to convey meaning quickly
