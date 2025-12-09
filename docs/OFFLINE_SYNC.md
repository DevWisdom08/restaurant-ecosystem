# Offline Sync Strategy - Technical Documentation

## Overview

Offline-first architecture for POS system using PouchDB → CouchDB sync pattern.

---

## 🎯 Sync Strategy

### Three-Tier Sync Architecture

```
┌─────────────────────────────────────────┐
│         POS Application (Offline)        │
│         Local Database (PouchDB)         │
└────────────────┬────────────────────────┘
                 │
                 │ Automatic Sync
                 │ (when online)
                 ▼
┌─────────────────────────────────────────┐
│       Sync Server (CouchDB/API)         │
│        Middle Tier (Redis Cache)        │
└────────────────┬────────────────────────┘
                 │
                 │ Validated Sync
                 │
                 ▼
┌─────────────────────────────────────────┐
│      Central Database (SQL Server)      │
│          Source of Truth                │
└─────────────────────────────────────────┘
```

---

## 💾 Local Storage (PouchDB)

### PouchDB Setup

```typescript
import PouchDB from 'pouchdb';

// Create local databases
const ordersDB = new PouchDB('orders');
const menuDB = new PouchDB('menu');
const customersDB = new PouchDB('customers');

// Enable sync with remote
const remoteOrdersDB = new PouchDB('https://api.restaurant.com/sync/orders', {
  auth: {
    username: 'location_1',
    password: process.env.SYNC_PASSWORD
  }
});

// Continuous bidirectional sync
ordersDB.sync(remoteOrdersDB, {
  live: true,
  retry: true
}).on('change', (info) => {
  console.log('Sync change:', info);
}).on('error', (err) => {
  console.error('Sync error:', err);
});
```

---

## 📥 Offline Order Creation

### Create Order While Offline

```typescript
class OfflineOrderService {
  
  async createOrder(orderData: CreateOrderDTO): Promise<Order> {
    // Create order with temporary ID
    const order = {
      _id: `order_${Date.now()}_${Math.random().toString(36)}`,
      order_number: `TEMP-${Date.now()}`,
      location_id: orderData.location_id,
      customer_id: orderData.customer_id,
      order_type: orderData.order_type,
      items: orderData.items,
      subtotal: this.calculateSubtotal(orderData.items),
      tax_amount: this.calculateTax(orderData.items),
      total_amount: this.calculateTotal(orderData),
      order_status: 'pending',
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _offline: true, // Flag as offline order
      _synced: false // Not yet synced to server
    };
    
    // Save to local database
    await ordersDB.put(order);
    
    // Print kitchen ticket immediately
    await kitchenPrinter.printKitchenTicket(order);
    
    // Queue for sync when online
    await this.queueForSync(order._id);
    
    return order;
  }
  
  async queueForSync(orderId: string): Promise<void> {
    // Add to sync queue
    const syncQueue = await ordersDB.get('_local/sync_queue').catch(() => ({
      _id: '_local/sync_queue',
      items: []
    }));
    
    syncQueue.items.push({
      order_id: orderId,
      queued_at: new Date().toISOString()
    });
    
    await ordersDB.put(syncQueue);
  }
}
```

---

## 🔄 Sync Process

### Sync Orders to Server

```typescript
class SyncService {
  
  async syncOfflineOrders(): Promise<void> {
    // Check if online
    if (!navigator.onLine) {
      console.log('Device is offline, sync postponed');
      return;
    }
    
    // Get all unsynced orders
    const unsyncedOrders = await ordersDB.find({
      selector: {
        _synced: false,
        _offline: true
      }
    });
    
    console.log(`Found ${unsyncedOrders.docs.length} orders to sync`);
    
    for (const order of unsyncedOrders.docs) {
      try {
        // Send to server
        const serverOrder = await this.postOrderToServer(order);
        
        // Update local order with server ID
        await ordersDB.put({
          ...order,
          _id: `order_${serverOrder.order_id}`,
          order_id: serverOrder.order_id,
          order_number: serverOrder.order_number,
          _synced: true,
          _sync_completed_at: new Date().toISOString()
        });
        
        // Delete temporary order
        await ordersDB.remove(order);
        
        console.log(`Order ${order._id} synced successfully`);
        
      } catch (error) {
        console.error(`Failed to sync order ${order._id}:`, error);
        
        // Mark order for manual review if sync fails multiple times
        const retryCount = order._retry_count || 0;
        
        if (retryCount >= 3) {
          await this.markForManualReview(order);
        } else {
          // Increment retry count
          await ordersDB.put({
            ...order,
            _retry_count: retryCount + 1,
            _last_sync_attempt: new Date().toISOString()
          });
        }
      }
    }
  }
  
  async postOrderToServer(order: any): Promise<any> {
    const response = await fetch('https://api.restaurant.com/api/v1/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getAuthToken()}`
      },
      body: JSON.stringify({
        location_id: order.location_id,
        customer_id: order.customer_id,
        order_type: order.order_type,
        items: order.items,
        payment_status: order.payment_status,
        created_at: order.created_at,
        _offline_order: true,
        _original_order_id: order._id
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    
    return response.json();
  }
}
```

---

## 📊 Menu Sync (Server → POS)

### Pull Menu Updates

```typescript
class MenuSyncService {
  
  async syncMenu(): Promise<void> {
    if (!navigator.onLine) {
      console.log('Offline - using cached menu');
      return;
    }
    
    try {
      // Get last sync timestamp
      const lastSync = await this.getLastMenuSync();
      
      // Fetch menu updates
      const response = await fetch(
        `https://api.restaurant.com/api/v1/menu/sync?since=${lastSync}`,
        {
          headers: {
            'Authorization': `Bearer ${await this.getAuthToken()}`
          }
        }
      );
      
      const { categories, items, modifiers } = await response.json();
      
      // Update local menu database
      await this.updateLocalMenu(categories, items, modifiers);
      
      // Update last sync timestamp
      await this.setLastMenuSync(new Date().toISOString());
      
      console.log('Menu synced successfully');
      
    } catch (error) {
      console.error('Menu sync failed:', error);
      // Continue using cached menu
    }
  }
  
  async updateLocalMenu(categories: any[], items: any[], modifiers: any[]): Promise<void> {
    // Update categories
    for (const category of categories) {
      await menuDB.put({
        _id: `category_${category.category_id}`,
        ...category,
        type: 'category'
      });
    }
    
    // Update items
    for (const item of items) {
      await menuDB.put({
        _id: `item_${item.item_id}`,
        ...item,
        type: 'item'
      });
    }
    
    // Update modifiers
    for (const modifier of modifiers) {
      await menuDB.put({
        _id: `modifier_${modifier.modifier_id}`,
        ...modifier,
        type: 'modifier'
      });
    }
  }
  
  async getLocalMenu(): Promise<any> {
    const result = await menuDB.find({
      selector: {
        type: { $in: ['category', 'item', 'modifier'] }
      }
    });
    
    return this.organizeMenuData(result.docs);
  }
}

// Schedule menu sync every 60 seconds
setInterval(() => {
  menuSyncService.syncMenu();
}, 60 * 1000);
```

---

## 🔀 Conflict Resolution

### Handle Sync Conflicts

```typescript
class ConflictResolver {
  
  async resolveOrderConflict(localOrder: any, serverOrder: any): Promise<any> {
    // Strategy: Server always wins for critical fields
    
    const resolved = {
      ...serverOrder, // Start with server version
      _id: localOrder._id,
      _rev: localOrder._rev
    };
    
    // Preserve local updates that don't conflict
    if (localOrder.kitchen_notes && !serverOrder.kitchen_notes) {
      resolved.kitchen_notes = localOrder.kitchen_notes;
    }
    
    // Merge order status (take the most advanced status)
    const statusHierarchy = [
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'completed'
    ];
    
    const localStatusIndex = statusHierarchy.indexOf(localOrder.order_status);
    const serverStatusIndex = statusHierarchy.indexOf(serverOrder.order_status);
    
    resolved.order_status = localStatusIndex > serverStatusIndex
      ? localOrder.order_status
      : serverOrder.order_status;
    
    // Log conflict for audit
    await this.logConflict({
      entity_type: 'order',
      entity_id: localOrder.order_id,
      local_version: localOrder,
      server_version: serverOrder,
      resolved_version: resolved,
      resolved_at: new Date().toISOString()
    });
    
    return resolved;
  }
}
```

---

## 🚦 Online/Offline Detection

### Monitor Connection Status

```typescript
class ConnectionMonitor {
  private isOnline: boolean = navigator.onLine;
  private listeners: Array<(online: boolean) => void> = [];
  
  constructor() {
    window.addEventListener('online', () => {
      console.log('Connection restored');
      this.isOnline = true;
      this.notifyListeners(true);
      this.onConnectionRestored();
    });
    
    window.addEventListener('offline', () => {
      console.log('Connection lost');
      this.isOnline = false;
      this.notifyListeners(false);
      this.onConnectionLost();
    });
  }
  
  async onConnectionRestored(): Promise<void> {
    // Trigger sync of pending data
    await syncService.syncOfflineOrders();
    await syncService.syncOfflinePayments();
    
    // Pull latest updates
    await menuSyncService.syncMenu();
    
    // Show notification
    this.showNotification('Connection restored - syncing data...');
  }
  
  onConnectionLost(): void {
    // Show notification
    this.showNotification('Working offline - changes will sync when online');
  }
  
  subscribe(listener: (online: boolean) => void): void {
    this.listeners.push(listener);
  }
  
  private notifyListeners(online: boolean): void {
    for (const listener of this.listeners) {
      listener(online);
    }
  }
  
  getStatus(): boolean {
    return this.isOnline;
  }
}

// Global instance
export const connectionMonitor = new ConnectionMonitor();
```

---

## 📱 UI Indicators

### Sync Status Display

```typescript
class SyncStatusUI {
  
  renderSyncStatus(): void {
    const status = this.getSyncStatus();
    
    const indicators = {
      'synced': {
        icon: '✓',
        color: 'green',
        message: 'All changes synced'
      },
      'syncing': {
        icon: '⟳',
        color: 'blue',
        message: 'Syncing...'
      },
      'offline': {
        icon: '⚠',
        color: 'orange',
        message: 'Offline - changes will sync when online'
      },
      'error': {
        icon: '✗',
        color: 'red',
        message: 'Sync error - please check connection'
      }
    };
    
    const indicator = indicators[status];
    
    // Update UI
    document.getElementById('sync-status').innerHTML = `
      <span style="color: ${indicator.color}">
        ${indicator.icon} ${indicator.message}
      </span>
    `;
  }
  
  async getSyncStatus(): Promise<string> {
    if (!connectionMonitor.getStatus()) {
      return 'offline';
    }
    
    const unsyncedCount = await this.getUnsyncedCount();
    
    if (unsyncedCount > 0) {
      return 'syncing';
    }
    
    const lastError = await this.getLastSyncError();
    
    if (lastError) {
      return 'error';
    }
    
    return 'synced';
  }
  
  async getUnsyncedCount(): Promise<number> {
    const result = await ordersDB.find({
      selector: { _synced: false }
    });
    
    return result.docs.length;
  }
}
```

---

## 🔧 Data Pruning

### Clean Old Synced Data

```typescript
class DataPruningService {
  
  async pruneOldData(): Promise<void> {
    // Delete orders older than 30 days that are synced
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    
    const oldOrders = await ordersDB.find({
      selector: {
        _synced: true,
        created_at: { $lt: cutoffDate.toISOString() }
      }
    });
    
    console.log(`Pruning ${oldOrders.docs.length} old orders`);
    
    for (const order of oldOrders.docs) {
      await ordersDB.remove(order);
    }
    
    // Compact database
    await ordersDB.compact();
  }
}

// Run pruning weekly
setInterval(() => {
  dataPruningService.pruneOldData();
}, 7 * 24 * 60 * 60 * 1000);
```

---

## 📊 Sync Analytics

### Monitor Sync Performance

```typescript
interface SyncMetrics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  average_sync_time_ms: number;
  pending_items: number;
  last_successful_sync: string;
}

class SyncMetricsService {
  
  async getMetrics(): Promise<SyncMetrics> {
    const syncLogs = await this.getSyncLogs();
    
    return {
      total_syncs: syncLogs.length,
      successful_syncs: syncLogs.filter(l => l.success).length,
      failed_syncs: syncLogs.filter(l => !l.success).length,
      average_sync_time_ms: this.calculateAverageSyncTime(syncLogs),
      pending_items: await this.getPendingItemsCount(),
      last_successful_sync: this.getLastSuccessfulSync(syncLogs)
    };
  }
  
  async logSync(success: boolean, duration: number, itemsCount: number): Promise<void> {
    await ordersDB.put({
      _id: `_local/sync_log_${Date.now()}`,
      success,
      duration,
      items_count: itemsCount,
      timestamp: new Date().toISOString()
    });
  }
}
```

---

## 🔒 Security Considerations

1. **Encryption**: Sensitive data encrypted in local storage
2. **Authentication**: Sync requires valid JWT token
3. **Authorization**: Location-specific sync (can only sync own location)
4. **Conflict Logging**: All conflicts logged for audit

---

## 🚀 Best Practices

1. **Always Keep Local Copy**: Never delete local data until sync confirmed
2. **Periodic Sync**: Sync every 60 seconds when online
3. **User Feedback**: Show clear sync status indicators
4. **Error Recovery**: Automatic retry with exponential backoff
5. **Data Validation**: Validate data before sending to server
6. **Bandwidth Optimization**: Only sync changed data
7. **Background Sync**: Use service workers for background sync

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

