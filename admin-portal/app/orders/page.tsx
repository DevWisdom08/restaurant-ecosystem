'use client';

import { useState } from 'react';

interface Order {
  order_id: number;
  order_number: string;
  customer_name: string;
  order_type: string;
  order_status: string;
  total_amount: number;
  created_at: string;
}

export default function OrdersPage() {
  const [orders] = useState<Order[]>([
    {
      order_id: 5001,
      order_number: 'ORD-5001',
      customer_name: 'John Doe',
      order_type: 'Delivery',
      order_status: 'Preparing',
      total_amount: 45.99,
      created_at: '2025-12-09T14:30:00Z',
    },
    {
      order_id: 5002,
      order_number: 'ORD-5002',
      customer_name: 'Jane Smith',
      order_type: 'Pickup',
      order_status: 'Ready',
      total_amount: 32.50,
      created_at: '2025-12-09T14:25:00Z',
    },
  ]);

  const updateOrderStatus = (orderId: number, newStatus: string) => {
    // TODO: Call API to update order status
    alert(`Updating order ${orderId} to ${newStatus}`);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pending': 'bg-gray-100 text-gray-800',
      'Confirmed': 'bg-blue-100 text-blue-800',
      'Preparing': 'bg-yellow-100 text-yellow-800',
      'Ready': 'bg-green-100 text-green-800',
      'Completed': 'bg-purple-100 text-purple-800',
      'Cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Order Management</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex gap-4">
          <select className="border rounded-lg px-4 py-2">
            <option>All Status</option>
            <option>Pending</option>
            <option>Preparing</option>
            <option>Ready</option>
          </select>
          <select className="border rounded-lg px-4 py-2">
            <option>All Types</option>
            <option>Delivery</option>
            <option>Pickup</option>
            <option>Dine-in</option>
          </select>
          <input
            type="date"
            className="border rounded-lg px-4 py-2"
          />
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="p-4">Order #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Total</th>
                <th className="p-4">Time</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.order_id} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-mono">{order.order_number}</td>
                  <td className="p-4">{order.customer_name}</td>
                  <td className="p-4">{order.order_type}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(order.order_status)}`}>
                      {order.order_status}
                    </span>
                  </td>
                  <td className="p-4 font-semibold">${order.total_amount.toFixed(2)}</td>
                  <td className="p-4 text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleTimeString()}
                  </td>
                  <td className="p-4">
                    <select
                      className="border rounded px-3 py-1 text-sm"
                      onChange={(e) => updateOrderStatus(order.order_id, e.target.value)}
                      defaultValue={order.order_status}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Preparing">Preparing</option>
                      <option value="Ready">Ready</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

