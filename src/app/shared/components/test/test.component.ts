import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
// import { WSocketCoinEx } from '../../../core/services/coinex/ws-coinex.service.ts_backup';
import { StoreAppService } from '../../../core/store/store-app.service';




@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})
export class TestComponent implements OnInit {


  // private ws = inject(WSocketCoinEx);
  private StoreAppService = inject(StoreAppService)
  private readonly marketInfo = computed(() => this.StoreAppService.marketDataConfig())

  constructor() { }

  ngOnInit() {
    // this.ws.messageSubs.set({ id: Date.now().toString(), method: 'state.subscribe', params: { 'market_list': ['BTCUSDT'] } })
  }

  onConn(): void {
    // this.ws.connect(this.marketInfo());
  }

  onState() {
    // console.log(this.ws.state);
  }

  onDesc() {
    // this.ws.disconnect(this.marketInfo());
  }
}
