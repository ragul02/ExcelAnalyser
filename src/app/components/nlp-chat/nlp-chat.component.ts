import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NLPQueryService, QueryResult } from '../../services/nlp-query.service';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  result?: QueryResult;
}

@Component({
  selector: 'app-nlp-chat',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="nlp-chat-container">
      <!-- Header -->
      <div class="chat-header">
        <h3>Ask Questions About Your Data</h3>
        <button 
          type="button"
          (click)="clearChat()" 
          class="clear-btn"
          [disabled]="messages().length === 0">
          Clear
        </button>
      </div>

      <!-- Messages -->
      <div class="chat-messages" #messagesContainer>
        @if (messages().length === 0) {
          <div class="welcome-message">
            <p>👋 Hi! I can help you analyze your data. Try asking:</p>
            <div class="suggestions">
              @for (suggestion of suggestedQueries(); track suggestion) {
                <button 
                  type="button"
                  class="suggestion-chip" 
                  (click)="askQuestion(suggestion)">
                  {{ suggestion }}
                </button>
              }
            </div>
          </div>
        }

        @for (message of messages(); track message.id) {
          <div class="message" [class.user]="message.type === 'user'" [class.assistant]="message.type === 'assistant'">
            <div class="message-content">
              <div class="message-text">{{ message.content }}</div>
              
              @if (message.result?.success && message.result.data) {
                <div class="result-card">
                  <div class="result-visualization">
                    @if (message.result.visualization?.type === 'table') {
                      <div class="simple-result">
                        Result: <strong>{{ formatResult(message.result.data) }}</strong>
                      </div>
                    } @else if (message.result.visualization?.type === 'bar') {
                      <div class="chart-suggestion">
                        💡 <em>Recommended: Bar Chart</em>
                        <button type="button" (click)="createChart.emit(message.result)" class="action-btn">
                          Create Chart
                        </button>
                      </div>
                    } @else if (message.result.visualization?.type === 'line') {
                      <div class="chart-suggestion">
                        💡 <em>Recommended: Line Chart</em>
                        <button type="button" (click)="createChart.emit(message.result)" class="action-btn">
                          Create Chart
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (message.result?.suggestions && message.result.suggestions.length > 0) {
                <div class="suggestions-card">
                  <p><strong>Try asking:</strong></p>
                  @for (suggestion of message.result.suggestions; track suggestion) {
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
            <div class="message-time">{{ formatTime(message.timestamp) }}</div>
          </div>
        }

        @if (isProcessing()) {
          <div class="message assistant processing">
            <div class="message-content">
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Input -->
      <div class="chat-input">
        <input
          type="text"
          [(ngModel)]="currentQuery"
          (keydown.enter)="sendQuery()"
          [disabled]="isProcessing() || !hasData()"
          placeholder="Ask a question about your data..."
          class="query-input"
        />
        <button 
          type="button"
          (click)="sendQuery()" 
          [disabled]="!currentQuery().trim() || isProcessing() || !hasData()"
          class="send-btn">
          {{ isProcessing() ? '⏳' : '➤' }}
        </button>
      </div>

      @if (!hasData()) {
        <div class="no-data-message">
          📊 Load data first to start asking questions
        </div>
      }
    </div>
  `,
  styles: [`
    .nlp-chat-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .chat-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .clear-btn {
      padding: 6px 12px;
      background: transparent;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #666;
    }

    .clear-btn:hover:not(:disabled) {
      background: #f0f0f0;
    }

    .clear-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .welcome-message {
      text-align: center;
      padding: 32px 16px;
      color: #666;
    }

    .welcome-message p {
      margin-bottom: 16px;
      font-size: 14px;
    }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 80%;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      align-self: flex-end;
    }

    .message.assistant {
      align-self: flex-start;
    }

    .message-content {
      padding: 12px 16px;
      border-radius: 12px;
      line-height: 1.5;
    }

    .message.user .message-content {
      background: #007bff;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .message-content {
      background: #f0f0f0;
      color: #333;
      border-bottom-left-radius: 4px;
    }

    .message-text {
      font-size: 14px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message-time {
      font-size: 11px;
      color: #999;
      margin-top: 4px;
      padding: 0 4px;
    }

    .result-card {
      margin-top: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .simple-result {
      font-size: 14px;
      color: #333;
    }

    .simple-result strong {
      color: #007bff;
      font-size: 18px;
    }

    .chart-suggestion {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: #666;
    }

    .action-btn {
      padding: 6px 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .action-btn:hover {
      background: #0056b3;
    }

    .suggestions-card {
      margin-top: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .suggestions-card p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #666;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .suggestion-chip {
      padding: 8px 12px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 16px;
      cursor: pointer;
      font-size: 12px;
      color: #333;
      transition: all 0.2s;
    }

    .suggestion-chip:hover {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 8px 0;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      background: #999;
      border-radius: 50%;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
      }
      30% {
        transform: translateY(-10px);
      }
    }

    .chat-input {
      display: flex;
      gap: 8px;
      padding: 16px;
      border-top: 1px solid #e0e0e0;
      background: #f8f9fa;
    }

    .query-input {
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }

    .query-input:focus {
      border-color: #007bff;
    }

    .query-input:disabled {
      background: #f0f0f0;
      cursor: not-allowed;
    }

    .send-btn {
      padding: 12px 24px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      min-width: 60px;
    }

    .send-btn:hover:not(:disabled) {
      background: #0056b3;
    }

    .send-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .no-data-message {
      padding: 12px;
      text-align: center;
      background: #fff3cd;
      color: #856404;
      font-size: 13px;
    }

    .processing {
      opacity: 0.9;
    }
  `]
})
export class NLPChatComponent {
  // Inputs
  readonly availableFields = input<string[]>([]);
  readonly data = input<any[]>([]);
  
  // Outputs
  readonly createChart = output<QueryResult>();
  
  // State
  readonly messages = signal<ChatMessage[]>([]);
  readonly currentQuery = signal('');
  readonly isProcessing = signal(false);
  
  // Computed
  readonly hasData = computed(() => this.data().length > 0);
  readonly suggestedQueries = computed(() => this.generateSuggestions());

  constructor(private nlpService: NLPQueryService) {}

  /**
   * Send user query
   */
  async sendQuery(): Promise<void> {
    const query = this.currentQuery().trim();
    if (!query || this.isProcessing() || !this.hasData()) return;

    // Add user message
    this.addMessage({
      type: 'user',
      content: query
    });

    // Clear input
    this.currentQuery.set('');
    this.isProcessing.set(true);

    try {
      // Process query
      const result = await this.nlpService.processQuery(
        query,
        this.availableFields(),
        this.data()
      );

      // Add assistant response
      this.addMessage({
        type: 'assistant',
        content: result.narrative,
        result
      });

    } catch (error) {
      console.error('Query error:', error);
      this.addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.'
      });
    } finally {
      this.isProcessing.set(false);
    }
  }

  /**
   * Quick ask from suggestion
   */
  askQuestion(query: string): void {
    this.currentQuery.set(query);
    this.sendQuery();
  }

  /**
   * Add message to chat
   */
  private addMessage(partial: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    const message: ChatMessage = {
      ...partial,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: new Date()
    };
    this.messages.update(msgs => [...msgs, message]);
  }

  /**
   * Clear chat history
   */
  clearChat(): void {
    this.messages.set([]);
  }

  /**
   * Format result for display
   */
  formatResult(data: any): string {
    if (data === null || data === undefined) return 'No data';
    
    if (typeof data === 'object' && 'value' in data) {
      const value = data.value;
      if (typeof value === 'number') {
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      return String(value);
    }
    
    if (Array.isArray(data)) {
      return `${data.length} records`;
    }
    
    return String(data);
  }

  /**
   * Format timestamp
   */
  formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(): string[] {
    const fields = this.availableFields();
    if (fields.length === 0) return [];

    const suggestions: string[] = [];
    
    // Find numeric fields
    const numericFields = fields.filter(f => 
      /sales|revenue|amount|price|cost|value|quantity|total/i.test(f)
    );
    
    // Find categorical fields
    const categoryFields = fields.filter(f => 
      /category|type|region|product|customer|name/i.test(f)
    );
    
    // Find date fields
    const dateFields = fields.filter(f => 
      /date|time/i.test(f)
    );

    // Generate suggestions based on available fields
    if (numericFields.length > 0) {
      suggestions.push(`What is the total ${numericFields[0]}?`);
      suggestions.push(`What's the average ${numericFields[0]}?`);
    }

    if (categoryFields.length > 0 && numericFields.length > 0) {
      suggestions.push(`Show top 5 ${categoryFields[0]} by ${numericFields[0]}`);
    }

    if (dateFields.length > 0 && numericFields.length > 0) {
      suggestions.push(`Show ${numericFields[0]} in Q1`);
    }

    if (numericFields.length > 1) {
      suggestions.push(`Compare ${numericFields[0]} and ${numericFields[1]}`);
    }

    return suggestions.slice(0, 4);
  }
}
