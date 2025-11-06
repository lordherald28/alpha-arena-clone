import { Observable } from "rxjs";
import { AiResponse, Candlestick, TypeMarket } from "../models";
import { environment } from "../../environments/environment";


export abstract class IAService {
    abstract analyzeMarket(candles: Candlestick[], accountBalance: number, openPositions: number, typeMarket: TypeMarket): Observable<AiResponse>;
}