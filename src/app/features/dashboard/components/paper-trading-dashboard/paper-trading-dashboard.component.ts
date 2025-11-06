// components/paper-trading-dashboard/paper-trading-dashboard.component.ts
import { Component, computed, effect, Inject, inject, OnInit, signal, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ITradingService } from '../../../../core/base/trading-service.interface';
import { PaperTradingService } from '../../../../core/services/paper/paper-trading.service';
import { Balance } from '../../../../core/models';
import { StoreAppService } from '../../../../core/store/store-app.service';
import { BalanceService } from '../../../../core/services/helpers/trading/balance.service';
import { OrdersPanelComponent } from "../orders-panel/orders-panel.component";


@Component({
  selector: 'app-paper-trading-dashboard',
  standalone: true,
  imports: [CommonModule, OrdersPanelComponent],
  templateUrl: './paper-trading-dashboard.component.html',
  styleUrl: './paper-trading-dashboard.component.scss'
})
export class PaperTradingDashboardComponent implements OnInit {
  // paperTrading = inject(PaperTradingService);
  private readonly storeApp = inject(StoreAppService);
  // TOmar el balance del Servicio BalanceService
  private readonly balanceService = inject(BalanceService);

  public paperBalance = computed(() => this.storeApp.paperBalance())
  // public balance = computed<Balance>(() => this.storeApp.paperBalance());
  public balance!: Balance
  public openOrders!: any
  public closedOrders!: any
  constructor(
    // @Inject('ITradingService')
    //   private paperTrading: ITradingService,
    private paperTrading: PaperTradingService
  ) { 
    effect(() => {
      console.log('🪙 Balance: ', this.paperBalance().totalUSDT)
    })
  }

  ngOnInit(): void {
    // this.balance = this.paperTrading.balance;
   this.balance = this.balanceService.getBalance();
    // this.paperTrading.getAccountBalance()
    //   .subscribe(balance => {
    //     this.balance = balance;
    //   });
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