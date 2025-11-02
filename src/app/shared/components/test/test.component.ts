import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { WSocketCoinEx } from '../../../core/services/ws-coinex.service';




@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})
export class TestComponent implements OnInit {


  private ws = inject(WSocketCoinEx);



  constructor() { }

  ngOnInit() {
    this.ws.messageSubs.set({ id: Date.now().toString(), method: 'state.subscribe', params: { 'market_list': ['BTCUSDT'] } })
  }

  onConn(): void {
    // this.ws.connect();
  }

  onState() {
    console.log(this.ws.state);
  }

  onDesc() {
    // this.ws.disconnect();
  }
}
