import { Component, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIQueryService, AIQueryResult } from '../services/ai-query.service';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'insights';
  content: string;
  timestamp: Date;
  result?: AIQueryResult;
  insights?: any;
}

@Component({
  selector: 'app-ai-insights-panel',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-panel">
      <!-- Header -->
      <div class="ai-header">
        <div class="ai-title">
          <span class="ai-icon" aria-hidden="true">Q</span>
          <h3>Query assistant <small>(experimental)</small></h3>
          @if (!aiQuery.isEnabled()) {
            <span class="badge disabled">Disabled</span>
          } @else if (aiQuery.isProcessing()) {
            <span class="badge processing">Processing</span>
          } @else {
            <span class="badge active">Active</span>
          }
        </div>
        
        <div class="ai-actions">
          @if (!aiQuery.isEnabled()) {
            <button type="button" class="btn-enable" (click)="enableAI()">
              Enable
            </button>
          } @else {
            <button type="button" class="btn-settings" (click)="settingsOpen.set(!settingsOpen())">
              ⚙
            </button>
          }
        </div>
      </div>

      @if (!aiQuery.isEnabled()) {
        <!-- Enable AI Prompt -->
        <div class="enable-prompt">
          <div class="enable-content">
            <h4>Ask about your data</h4>
            <p>Local rules interpret simple questions and calculate answers from the loaded rows:</p>
            <ul>
              <li>"How did sales change in March?"</li>
              <li>"What is the average revenue?"</li>
              <li>"Show me unusual patterns"</li>
              <li>"How do regions compare?"</li>
            </ul>
            <p class="privacy-note">
              <strong>Local processing:</strong> This question assistant uses deterministic heuristics on this device. It does not send your data to a model or external server.
            </p>
            <button type="button" class="btn-primary" (click)="enableAI()">
              Enable query assistant
            </button>
          </div>
        </div>
      } @else {
        <!-- Settings Panel -->
        @if (settingsOpen()) {
          <div class="settings-panel">
            <h4>Settings</h4>
            <div class="setting-item">
              <label>Memory Usage</label>
              <span class="info">{{ aiQuery.getMemoryStats().used }} MB used · Local processing only</span>
            </div>
            <div class="setting-item">
              <label>Average Response Time</label>
              <span class="info">{{ aiQuery.averageExecutionTime().toFixed(0) }}ms</span>
            </div>
            <div class="actions">
              <button type="button" class="btn-secondary" (click)="clearHistory()">
                Clear History
              </button>
              <button type="button" class="btn-danger" (click)="disableAI()">
                Disable
              </button>
            </div>
          </div>
        }

        <!-- Chat Interface -->
        <div class="chat-container" #chatContainer>
          @if (messages().length === 0) {
            <div class="welcome">
              <h4>Ask Questions About Your Data</h4>
              <p>I can help you analyze trends, find patterns, and generate insights.</p>
              
              <!-- Generate Insights Button -->
              @if (hasData()) {
                <div class="insights-cta">
                  <button 
                    type="button"
                    class="btn-generate-insights" 
                    (click)="generateProactiveInsights()"
                    [disabled]="isGeneratingInsights()">
                    @if (isGeneratingInsights()) {
                      <span class="spinner">⋯</span> Generating Insights...
                    } @else {
                      <span class="icon">💡</span> Generate Business Insights
                    }
                  </button>
                  <p class="insights-description">Get automatic analysis including key findings, risks, opportunities, and recommendations</p>
                </div>
              }

              <div class="capabilities">
                <div class="capability">
                  <span>📊</span>
                  <span>Analyze trends</span>
                </div>
                <div class="capability">
                  <span>🔍</span>
                  <span>Find anomalies</span>
                </div>
                <div class="capability">
                  <span>📈</span>
                  <span>Compare metrics</span>
                </div>
                <div class="capability">
                  <span>💡</span>
                  <span>Generate insights</span>
                </div>
              </div>
              
              @if (suggestedQuestions().length > 0) {
                <div class="suggestions-section">
                  <p class="suggestions-title">Suggested questions:</p>
                  <div class="suggestions">
                    @for (question of suggestedQuestions(); track question) {
                      <button 
                        type="button"
                        class="suggestion-btn" 
                        (click)="askQuestion(question)">
                        {{ question }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          }

          @for (message of messages(); track message.id) {
            <div class="message" [class.user]="message.type === 'user'" [class.assistant]="message.type === 'assistant'" [class.system]="message.type === 'system'" [class.insights]="message.type === 'insights'">
              <div class="message-content">
                @if (message.type === 'insights' && message.insights) {
                  <!-- Insights Report -->
                  <div class="insights-report">
                    <h4 class="insights-title">
                      {{ message.content }}
                      @if (message.insights?.dataQualityScore !== undefined) {
                        <span class="quality-badge" [class.high]="message.insights.dataQualityScore >= 80" [class.medium]="message.insights.dataQualityScore >= 60 && message.insights.dataQualityScore < 80" [class.low]="message.insights.dataQualityScore < 60">
                          Data Quality: {{ message.insights.dataQualityScore }}%
                        </span>
                      }
                    </h4>
                    
                    <!-- Executive Summary -->
                    <div class="insight-section executive">
                      <div class="section-header">
                        <span class="section-icon">📋</span>
                        <h5>Executive Summary</h5>
                      </div>
                      <p class="summary-text">{{ message.insights.executiveSummary }}</p>
                    </div>

                    <!-- Key Findings -->
                    @if (message.insights.keyFindings?.length > 0) {
                      <div class="insight-section">
                        <div class="section-header">
                          <span class="section-icon">🔑</span>
                          <h5>Key Findings</h5>
                        </div>
                        <ul class="insight-list">
                          @for (finding of message.insights.keyFindings; track finding) {
                            <li>{{ finding }}</li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Risks -->
                    @if (message.insights.risks?.length > 0) {
                      <div class="insight-section warning">
                        <div class="section-header">
                          <span class="section-icon">⚠️</span>
                          <h5>Risks</h5>
                        </div>
                        <ul class="insight-list">
                          @for (risk of message.insights.risks; track risk) {
                            <li>{{ risk }}</li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Opportunities -->
                    @if (message.insights.opportunities?.length > 0) {
                      <div class="insight-section success">
                        <div class="section-header">
                          <span class="section-icon">🎯</span>
                          <h5>Opportunities</h5>
                        </div>
                        <ul class="insight-list">
                          @for (opportunity of message.insights.opportunities; track opportunity) {
                            <li>{{ opportunity }}</li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Anomalies -->
                    @if (message.insights.anomalies?.length > 0) {
                      <div class="insight-section alert">
                        <div class="section-header">
                          <span class="section-icon">🚨</span>
                          <h5>Anomalies</h5>
                        </div>
                        <ul class="insight-list">
                          @for (anomaly of message.insights.anomalies; track $index) {
                            <li>
                              @if (isInsightWithSource(anomaly)) {
                                <div class="insight-with-source">
                                  <div class="insight-text">{{ anomaly.text }}</div>
                                  @if (anomaly.sources?.length > 0) {
                                    <div class="source-info">
                                      @for (source of anomaly.sources; track source.field) {
                                        <div class="source-details">
                                          <span class="source-label">📊 Source:</span>
                                          <strong>{{ source.field }}</strong>
                                          @if (source.calculation) {
                                            <span class="calculation">{{ source.calculation }}</span>
                                          }
                                          @if (source.rowIndices && source.rowIndices.length > 0) {
                                            <span class="row-refs">
                                              Rows: {{ formatRowIndices(source.rowIndices) }}
                                            </span>
                                          }
                                          @if (source.sampleValues && source.sampleValues.length > 0) {
                                            <span class="sample-values">
                                              Sample values: {{ formatSampleValues(source.sampleValues) }}
                                            </span>
                                          }
                                        </div>
                                      }
                                      @if (anomaly.confidence) {
                                        <span class="confidence-tag" [class]="anomaly.confidence">
                                          {{ anomaly.confidence }} confidence
                                        </span>
                                      }
                                    </div>
                                  }
                                </div>
                              } @else {
                                {{ anomaly }}
                              }
                            </li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Suggested Actions -->
                    @if (message.insights.suggestedActions?.length > 0) {
                      <div class="insight-section action">
                        <div class="section-header">
                          <span class="section-icon">✅</span>
                          <h5>Suggested Actions</h5>
                        </div>
                        <ul class="insight-list">
                          @for (action of message.insights.suggestedActions; track action) {
                            <li>{{ action }}</li>
                          }
                        </ul>
                      </div>
                    }

                    <!-- Department Recommendations -->
                    @if (message.insights.departmentRecommendations?.length > 0) {
                      <div class="insight-section">
                        <div class="section-header">
                          <span class="section-icon">🏢</span>
                          <h5>Department Recommendations</h5>
                        </div>
                        <div class="dept-recommendations">
                          @for (rec of message.insights.departmentRecommendations; track rec.department) {
                            <div class="dept-rec">
                              <strong>{{ rec.department }}:</strong>
                              <span>{{ rec.recommendation }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    }

                    <!-- Questions to Ask -->
                    @if (message.insights.questionsToAsk?.length > 0) {
                      <div class="insight-section">
                        <div class="section-header">
                          <span class="section-icon">❓</span>
                          <h5>Questions You Should Ask</h5>
                        </div>
                        <div class="questions-grid">
                          @for (question of message.insights.questionsToAsk; track question) {
                            <button 
                              type="button"
                              class="question-btn" 
                              (click)="askQuestion(question)">
                              {{ question }}
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  {{ message.content }}
                }
                
                @if (message.result) {
                  <div class="result-section">
                    <!-- Visualization Recommendation -->
                    @if (message.result.visualization) {
                      <div class="visualization-recommendation">
                        <div class="rec-header">
                          Recommended: {{ message.result.visualization.type }} chart
                        </div>
                        <button 
                          type="button"
                          class="btn-create-chart" 
                          (click)="createVisualization.emit(message.result)">
                          Create Chart
                        </button>
                      </div>
                    }

                    <!-- Confidence Score -->
                    @if (message.result.confidence > 0) {
                      <div class="confidence-bar">
                        <div class="confidence-label">
                          Confidence: {{ (message.result.confidence * 100).toFixed(0) }}%
                        </div>
                        <div class="confidence-track">
                          <div 
                            class="confidence-fill" 
                            [style.width.%]="message.result.confidence * 100"
                            [class.high]="message.result.confidence > 0.7"
                            [class.medium]="message.result.confidence > 0.4 && message.result.confidence <= 0.7"
                            [class.low]="message.result.confidence <= 0.4">
                          </div>
                        </div>
                      </div>
                    }

                    <!-- Execution Time -->
                    <div class="meta-info">
                      <span class="execution-time">{{ message.result.executionTime.toFixed(0) }}ms</span>
                    </div>
                  </div>
                }

                <!-- Suggestions -->
                @if (message.result?.suggestions && message.result.suggestions.length > 0) {
                  <div class="follow-up-suggestions">
                    <p class="suggestions-title">You might also ask:</p>
                    @for (suggestion of message.result.suggestions.slice(0, 3); track suggestion) {
                      <button 
                        type="button"
                        class="suggestion-chip" 
                        (click)="askQuestion(suggestion)">
                        {{ suggestion }}
                      </button>
                    }
                  </div>
                }
              </div>
              
              <div class="message-time">
                {{ formatTime(message.timestamp) }}
              </div>
            </div>
          }

          @if (aiQuery.isProcessing()) {
            <div class="message assistant typing">
              <div class="message-content">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="typing-text">Analyzing...</span>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="chat-input">
          <input
            type="text"
            [(ngModel)]="currentQuestion"
            (keydown.enter)="sendQuestion()"
            [disabled]="aiQuery.isProcessing() || !hasData()"
            placeholder="Ask anything about your data..."
            class="question-input"
          />
          <button 
            type="button"
            class="btn-send" 
            (click)="sendQuestion()"
            [disabled]="!currentQuestion().trim() || aiQuery.isProcessing() || !hasData()">
            @if (aiQuery.isProcessing()) {
              ⋯
            } @else {
              →
            }
          </button>
        </div>

        @if (!hasData()) {
          <div class="no-data-warning">
            Load data first to start asking questions
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .ai-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 100%;
      background: #fff;
      border: 1px solid #d6dee9;
      border-radius: 6px;
      overflow: hidden;
    }

    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 18px;
      background: #f8fafc;
      border-bottom: 1px solid #d6dee9;
      flex-shrink: 0;
    }

    .ai-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ai-icon {
      font-size: 18px;
    }

    .ai-title h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #172033;
    }

    .badge {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge.disabled {
      background: #e2e8f0;
      color: #64748b;
    }

    .badge.active {
      background: #dcfce7;
      color: #166534;
    }

    .badge.processing {
      background: #fef3c7;
      color: #92400e;
    }

    .ai-actions {
      display: flex;
      gap: 6px;
    }

    .btn-enable, .btn-primary {
      padding: 8px 14px;
      background: #14532d;
      color: white;
      border: 1px solid #14532d;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-enable:hover, .btn-primary:hover {
      background: #166534;
    }

    .btn-settings {
      padding: 7px 11px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s;
      color: #475569;
    }

    .btn-settings:hover {
      background: #f1f5f9;
    }

    .enable-prompt {
      flex: 1;
      min-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      background: #fff;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .enable-content {
      max-width: 420px;
      text-align: center;
    }

    .enable-content h4 {
      margin: 0 0 12px 0;
      font-size: 18px;
      font-weight: 600;
      color: #172033;
    }

    .enable-content p {
      margin: 10px 0;
      color: #475569;
      line-height: 1.5;
      font-size: 14px;
    }

    .enable-content ul {
      text-align: left;
      margin: 16px 0;
      padding-left: 18px;
      color: #475569;
      line-height: 1.6;
      font-size: 14px;
    }

    .privacy-note {
      padding: 14px;
      background: #f0fdf4;
      border-left: 3px solid #22c55e;
      border-radius: 4px;
      margin: 16px 0;
      text-align: left;
      font-size: 13px;
      line-height: 1.5;
    }

    .privacy-note strong {
      color: #166534;
    }

    .settings-panel {
      background: #f8fafc;
      padding: 16px 18px;
      border-bottom: 1px solid #d6dee9;
      flex-shrink: 0;
    }

    .settings-panel h4 {
      margin: 0 0 14px 0;
      color: #172033;
      font-size: 14px;
      font-weight: 600;
    }

    .setting-item {
      padding: 10px 0;
      border-bottom: 1px solid #e2e8f0;
    }

    .setting-item:last-child {
      border-bottom: none;
    }

    .setting-item label {
      display: block;
      font-weight: 500;
      color: #172033;
      margin-bottom: 3px;
      font-size: 13px;
    }

    .setting-item .info {
      font-size: 12px;
      color: #64748b;
    }

    .settings-panel .actions {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }

    .btn-secondary {
      padding: 7px 14px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #475569;
      font-weight: 500;
    }

    .btn-secondary:hover {
      background: #f1f5f9;
    }

    .btn-danger {
      padding: 7px 14px;
      background: #dc2626;
      border: 1px solid #dc2626;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: white;
      font-weight: 500;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }

    .chat-container {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 18px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Custom scrollbar styling */
    .chat-container::-webkit-scrollbar {
      width: 8px;
    }

    .chat-container::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 4px;
    }

    .chat-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }

    .chat-container::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .welcome {
      text-align: center;
      padding: 16px;
    }

    .welcome h4 {
      margin: 0 0 10px 0;
      color: #172033;
      font-size: 16px;
      font-weight: 600;
    }

    .welcome p {
      color: #64748b;
      margin-bottom: 18px;
      font-size: 14px;
    }

    .insights-cta {
      margin: 24px 0;
      padding: 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 8px;
      border: 1px solid #bbf7d0;
    }

    .btn-generate-insights {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 14px 20px;
      background: #14532d;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-generate-insights:hover:not(:disabled) {
      background: #166534;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .btn-generate-insights:disabled {
      background: #94a3b8;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .btn-generate-insights .icon {
      font-size: 18px;
    }

    .btn-generate-insights .spinner {
      font-size: 20px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .insights-description {
      margin: 10px 0 0 0;
      font-size: 12px;
      color: #166534;
      text-align: center;
      line-height: 1.4;
    }

    .capabilities {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }

    .capability {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }

    .capability span:first-child {
      font-size: 20px;
    }

    .capability span:last-child {
      font-size: 13px;
      color: #475569;
      font-weight: 500;
    }

    .suggestions-section {
      margin-top: 20px;
    }

    .suggestions-title {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 10px;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .suggestion-btn, .suggestion-chip {
      padding: 8px 13px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      color: #475569;
      transition: all 0.15s;
      font-weight: 500;
    }

    .suggestion-btn:hover, .suggestion-chip:hover {
      background: #14532d;
      border-color: #14532d;
      color: white;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 82%;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      align-self: flex-end;
    }

    .message.assistant, .message.system {
      align-self: flex-start;
    }

    .message-content {
      padding: 12px 14px;
      border-radius: 8px;
      line-height: 1.55;
      font-size: 14px;
    }

    .message.user .message-content {
      background: #14532d;
      color: white;
      border-bottom-right-radius: 3px;
    }

    .message.assistant .message-content {
      background: #f8fafc;
      color: #172033;
      border-bottom-left-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    .message.insights .message-content {
      background: white;
      color: #172033;
      border-radius: 8px;
      border: 1px solid #d6dee9;
      padding: 0;
      max-width: 100%;
    }

    .insights-report {
      width: 100%;
    }

    .insights-title {
      margin: 0;
      padding: 16px 18px;
      background: linear-gradient(135deg, #14532d 0%, #166534 100%);
      color: white;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px 8px 0 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .quality-badge {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .quality-badge.high {
      background: #dcfce7;
      color: #166534;
    }

    .quality-badge.medium {
      background: #fef3c7;
      color: #92400e;
    }

    .quality-badge.low {
      background: #fecaca;
      color: #991b1b;
    }

    .insight-section {
      padding: 16px 18px;
      border-bottom: 1px solid #e2e8f0;
    }

    .insight-section:last-child {
      border-bottom: none;
      border-radius: 0 0 8px 8px;
    }

    .insight-section.executive {
      background: #f8fafc;
    }

    .insight-section.warning {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
    }

    .insight-section.success {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
    }

    .insight-section.alert {
      background: #fef2f2;
      border-left: 4px solid #ef4444;
    }

    .insight-section.action {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .section-icon {
      font-size: 18px;
    }

    .section-header h5 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #172033;
    }

    .summary-text {
      margin: 0;
      color: #475569;
      line-height: 1.6;
      font-size: 14px;
    }

    .insight-list {
      margin: 0;
      padding-left: 20px;
      list-style: disc;
    }

    .insight-list li {
      color: #475569;
      line-height: 1.6;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .insight-list li:last-child {
      margin-bottom: 0;
    }

    .insight-with-source {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .insight-text {
      color: #475569;
      line-height: 1.6;
    }

    .source-info {
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.6);
      border-left: 3px solid #3b82f6;
      border-radius: 4px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .source-details {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      color: #64748b;
    }

    .source-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .source-details strong {
      color: #14532d;
      font-weight: 600;
    }

    .calculation {
      padding: 2px 6px;
      background: #f1f5f9;
      border-radius: 3px;
      font-size: 11px;
      color: #475569;
      font-family: 'Courier New', monospace;
    }

    .row-refs {
      padding: 2px 6px;
      background: #dbeafe;
      border-radius: 3px;
      font-size: 11px;
      color: #1e40af;
      font-weight: 500;
    }

    .sample-values {
      padding: 2px 6px;
      background: #fef3c7;
      border-radius: 3px;
      font-size: 11px;
      color: #92400e;
      font-family: 'Courier New', monospace;
    }

    .confidence-tag {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      align-self: flex-start;
    }

    .confidence-tag.high {
      background: #dcfce7;
      color: #166534;
    }

    .confidence-tag.medium {
      background: #fef3c7;
      color: #92400e;
    }

    .confidence-tag.low {
      background: #fecaca;
      color: #991b1b;
    }

    .dept-recommendations {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .dept-rec {
      padding: 10px 12px;
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      font-size: 13px;
      line-height: 1.5;
    }

    .dept-rec strong {
      color: #14532d;
      font-weight: 600;
      display: block;
      margin-bottom: 4px;
    }

    .dept-rec span {
      color: #475569;
    }

    .questions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 8px;
    }

    .question-btn {
      padding: 10px 12px;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      color: #475569;
      text-align: left;
      transition: all 0.15s;
      font-weight: 500;
      line-height: 1.4;
    }

    .question-btn:hover {
      background: #14532d;
      border-color: #14532d;
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .message-time {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 5px;
      padding: 0 6px;
    }

    .result-section {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .visualization-recommendation {
      background: #fef3c7;
      padding: 10px 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border: 1px solid #fde68a;
    }

    .rec-header {
      font-size: 12px;
      color: #78350f;
      font-weight: 500;
    }

    .btn-create-chart {
      padding: 6px 12px;
      background: #14532d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      transition: background 0.15s;
    }

    .btn-create-chart:hover {
      background: #166534;
    }

    .confidence-bar {
      margin: 10px 0;
    }

    .confidence-label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 5px;
    }

    .confidence-track {
      height: 5px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      transition: width 0.4s ease-out;
      border-radius: 3px;
    }

    .confidence-fill.high { background: #22c55e; }
    .confidence-fill.medium { background: #f59e0b; }
    .confidence-fill.low { background: #ef4444; }

    .meta-info {
      display: flex;
      gap: 10px;
      margin-top: 7px;
    }

    .execution-time {
      font-size: 11px;
      color: #94a3b8;
    }

    .follow-up-suggestions {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
    }

    .typing-indicator {
      display: flex;
      gap: 5px;
      margin-bottom: 6px;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #94a3b8;
      border-radius: 50%;
      animation: bounce 1.3s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(1) { animation-delay: -0.28s; }
    .typing-indicator span:nth-child(2) { animation-delay: -0.14s; }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    .typing-text {
      font-size: 12px;
      color: #94a3b8;
    }

    .chat-input {
      display: flex;
      gap: 10px;
      padding: 16px 18px;
      background: #fff;
      border-top: 1px solid #d6dee9;
      flex-shrink: 0;
    }

    .question-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.15s;
      font-family: inherit;
      color: #172033;
    }

    .question-input::placeholder {
      color: #94a3b8;
    }

    .question-input:focus {
      border-color: #14532d;
    }

    .question-input:disabled {
      background: #f1f5f9;
      cursor: not-allowed;
      color: #94a3b8;
    }

    .btn-send {
      min-width: 42px;
      height: 42px;
      padding: 0;
      background: #14532d;
      color: white;
      border: 1px solid #14532d;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-send:hover:not(:disabled) {
      background: #166534;
    }

    .btn-send:disabled {
      background: #e2e8f0;
      border-color: #e2e8f0;
      color: #94a3b8;
      cursor: not-allowed;
    }

    .no-data-warning {
      padding: 10px 14px;
      background: #fef3c7;
      color: #78350f;
      text-align: center;
      font-size: 13px;
      border-radius: 4px;
      margin: 0 18px 16px 18px;
      flex-shrink: 0;
    }
  `]
})
export class AIInsightsPanelComponent {
  // Inputs
  readonly columns = input<string[]>([]);
  readonly rows = input<any[]>([]);
  readonly profiles = input<any[]>([]);

  // Outputs
  readonly createVisualization = output<AIQueryResult>();

  // State
  readonly messages = signal<ChatMessage[]>([]);
  readonly currentQuestion = signal('');
  readonly settingsOpen = signal(false);
  readonly isGeneratingInsights = signal(false);

  // Computed
  readonly hasData = computed(() => this.rows().length > 0);
  readonly suggestedQuestions = computed(() => this.generateSuggestions());

  constructor(readonly aiQuery: AIQueryService) {
    // Auto-scroll to bottom when new messages arrive
    effect(() => {
      const msgs = this.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  async enableAI(): Promise<void> {
    try {
      await this.aiQuery.enable();
      this.addSystemMessage('Query assistant enabled. Check the interpreted fields and calculation in each answer.');
    } catch (error) {
      this.addSystemMessage('Failed to enable AI Insights. Please try again.');
      console.error('Failed to enable AI:', error);
    }
  }

  async disableAI(): Promise<void> {
    await this.aiQuery.disable();
    this.messages.set([]);
    this.settingsOpen.set(false);
  }

  async sendQuestion(): Promise<void> {
    const question = this.currentQuestion().trim();
    if (!question || this.aiQuery.isProcessing() || !this.hasData()) return;

    // Add user message
    this.addMessage({ type: 'user', content: question });

    // Clear input
    this.currentQuestion.set('');

    try {
      // Process query
      const result = await this.aiQuery.processQuery(question, {
        columns: this.columns(),
        rows: this.rows(),
        profiles: this.profiles(),
        sampleData: this.rows().slice(0, 100)
      });

      // Add assistant response
      this.addMessage({
        type: 'assistant',
        content: result.answer,
        result
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      this.addMessage({
        type: 'assistant',
        content: errorMsg
      });
    }
  }

  askQuestion(question: string): void {
    this.currentQuestion.set(question);
    this.sendQuestion();
  }

  clearHistory(): void {
    this.messages.set([]);
    this.aiQuery.clearHistory();
  }

  async generateProactiveInsights(): Promise<void> {
    if (!this.hasData() || this.isGeneratingInsights()) return;

    this.isGeneratingInsights.set(true);

    try {
      const insights = this.aiQuery.generateProactiveInsights({
        columns: this.columns(),
        rows: this.rows(),
        profiles: this.profiles(),
        sampleData: this.rows().slice(0, 100)
      });

      // Add insights message
      this.addMessage({
        type: 'insights',
        content: 'Business Intelligence Report',
        insights
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate insights';
      this.addMessage({
        type: 'assistant',
        content: errorMsg
      });
    } finally {
      this.isGeneratingInsights.set(false);
    }
  }

  private addMessage(partial: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    const message: ChatMessage = {
      ...partial,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, message]);
  }

  private addSystemMessage(content: string): void {
    this.addMessage({ type: 'system', content });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private scrollToBottom(): void {
    const container = document.querySelector('.chat-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  private generateSuggestions(): string[] {
    if (!this.hasData()) return [];

    const profiles = this.profiles();
    const suggestions: string[] = [];

    const measures = profiles.filter(p =>
      ['Integer', 'Decimal', 'Currency', 'Percentage'].includes(p.type)
    );

    const dimensions = profiles.filter(p =>
      ['Category', 'String', 'Date', 'DateTime'].includes(p.type)
    );

    if (measures.length > 0) {
      suggestions.push(`What's the total ${measures[0].name}?`);
    }

    if (dimensions.length > 0 && measures.length > 0) {
      suggestions.push(`How does ${measures[0].name} compare across ${dimensions[0].name}?`);
    }

    const dateField = dimensions.find(d => d.type === 'Date' || d.type === 'DateTime');
    if (dateField && measures.length > 0) {
      suggestions.push(`Show me the trend in ${measures[0].name} over time`);
    }

    if (measures.length > 1) {
      suggestions.push(`Is there a correlation between ${measures[0].name} and ${measures[1].name}?`);
    }

    suggestions.push(`What unusual patterns exist in the data?`);

    return suggestions.slice(0, 4);
  }

  isInsightWithSource(insight: any): boolean {
    return insight && typeof insight === 'object' && 'text' in insight && 'sources' in insight;
  }

  formatRowIndices(indices: number[]): string {
    if (indices.length <= 3) {
      return indices.map(i => i + 1).join(', ');
    }
    return `${indices.slice(0, 3).map(i => i + 1).join(', ')}... (+${indices.length - 3} more)`;
  }

  formatSampleValues(values: any[]): string {
    if (values.length <= 3) {
      return values.map(v => this.formatValue(v)).join(', ');
    }
    return `${values.slice(0, 3).map(v => this.formatValue(v)).join(', ')}...`;
  }

  formatValue(value: any): string {
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(value);
  }
}
