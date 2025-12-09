# System Architecture - Restaurant Ecosystem

## Overview

This document describes the complete architecture of the Restaurant Ecosystem including POS, Mobile Apps, Web Ordering, Admin Portal, and Delivery System.

---

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Mobile App   │ Web Ordering │ Admin Portal │  Delivery App      │
│ (React       │ (Next.js)    │ (Next.js)    │  (React Native)   │
│  Native)     │              │              │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬──────────┘
       │              │              │                 │
       └──────────────┴──────────────┴─────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   API GATEWAY      │
                    │   (Node.js/TS)     │
                    │   Port: 3000       │
                    └─────────┬──────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
┌──────▼──────┐      ┌────────▼────────┐   ┌────────▼────────┐
│   SERVICE   │      │    SERVICE      │   │    SERVICE      │
│   LAYER     │      │    LAYER        │   │    LAYER        │
├─────────────┤      ├─────────────────┤   ├─────────────────┤
│ • Auth      │      │ • Orders        │   │ • Payments      │
│ • Users     │      │ • Menu          │   │ • Loyalty       │
│ • Locations │      │ • Modifiers     │   │ • Inventory     │
└──────┬──────┘      └────────┬────────┘   └────────┬────────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  DATA ACCESS LAYER  │
                    └─────────┬──────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
┌──────▼──────┐      ┌────────▼────────┐   ┌────────▼────────┐
│ SQL Server  │      │  Redis Cache    │   │  File Storage   │
│ (Primary DB)│      │  (Sessions)     │   │  (Images)       │
└─────────────┘      └─────────────────┘   └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                         │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Authorize.Net│ Clover SDK   │ Ingenico SDK │  Push             │
│ (Payments)   │ (Terminal)   │ (Terminal)   │  Notifications    │
└──────────────┴──────────────┴──────────────┴───────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    HARDWARE LAYER                                │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Kitchen      │ Receipt      │ EMV          │  Cash             │
│ Printer      │ Printer      │ Terminal     │  Drawer           │
│ (Epson/Star) │ (Thermal)    │ (Clover)     │                   │
└──────────────┴──────────────┴──────────────┴───────────────────┘
```

---

## 🔄 Data Flow Patterns

### Order Flow (Customer → Kitchen)

```
1. Customer (Mobile/Web)
   ↓
2. Order Created → API Gateway
   ↓
3. Payment Processing (Authorize.Net)
   ↓
4. Order Stored in DB
   ↓
5. Kitchen Ticket Generated
   ↓
6. Printer Routing (Kitchen/Bar/Sushi)
   ↓
7. Push Notification (Order Confirmed)
   ↓
8. Real-time Status Updates
```

### Menu Sync Pattern

```
Admin Portal → Menu Update
   ↓
API Layer → Database Write
   ↓
Invalidate Cache
   ↓
Notify All Clients (WebSocket)
   ↓
Mobile App, Website, POS Refresh Menu
```

### Loyalty Transaction Pattern

```
Order Placed → Calculate Points
   ↓
Write to loyalty_transactions table
   ↓
Update customer_loyalty_balance
   ↓
Sync to POS loyalty tables
   ↓
Push notification (Points Earned)
```

---

## 🗂️ Module Architecture

### Authentication Module
- JWT-based authentication
- Role-based access control (Customer, Staff, Manager, Admin, Driver)
- OTP verification for mobile registration
- Session management with Redis
- Token refresh mechanism

### Order Management Module
- Order creation and validation
- Modifier and sub-modifier handling
- Order status workflow (Pending → Preparing → Ready → Completed)
- Order assignment to delivery drivers
- Order history and reordering

### Payment Module
- Authorize.Net tokenization
- Credit/debit card processing
- Transaction logging
- Refund processing
- Terminal SDK integration (Clover, Ingenico)

### Loyalty Module
- Points calculation engine
- Rule-based rewards (percentage, fixed, threshold)
- Transaction history
- Redemption logic
- Multi-tier loyalty levels

### Menu Management Module
- Category management
- Item management with pricing
- Modifier groups and sub-modifiers
- Availability toggle
- Multi-location pricing

### Kitchen Printing Module
- ESC/POS command generation
- Printer routing by item category
- Order ticket formatting
- Receipt printing
- Printer status monitoring

### Offline Sync Module
- Local storage (PouchDB)
- Conflict resolution
- Background sync queue
- Sync status indicators
- Retry mechanism

### Delivery Module
- Driver assignment algorithm
- Route optimization
- Status updates (Assigned → Picked Up → Delivered)
- Driver location tracking
- Delivery history

### Inventory Module
- Stock tracking
- Deduction on order
- Low stock alerts
- Purchase order generation (auto-trigger)
- Multi-location inventory

### Notification Module
- Push notification service (Firebase)
- Promotional broadcasts
- Order status notifications
- Loyalty rewards notifications
- Scheduled campaigns

---

## 🔐 Security Architecture

### Authentication & Authorization
- JWT tokens (access + refresh)
- Password hashing (bcrypt)
- Role-based permissions
- API rate limiting
- CORS configuration

### Payment Security
- PCI DSS compliance (tokenization)
- No card data storage
- TLS/SSL encryption
- Secure environment variables
- Transaction logging

### Data Protection
- SQL injection prevention (parameterized queries)
- Input validation and sanitization
- XSS protection
- CSRF tokens
- Encrypted sensitive fields

---

## 📡 API Gateway Structure

### Base URL
```
Production: https://api.restaurantname.com
Development: http://localhost:3000
```

### Route Structure
```
/api/v1/auth/*           - Authentication endpoints
/api/v1/menu/*           - Menu and items
/api/v1/orders/*         - Order management
/api/v1/payments/*       - Payment processing
/api/v1/loyalty/*        - Loyalty system
/api/v1/customers/*      - Customer management
/api/v1/admin/*          - Admin operations
/api/v1/delivery/*       - Delivery operations
/api/v1/notifications/*  - Push notifications
/api/v1/inventory/*      - Inventory management
/api/v1/reports/*        - Reporting
```

---

## 🗄️ Database Architecture

### Primary Database: SQL Server

**Key Design Principles:**
- Normalized structure (3NF)
- Foreign key constraints
- Indexed for performance
- Audit trail columns (created_at, updated_at)
- Soft deletes where applicable

**Main Table Groups:**
1. **Core Tables**: users, locations, roles
2. **Menu Tables**: categories, items, modifiers, modifier_groups
3. **Order Tables**: orders, order_items, order_modifiers
4. **Payment Tables**: payments, payment_transactions, refunds
5. **Loyalty Tables**: loyalty_rules, loyalty_transactions, loyalty_balances
6. **Inventory Tables**: inventory, stock_movements, purchase_orders
7. **Delivery Tables**: delivery_assignments, delivery_history

### Caching Layer: Redis

**Cached Data:**
- Active sessions
- Menu data (TTL: 5 minutes)
- Location settings
- Loyalty rules
- Frequently accessed customer data

---

## 🚀 Deployment Architecture

### Development Environment
- Local Node.js server
- Local SQL Server instance
- Sandbox payment gateways

### Staging Environment
- Docker containers
- Staging database
- Test payment credentials

### Production Environment
- Load-balanced API servers
- Production SQL Server (clustered)
- Redis cluster
- CDN for static assets
- Automated backups
- Monitoring and logging

---

## 📊 Performance Considerations

### API Response Times
- Average response: < 200ms
- Database queries: < 50ms
- Payment processing: < 2s
- Menu load: < 100ms (cached)

### Scalability
- Horizontal scaling for API layer
- Database connection pooling
- Read replicas for reporting
- CDN for images and assets
- Queue system for background jobs

### Monitoring
- Application performance monitoring
- Error tracking and logging
- Database query monitoring
- Payment transaction logging
- API usage analytics

---

## 🔄 Sync Strategy

### Real-time Sync (WebSocket)
- Order status updates
- Delivery status updates
- Kitchen display updates
- Inventory availability

### Polling Sync (REST API)
- Menu updates (every 60 seconds)
- Location settings (every 5 minutes)
- Loyalty rules (every 10 minutes)

### Offline Sync (PouchDB → CouchDB)
- POS orders when offline
- Sync on reconnection
- Conflict resolution strategy
- Sync status indicators

---

## 📱 Client Application Architecture

### Mobile App (React Native)
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation
- **API Client**: Axios with interceptors
- **Local Storage**: AsyncStorage
- **Push Notifications**: Firebase Cloud Messaging
- **Maps**: React Native Maps
- **Payments**: Native SDKs (Stripe/Authorize.Net)

### Web Ordering (Next.js)
- **Rendering**: Server-side + Static generation
- **State Management**: Redux Toolkit
- **API Client**: Axios
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form
- **Validation**: Zod

### Admin Portal (Next.js)
- **Authentication**: NextAuth.js
- **Charts**: Recharts
- **Tables**: TanStack Table
- **Forms**: React Hook Form
- **File Upload**: React Dropzone

### POS System (Electron + React)
- **Framework**: Electron
- **UI**: React + Tailwind
- **Printing**: node-thermal-printer
- **Offline Storage**: PouchDB
- **Hardware Integration**: Node.js native modules

---

## 🎯 Technology Stack Summary

**Backend:**
- Node.js v18+
- TypeScript 5+
- Express.js
- SQL Server
- Redis
- WebSocket (Socket.io)

**Frontend:**
- React Native (Mobile)
- Next.js 14 (Web)
- TypeScript
- Tailwind CSS
- Redux Toolkit

**DevOps:**
- Docker
- GitHub Actions
- Nginx
- PM2

**External Services:**
- Authorize.Net (Payments)
- Clover SDK (Terminal)
- Firebase (Push Notifications)
- SendGrid (Email)

---

## 📝 Notes

- All timestamps in UTC
- All monetary values stored as integers (cents)
- Multi-currency support (future enhancement)
- Multi-language support (future enhancement)
- GDPR compliance considerations included

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

