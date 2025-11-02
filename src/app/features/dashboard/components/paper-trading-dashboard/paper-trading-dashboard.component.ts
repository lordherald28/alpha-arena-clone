// components/paper-trading-dashboard/paper-trading-dashboard.component.ts
import { Component, Inject, inject, OnInit, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ITradingService } from '../../../../core/base/trading-service.interface';
import { PaperTradingService } from '../../../../core/services/paper/paper-trading.service';
import { Balance } from '../../../../core/models';


@Component({
  selector: 'app-paper-trading-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paper-trading-dashboard.component.html',
  styleUrl: './paper-trading-dashboard.component.scss'
})
export class PaperTradingDashboardComponent implements OnInit {
  // paperTrading = inject(PaperTradingService);
  public balance = signal<Balance>({
    currency: '',
    available: 0,
    frozen: 0,
    USDT: 0,
    BTC: 0,
    totalUSDT: 0
  });
  public openOrders!: any
  public closedOrders!: any
  constructor(
    // @Inject('ITradingService')
    //   private paperTrading: ITradingService,
    private paperTrading: PaperTradingService
  ) { }

  ngOnInit(): void {
    // this.balance = this.paperTrading.balance;
    this.openOrders = this.paperTrading.getPaperOrders().open;
    this.closedOrders = this.paperTrading.getPaperOrders().closed;
  }
  // this.balance = this.paperTrading.getPaperBalance();
  // openOrders = this.paperTrading.getPaperOrders().open;
  // closedOrders = this.paperTrading.getPaperOrders().closed;

  resetTrading(): void {
    // this.paperTrading.resetPaperTrading(10);
  }

}