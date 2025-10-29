import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-orders-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders-panel.component.html',
  styleUrls: ['./orders-panel.component.scss']
})
export class OrdersPanelComponent {
  // Aquí recibirías las órdenes como input
  // public orders = input<Order[]>([]);
  public mockOrders = [
    { id: '1', side: 'buy', type: 'market', amount: 0.001, price: 60000, status: 'filled', createdAt: new Date() },
    { id: '2', side: 'sell', type: 'limit', amount: 0.001, price: 65000, status: 'pending', createdAt: new Date() }
  ];
}