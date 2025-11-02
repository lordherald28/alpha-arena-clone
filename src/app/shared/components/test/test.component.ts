import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { WsocketTest } from '../../../core/services/ws-test.service';




@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './test.component.html',
  styleUrls: ['./test.component.scss']
})
export class TestComponent implements OnInit {


  private ws = inject(WsocketTest);



  constructor() { }

  ngOnInit() {
    this.ws.messageSubs.set({ id: Date.now().toString(), method: 'state.subscribe', params: { 'market_list': ['BTCUSDT'] } })
  }

  onConn(): void {
    this.ws.connect();
  }

  onState() {
    console.log(this.ws.state);
  }

  onDesc() {
    this.ws.disconnect();
  }
}
