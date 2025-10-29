export interface AiResponse {
    decision: 'BUY' | 'SELL' | 'HOLD';
    confidence: number; // 0 a 1
    reason: string;
    rawJson: any; // Para mostrar el JSON crudo
}