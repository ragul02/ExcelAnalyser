import { Component, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIQueryService, AIQueryResult } from '../services/ai-query.service';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  result?: AIQueryResult;
}

@Component({
  selector: 'app-ai-insights-panel',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ai-panel">
      <!-- Header -->
      <div class="ai-header">
        <div class="ai-title">
          <span class="ai-icon">AI</span>
          <h3>AI Insights</h3>
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
            <h4>AI-Powered Data Analysis</h4>
            <p>Ask questions about your data in natural language:</p>
            <ul>
              <li>"Why did sales drop in March?"</li>
              <li>"What factors influenced revenue?"</li>
              <li>"Show me unusual patterns"</li>
              <li>"How do regions compare?"</li>
            </ul>
            <p class="privacy-note">
              <strong>Privacy First:</strong> All AI processing happens locally on your device. 
              No data is sent to external servers.
            </p>
            <button type="button" class="btn-primary" (click)="enableAI()">
              Enable AI Insights
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
            <div class="message" [class.user]="message.type === 'user'" [class.assistant]="message.type === 'assistant'" [class.system]="message.type === 'system'">
              <div class="message-content">
                {{ message.content }}
                
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
      this.addSystemMessage('AI Insights enabled! Ask me anything about your data.');
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
}
