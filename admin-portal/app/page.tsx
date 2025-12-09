'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    todayOrders: 45,
    todayRevenue: 1250.50,
    pendingOrders: 8,
    activeCustomers: 234,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <div className="flex gap-4">
              <button className="text-gray-600 hover:text-gray-900">Orders</button>
              <button className="text-gray-600 hover:text-gray-900">Menu</button>
              <button className="text-gray-600 hover:text-gray-900">Customers</button>
              <button className="text-gray-600 hover:text-gray-900">Reports</button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-sm text-gray-600 mb-2">Today's Orders</div>
            <div className="text-3xl font-bold text-blue-600">{stats.todayOrders}</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-sm text-gray-600 mb-2">Today's Revenue</div>
            <div className="text-3xl font-bold text-green-600">
              ${stats.todayRevenue.toFixed(2)}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-sm text-gray-600 mb-2">Pending Orders</div>
            <div className="text-3xl font-bold text-orange-600">{stats.pendingOrders}</div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-sm text-gray-600 mb-2">Active Customers</div>
            <div className="text-3xl font-bold text-purple-600">{stats.activeCustomers}</div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Recent Orders</h2>
          </div>
          <div className="p-6">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="pb-3">Order #</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Total</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-4">ORD-500{i}</td>
                    <td className="py-4">John Doe</td>
                    <td className="py-4">Delivery</td>
                    <td className="py-4">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                        Preparing
                      </span>
                    </td>
                    <td className="py-4 font-semibold">$45.99</td>
                    <td className="py-4">
                      <button className="text-blue-600 hover:text-blue-800">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

