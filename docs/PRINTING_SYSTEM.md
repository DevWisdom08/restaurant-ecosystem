# Kitchen Printing System - Technical Documentation

## Overview

ESC/POS-based thermal printer integration for kitchen tickets, bar orders, and customer receipts.

---

## 🖨️ Printer Types

1. **Kitchen Printer** - Main kitchen orders (Entrees, Appetizers)
2. **Bar Printer** - Drinks and bar items
3. **Sushi Printer** - Sushi station orders
4. **Receipt Printer** - Customer receipts (POS)

---

## 📡 Printer Connection Methods

### 1. Network (TCP/IP) - Most Common

```typescript
import * as net from 'net';

const printer = net.connect({
  host: '192.168.1.100',
  port: 9100
});

printer.write(escposCommands);
printer.end();
```

### 2. USB Connection

```typescript
import * as usb from 'usb';

const device = usb.findByIds(vendorId, productId);
device.open();
const interface = device.interface(0);
interface.claim();
const endpoint = interface.endpoints[0];
endpoint.transfer(escposCommands);
```

### 3. Bluetooth

```typescript
import * as bluetooth from 'bluetooth-serial-port';

const btSerial = new bluetooth.BluetoothSerialPort();
btSerial.connect(address, channel, () => {
  btSerial.write(escposCommands);
});
```

---

## 🔧 ESC/POS Command Generation

### Basic Commands

```typescript
class ESCPOSPrinter {
  // Initialize printer
  static INIT = Buffer.from([0x1B, 0x40]);
  
  // Text formatting
  static BOLD_ON = Buffer.from([0x1B, 0x45, 0x01]);
  static BOLD_OFF = Buffer.from([0x1B, 0x45, 0x00]);
  static UNDERLINE_ON = Buffer.from([0x1B, 0x2D, 0x01]);
  static UNDERLINE_OFF = Buffer.from([0x1B, 0x2D, 0x00]);
  static DOUBLE_HEIGHT_ON = Buffer.from([0x1B, 0x21, 0x10]);
  static DOUBLE_WIDTH_ON = Buffer.from([0x1B, 0x21, 0x20]);
  static DOUBLE_SIZE_ON = Buffer.from([0x1B, 0x21, 0x30]);
  static NORMAL_SIZE = Buffer.from([0x1B, 0x21, 0x00]);
  
  // Alignment
  static ALIGN_LEFT = Buffer.from([0x1B, 0x61, 0x00]);
  static ALIGN_CENTER = Buffer.from([0x1B, 0x61, 0x01]);
  static ALIGN_RIGHT = Buffer.from([0x1B, 0x61, 0x02]);
  
  // Paper control
  static CUT_PAPER = Buffer.from([0x1D, 0x56, 0x00]);
  static FEED_LINE = Buffer.from([0x0A]);
  static FEED_LINES_3 = Buffer.from([0x1B, 0x64, 0x03]);
  
  // Cash drawer
  static OPEN_DRAWER = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]);
}
```

---

## 🎫 Kitchen Ticket Format

### Example Kitchen Ticket

```
========================================
           KITCHEN ORDER
========================================
Order: ORD-5001        Table: 12
Server: John D.        Time: 2:45 PM
========================================

[ 1x ] BURGER DELUXE               $15.99
       + No Onions
       + Extra Cheese
       + Well Done
       ** RUSH ORDER **

[ 2x ] CAESAR SALAD                $9.99
       + Add Chicken
       + Dressing on side

[ 1x ] FRENCH FRIES                $4.99
       + Extra Crispy

========================================
              TOTAL: $56.95
========================================
Customer Notes: Please rush, customer
is in a hurry

========================================
```

### Code to Generate Kitchen Ticket

```typescript
class KitchenPrinter {
  
  async printKitchenTicket(order: Order): Promise<void> {
    const commands: Buffer[] = [];
    
    // Initialize
    commands.push(ESCPOSPrinter.INIT);
    
    // Header
    commands.push(ESCPOSPrinter.ALIGN_CENTER);
    commands.push(ESCPOSPrinter.BOLD_ON);
    commands.push(ESCPOSPrinter.DOUBLE_SIZE_ON);
    commands.push(Buffer.from('KITCHEN ORDER\n'));
    commands.push(ESCPOSPrinter.NORMAL_SIZE);
    commands.push(ESCPOSPrinter.BOLD_OFF);
    
    // Separator
    commands.push(ESCPOSPrinter.ALIGN_LEFT);
    commands.push(Buffer.from('========================================\n'));
    
    // Order info
    commands.push(Buffer.from(`Order: ${order.order_number}`));
    commands.push(Buffer.from(`        Table: ${order.table_number || 'N/A'}\n`));
    commands.push(Buffer.from(`Server: ${order.server_name || 'Online'}`));
    commands.push(Buffer.from(`       Time: ${this.formatTime(order.created_at)}\n`));
    commands.push(Buffer.from('========================================\n\n'));
    
    // Items
    for (const item of order.items) {
      // Only print items that belong to this printer route
      if (item.printer_route === 'kitchen') {
        // Item name and quantity
        commands.push(ESCPOSPrinter.BOLD_ON);
        commands.push(Buffer.from(`[ ${item.quantity}x ] ${item.item_name.toUpperCase()}`));
        
        // Price (right-aligned)
        const price = `$${item.subtotal.toFixed(2)}`;
        const padding = ' '.repeat(40 - item.item_name.length - price.length - 8);
        commands.push(Buffer.from(`${padding}${price}\n`));
        commands.push(ESCPOSPrinter.BOLD_OFF);
        
        // Modifiers
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modifier of item.modifiers) {
            commands.push(Buffer.from(`       + ${modifier.modifier_name}\n`));
          }
        }
        
        // Special instructions
        if (item.special_instructions) {
          commands.push(ESCPOSPrinter.UNDERLINE_ON);
          commands.push(Buffer.from(`       ** ${item.special_instructions.toUpperCase()} **\n`));
          commands.push(ESCPOSPrinter.UNDERLINE_OFF);
        }
        
        commands.push(Buffer.from('\n'));
      }
    }
    
    // Footer
    commands.push(Buffer.from('========================================\n'));
    commands.push(ESCPOSPrinter.ALIGN_CENTER);
    commands.push(ESCPOSPrinter.DOUBLE_WIDTH_ON);
    commands.push(Buffer.from(`TOTAL: $${order.total_amount.toFixed(2)}\n`));
    commands.push(ESCPOSPrinter.NORMAL_SIZE);
    commands.push(Buffer.from('========================================\n'));
    
    // Customer notes
    if (order.customer_notes) {
      commands.push(ESCPOSPrinter.ALIGN_LEFT);
      commands.push(Buffer.from(`Customer Notes: ${order.customer_notes}\n`));
      commands.push(Buffer.from('========================================\n'));
    }
    
    // Feed and cut
    commands.push(ESCPOSPrinter.FEED_LINES_3);
    commands.push(ESCPOSPrinter.CUT_PAPER);
    
    // Send to printer
    const buffer = Buffer.concat(commands);
    await this.sendToPrinter(order.location_id, 'kitchen', buffer);
  }
  
  async sendToPrinter(locationId: number, printerType: string, data: Buffer): Promise<void> {
    // Get printer configuration
    const printer = await db.printers.findOne({
      where: {
        location_id: locationId,
        printer_type: printerType,
        is_active: true
      }
    });
    
    if (!printer) {
      throw new Error(`No active ${printerType} printer found for location ${locationId}`);
    }
    
    // Send via network
    if (printer.connection_type === 'network') {
      return this.sendToNetworkPrinter(printer.ip_address, printer.port, data);
    }
    
    // Send via USB
    if (printer.connection_type === 'usb') {
      return this.sendToUSBPrinter(printer.usb_vendor_id, printer.usb_product_id, data);
    }
  }
  
  async sendToNetworkPrinter(ip: string, port: number, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = net.connect({ host: ip, port }, () => {
        client.write(data);
        client.end();
      });
      
      client.on('end', () => {
        resolve();
      });
      
      client.on('error', (err) => {
        reject(new Error(`Printer connection failed: ${err.message}`));
      });
      
      // Timeout after 5 seconds
      client.setTimeout(5000, () => {
        client.destroy();
        reject(new Error('Printer connection timeout'));
      });
    });
  }
}
```

---

## 🧾 Customer Receipt Format

### Example Receipt

```
         RESTAURANT NAME
     123 Main St, New York, NY
          (555) 123-4567
     www.restaurantname.com

========================================
           CUSTOMER RECEIPT
========================================
Order: ORD-5001
Date: Dec 9, 2025         Time: 2:45 PM
Cashier: John Doe

----------------------------------------
1x Burger Deluxe               $15.99
   + No Onions
   + Extra Cheese
   + Well Done

2x Caesar Salad @ $9.99        $19.98
   + Add Chicken
   + Dressing on side

1x French Fries                 $4.99
   + Extra Crispy
----------------------------------------

Subtotal:                      $40.96
Tax (8.25%):                    $3.38
Delivery Fee:                   $3.99
Tip:                            $5.00
Discount (Loyalty):            -$5.00
----------------------------------------
TOTAL:                         $48.33

Payment Method: Visa ****1111
Transaction ID: 40037769123
Auth Code: ABC123

========================================
Loyalty Points Earned: 48
Current Balance: 1,298 points
========================================

     Thank you for your order!
        Visit again soon!

========================================
```

### Code to Generate Receipt

```typescript
class ReceiptPrinter {
  
  async printCustomerReceipt(order: Order, payment: Payment): Promise<void> {
    const commands: Buffer[] = [];
    
    // Initialize
    commands.push(ESCPOSPrinter.INIT);
    
    // Logo/Header
    commands.push(ESCPOSPrinter.ALIGN_CENTER);
    commands.push(ESCPOSPrinter.BOLD_ON);
    commands.push(ESCPOSPrinter.DOUBLE_SIZE_ON);
    commands.push(Buffer.from('RESTAURANT NAME\n'));
    commands.push(ESCPOSPrinter.NORMAL_SIZE);
    commands.push(Buffer.from('123 Main St, New York, NY\n'));
    commands.push(Buffer.from('(555) 123-4567\n'));
    commands.push(Buffer.from('www.restaurantname.com\n\n'));
    commands.push(ESCPOSPrinter.BOLD_OFF);
    
    // Receipt title
    commands.push(Buffer.from('========================================\n'));
    commands.push(ESCPOSPrinter.BOLD_ON);
    commands.push(Buffer.from('         CUSTOMER RECEIPT\n'));
    commands.push(ESCPOSPrinter.BOLD_OFF);
    commands.push(Buffer.from('========================================\n'));
    
    // Order details
    commands.push(ESCPOSPrinter.ALIGN_LEFT);
    commands.push(Buffer.from(`Order: ${order.order_number}\n`));
    commands.push(Buffer.from(`Date: ${this.formatDate(order.created_at)}`));
    commands.push(Buffer.from(`         Time: ${this.formatTime(order.created_at)}\n`));
    if (order.server_name) {
      commands.push(Buffer.from(`Cashier: ${order.server_name}\n`));
    }
    commands.push(Buffer.from('\n----------------------------------------\n'));
    
    // Line items
    for (const item of order.items) {
      const itemLine = `${item.quantity}x ${item.item_name}`;
      const price = `$${item.subtotal.toFixed(2)}`;
      const padding = ' '.repeat(40 - itemLine.length - price.length);
      commands.push(Buffer.from(`${itemLine}${padding}${price}\n`));
      
      // Modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          commands.push(Buffer.from(`   + ${modifier.modifier_name}\n`));
        }
      }
      
      commands.push(Buffer.from('\n'));
    }
    
    // Totals
    commands.push(Buffer.from('----------------------------------------\n'));
    commands.push(Buffer.from(this.formatAmountLine('Subtotal:', order.subtotal)));
    commands.push(Buffer.from(this.formatAmountLine('Tax (8.25%):', order.tax_amount)));
    
    if (order.delivery_fee > 0) {
      commands.push(Buffer.from(this.formatAmountLine('Delivery Fee:', order.delivery_fee)));
    }
    
    if (order.tip_amount > 0) {
      commands.push(Buffer.from(this.formatAmountLine('Tip:', order.tip_amount)));
    }
    
    if (order.discount_amount > 0) {
      commands.push(Buffer.from(this.formatAmountLine('Discount (Loyalty):', -order.discount_amount)));
    }
    
    commands.push(Buffer.from('----------------------------------------\n'));
    commands.push(ESCPOSPrinter.BOLD_ON);
    commands.push(ESCPOSPrinter.DOUBLE_HEIGHT_ON);
    commands.push(Buffer.from(this.formatAmountLine('TOTAL:', order.total_amount)));
    commands.push(ESCPOSPrinter.NORMAL_SIZE);
    commands.push(ESCPOSPrinter.BOLD_OFF);
    commands.push(Buffer.from('\n'));
    
    // Payment info
    if (payment) {
      commands.push(Buffer.from(`Payment Method: ${payment.card_brand} ****${payment.card_last_four}\n`));
      commands.push(Buffer.from(`Transaction ID: ${payment.transaction_id}\n`));
      commands.push(Buffer.from(`Auth Code: ${payment.authorization_code}\n\n`));
    }
    
    // Loyalty info
    if (order.loyalty_points_earned > 0) {
      commands.push(Buffer.from('========================================\n'));
      commands.push(Buffer.from(`Loyalty Points Earned: ${order.loyalty_points_earned}\n`));
      const balance = await loyaltyService.getBalance(order.customer_id);
      commands.push(Buffer.from(`Current Balance: ${balance.total_points} points\n`));
      commands.push(Buffer.from('========================================\n\n'));
    }
    
    // Footer
    commands.push(ESCPOSPrinter.ALIGN_CENTER);
    commands.push(Buffer.from('     Thank you for your order!\n'));
    commands.push(Buffer.from('        Visit again soon!\n\n'));
    commands.push(Buffer.from('========================================\n'));
    
    // QR Code for feedback (optional)
    // commands.push(this.generateQRCode('https://feedback.restaurant.com/' + order.order_number));
    
    // Feed and cut
    commands.push(ESCPOSPrinter.FEED_LINES_3);
    commands.push(ESCPOSPrinter.CUT_PAPER);
    
    // Send to printer
    const buffer = Buffer.concat(commands);
    await this.sendToPrinter(order.location_id, 'receipt', buffer);
  }
  
  formatAmountLine(label: string, amount: number): string {
    const amountStr = `$${Math.abs(amount).toFixed(2)}`;
    const sign = amount < 0 ? '-' : '';
    const padding = ' '.repeat(40 - label.length - amountStr.length - sign.length);
    return `${label}${padding}${sign}${amountStr}\n`;
  }
}
```

---

## 🔀 Printer Routing Logic

### Routing Strategy

Each menu item has a `printer_route` field that determines which printer(s) should receive the ticket.

```typescript
class PrinterRouter {
  
  async routeOrderToPrinters(order: Order): Promise<void> {
    // Group items by printer route
    const itemsByRoute = this.groupByPrinterRoute(order.items);
    
    // Print to each route
    const printPromises = [];
    
    for (const [route, items] of Object.entries(itemsByRoute)) {
      if (route === 'kitchen') {
        printPromises.push(
          kitchenPrinter.printKitchenTicket({
            ...order,
            items: items as OrderItem[]
          })
        );
      } else if (route === 'bar') {
        printPromises.push(
          barPrinter.printBarTicket({
            ...order,
            items: items as OrderItem[]
          })
        );
      } else if (route === 'sushi') {
        printPromises.push(
          sushiPrinter.printSushiTicket({
            ...order,
            items: items as OrderItem[]
          })
        );
      }
    }
    
    // Wait for all prints to complete
    try {
      await Promise.all(printPromises);
      
      // Mark items as printed
      await this.markItemsAsPrinted(order.order_id);
      
    } catch (error) {
      // Log printer error but don't fail the order
      console.error('Printer error:', error);
      await this.logPrinterError(order.order_id, error);
      
      // Optionally: Send notification to staff
      await notificationService.notifyPrinterError(order.location_id, error.message);
    }
  }
  
  groupByPrinterRoute(items: OrderItem[]): Record<string, OrderItem[]> {
    return items.reduce((grouped, item) => {
      const route = item.printer_route || 'kitchen';
      if (!grouped[route]) {
        grouped[route] = [];
      }
      grouped[route].push(item);
      return grouped;
    }, {} as Record<string, OrderItem[]>);
  }
  
  async markItemsAsPrinted(orderId: number): Promise<void> {
    await db.orderItems.update(
      { is_printed: true, printed_at: new Date() },
      { where: { order_id: orderId } }
    );
  }
}
```

---

## 🚨 Error Handling

### Printer Offline Detection

```typescript
async function testPrinterConnection(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const client = net.connect({ host: ip, port }, () => {
      client.destroy();
      resolve(true);
    });
    
    client.on('error', () => {
      resolve(false);
    });
    
    client.setTimeout(3000, () => {
      client.destroy();
      resolve(false);
    });
  });
}

// Scheduled health check (every 5 minutes)
setInterval(async () => {
  const printers = await db.printers.findAll({ where: { is_active: true } });
  
  for (const printer of printers) {
    const isOnline = await testPrinterConnection(printer.ip_address, printer.port);
    
    if (!isOnline) {
      // Alert staff
      await notificationService.notifyPrinterOffline(printer.location_id, printer.printer_name);
      
      // Update status
      await db.printers.update(
        { is_online: false, last_error: 'Connection timeout' },
        { where: { printer_id: printer.printer_id } }
      );
    } else {
      await db.printers.update(
        { is_online: true, last_error: null },
        { where: { printer_id: printer.printer_id } }
      );
    }
  }
}, 5 * 60 * 1000);
```

### Retry Logic

```typescript
async function printWithRetry(order: Order, maxRetries = 3): Promise<void> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      await printerRouter.routeOrderToPrinters(order);
      return; // Success
    } catch (error) {
      attempt++;
      
      if (attempt >= maxRetries) {
        // Failed after all retries
        await this.logPrintFailure(order.order_id, error);
        await this.notifyPrintFailure(order);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

---

## 📱 Admin Portal Printer Management

### Printer Configuration UI

```typescript
// GET /api/v1/admin/printers
{
  "printers": [
    {
      "printer_id": 1,
      "location_id": 1,
      "printer_name": "Kitchen Printer 1",
      "printer_type": "kitchen",
      "ip_address": "192.168.1.100",
      "port": 9100,
      "connection_type": "network",
      "printer_model": "epson_tm_t88",
      "is_active": true,
      "is_online": true,
      "last_print_at": "2025-12-09T14:45:00Z"
    }
  ]
}

// POST /api/v1/admin/printers/test
{
  "printer_id": 1
}
// Sends test print to verify connection
```

---

## 🔧 Supported Printer Models

### Epson

- TM-T88VI
- TM-T88V
- TM-T20III
- TM-M30

### Star Micronics

- TSP143IIIW
- TSP650II
- TSP700II

### Generic ESC/POS

Most thermal printers support ESC/POS commands

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

