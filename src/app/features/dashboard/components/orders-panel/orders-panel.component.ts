import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';


import { StoreAppService } from '../../../../core/store/store-app.service';
import { PaperTradingService } from '../../../../core/services/paper/paper-trading.service';
import { OrderSide, TradingOrderExtended } from '../../../../core/models';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LIMI_OPEN_ORDERS, } from '../../../../core/utils/const.utils';
@Component({
  selector: 'app-orders-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './orders-panel.component.html',
  styleUrls: ['./orders-panel.component.scss']
})
export class OrdersPanelComponent {


  // inject
  private readonly storeApp = inject(StoreAppService);
  private readonly paperTrading = inject(PaperTradingService);
  private readonly fb = inject(FormBuilder);


  // signal

  // computed
  public flagsAutoTrading = computed(() => this.storeApp.autoTradingEnableStoreApp());
  public flagsActivarIA = computed(() => this.storeApp.desactivarIA());
  private countOpenOrders = computed(() => this.storeApp.openOrders().length)

  public formOrder!: FormGroup;


  public orderSide = OrderSide;

  constructor() {
    this.formOrder = this.fb.group({
      amount: [{ value: 0, disabled: this.countOpenOrders() >= LIMI_OPEN_ORDERS }, { validators: [Validators.min(0), Validators.required] }]
    })
  }

  // Publico

  /**
   * 
   * @param orderSide Metodo que se puede unificar, deuda tecnica
   */
  openOrderBuyOrSell(orderSide: OrderSide): void {
    if (this.formOrder.valid) {
      const market = this.storeApp.MarkInfo()?.market;
      const side = orderSide;
      const amount = this.formOrder.get('amount')!.value?.toString();
      const order: TradingOrderExtended = {
        market: market!,
        side: side,
        amount: amount as any,
        type: 'market'
      }
      console.log(`💶 ---> ${JSON.stringify(order)}`);
      this.paperTrading.placeMarketOrder(order);
    } else {
      this.formOrder.markAllAsTouched();
    }

  }

  openOrderSell(): void {
    console.log('💶 SELL')
  }

  toggleActivarIA() {
    if (!this.flagsActivarIA()) {
      this.activarIA();
    } else {
      this.desactivarIA();
    }
  }

  toggleAutoTrading(): void {
    if (!this.flagsAutoTrading()) {
      this.enableAutoTrading()
    } else {
      this.disabledAutoTrading();
    }
  }

  // Privado
  private enableAutoTrading(): void {
    this.storeApp.autoTradingEnableStoreApp.set(true);
  }

  private disabledAutoTrading(): void {
    this.storeApp.autoTradingEnableStoreApp.set(false);
  }

  private activarIA(): void {
    this.storeApp.desactivarIA.set(true);
  }

  private desactivarIA(): void {
    this.storeApp.desactivarIA.set(false);
  }
}