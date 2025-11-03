export interface AiResponse {
    decision: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; // 0 a 1
    reason: string;
    selected_strategy?: string;
    rawJson: any; // Para mostrar el JSON crudo
}

export interface OllamaTradingResponse {
    decision: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
    selected_strategy?: string;
    rawJson?: any;
}