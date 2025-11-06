import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { StoreAppService } from '../../../core/store/store-app.service';
import { BalanceService } from '../../../core/services/helpers/trading/balance.service';
import { Balance } from '../../../core/models';

@Component({
  selector: 'app-test-b',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test-b.component.html',
  styleUrls: ['./test-b.component.scss']
})
export class TestBComponent implements OnInit {

  // INject
  private readonly balanceService = inject(BalanceService);



  constructor() { }

  ngOnInit() {
  }

  enviar(): void {
    let balance = this.balanceService.balance();
    balance = {
      ...balance,
      totalUSDT: 17.023658
    }
    this.balanceService.balance.update((balance: Balance) => {
      return {
        ...balance,
        totalUSDT: balance.totalUSDT -= 10
      };
    })
  }

}
