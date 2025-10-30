// components/paper-trading-dashboard/paper-trading-dashboard.component.ts
import { Component, Inject, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ITradingService } from '../../../../core/base/trading-service.interface';
import { PaperTradingService } from '../../../../core/services/paper-trading.service';


@Component({
  selector: 'app-paper-trading-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './paper-trading-dashboard.component.html',
  styleUrl: './paper-trading-dashboard.component.scss'
})
export class PaperTradingDashboardComponent implements OnInit {
  // paperTrading = inject(PaperTradingService);
  public balance!: any
  public openOrders!: any
  public closedOrders!: any
  constructor(
    // @Inject('ITradingService')
    //   private paperTrading: ITradingService,
    private paperTrading: PaperTradingService
  ) { }

  ngOnInit(): void {
    this.balance = this.paperTrading.getPaperBalance();
    this.openOrders = this.paperTrading.getPaperOrders().open;
    this.closedOrders = this.paperTrading.getPaperOrders().closed;
  }
  // this.balance = this.paperTrading.getPaperBalance();
  // openOrders = this.paperTrading.getPaperOrders().open;
  // closedOrders = this.paperTrading.getPaperOrders().closed;

  resetTrading(): void {
    this.paperTrading.resetPaperTrading(10);
  }

}