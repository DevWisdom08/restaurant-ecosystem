# Database Schema - Restaurant Ecosystem

## Overview

Complete SQL Server database schema for the Restaurant Ecosystem POS system.

---

## 📊 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │──────<│   orders    │>──────│ order_items │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     │                      │
       │                     │                      │
       ▼                     ▼                      ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  locations  │       │  payments   │       │  modifiers  │
└─────────────┘       └─────────────┘       └─────────────┘
       │                     
       │                     
       ▼                     
┌─────────────┐       
│  categories │       
└─────────────┘       
       │
       ▼
┌─────────────┐
│    items    │
└─────────────┘
```

---

## 🗂️ Core Tables

### 1. users

Stores all user accounts (customers, staff, managers, drivers).

```sql
CREATE TABLE users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) UNIQUE NOT NULL,
    phone NVARCHAR(20) UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    role NVARCHAR(20) NOT NULL, -- 'customer', 'staff', 'manager', 'admin', 'driver'
    status NVARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
    email_verified BIT DEFAULT 0,
    phone_verified BIT DEFAULT 0,
    profile_image_url NVARCHAR(500),
    fcm_token NVARCHAR(500), -- For push notifications
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    last_login_at DATETIME2,
    deleted_at DATETIME2 NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
```

### 2. locations

Multi-location support for restaurant chains.

```sql
CREATE TABLE locations (
    location_id INT IDENTITY(1,1) PRIMARY KEY,
    location_name NVARCHAR(200) NOT NULL,
    address_line1 NVARCHAR(255) NOT NULL,
    address_line2 NVARCHAR(255),
    city NVARCHAR(100) NOT NULL,
    state NVARCHAR(50) NOT NULL,
    zip_code NVARCHAR(20) NOT NULL,
    country NVARCHAR(50) DEFAULT 'USA',
    phone NVARCHAR(20) NOT NULL,
    email NVARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone NVARCHAR(50) DEFAULT 'America/New_York',
    is_active BIT DEFAULT 1,
    accepts_pickup BIT DEFAULT 1,
    accepts_delivery BIT DEFAULT 1,
    accepts_dinein BIT DEFAULT 1,
    delivery_radius_miles DECIMAL(5, 2) DEFAULT 5.0,
    tax_rate DECIMAL(5, 4) DEFAULT 0.0825, -- 8.25%
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);
```

### 3. categories

Menu categories (Appetizers, Entrees, Desserts, etc.).

```sql
CREATE TABLE categories (
    category_id INT IDENTITY(1,1) PRIMARY KEY,
    location_id INT NULL, -- NULL = available at all locations
    category_name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    display_order INT DEFAULT 0,
    image_url NVARCHAR(500),
    is_active BIT DEFAULT 1,
    printer_route NVARCHAR(50), -- 'kitchen', 'bar', 'sushi', etc.
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE INDEX idx_categories_location ON categories(location_id);
CREATE INDEX idx_categories_active ON categories(is_active);
```

### 4. items

Menu items (food and beverages).

```sql
CREATE TABLE items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    category_id INT NOT NULL,
    location_id INT NULL, -- NULL = available at all locations
    item_name NVARCHAR(200) NOT NULL,
    description NVARCHAR(1000),
    base_price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2), -- For profit calculations
    sku NVARCHAR(50),
    image_url NVARCHAR(500),
    calories INT,
    is_active BIT DEFAULT 1,
    is_featured BIT DEFAULT 0,
    printer_route NVARCHAR(50), -- 'kitchen', 'bar', 'sushi'
    preparation_time_minutes INT DEFAULT 15,
    display_order INT DEFAULT 0,
    dietary_flags NVARCHAR(200), -- 'vegetarian,gluten-free,vegan'
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);

CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_active ON items(is_active);
CREATE INDEX idx_items_location ON items(location_id);
```

### 5. modifier_groups

Groups of modifiers (Size, Temperature, Toppings, etc.).

```sql
CREATE TABLE modifier_groups (
    modifier_group_id INT IDENTITY(1,1) PRIMARY KEY,
    group_name NVARCHAR(100) NOT NULL,
    selection_type NVARCHAR(20) NOT NULL, -- 'single', 'multiple'
    min_selections INT DEFAULT 0,
    max_selections INT DEFAULT 1,
    is_required BIT DEFAULT 0,
    display_order INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);
```

### 6. modifiers

Individual modifiers within groups.

```sql
CREATE TABLE modifiers (
    modifier_id INT IDENTITY(1,1) PRIMARY KEY,
    modifier_group_id INT NOT NULL,
    modifier_name NVARCHAR(100) NOT NULL,
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
    is_default BIT DEFAULT 0,
    is_active BIT DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(modifier_group_id)
);

CREATE INDEX idx_modifiers_group ON modifiers(modifier_group_id);
```

### 7. item_modifier_groups

Links items to their available modifier groups.

```sql
CREATE TABLE item_modifier_groups (
    item_modifier_group_id INT IDENTITY(1,1) PRIMARY KEY,
    item_id INT NOT NULL,
    modifier_group_id INT NOT NULL,
    display_order INT DEFAULT 0,
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    FOREIGN KEY (modifier_group_id) REFERENCES modifier_groups(modifier_group_id)
);

CREATE INDEX idx_item_modifiers_item ON item_modifier_groups(item_id);
```

---

## 📦 Order Tables

### 8. orders

Main order table.

```sql
CREATE TABLE orders (
    order_id INT IDENTITY(1,1) PRIMARY KEY,
    order_number NVARCHAR(20) UNIQUE NOT NULL, -- Display number (e.g., 'ORD-1001')
    location_id INT NOT NULL,
    customer_id INT NOT NULL,
    order_type NVARCHAR(20) NOT NULL, -- 'pickup', 'delivery', 'dinein', 'takeout'
    order_status NVARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    tip_amount DECIMAL(10, 2) DEFAULT 0.00,
    delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_status NVARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'refunded', 'failed'
    payment_method NVARCHAR(50), -- 'credit_card', 'cash', 'terminal'
    
    -- Delivery details
    delivery_address_line1 NVARCHAR(255),
    delivery_address_line2 NVARCHAR(255),
    delivery_city NVARCHAR(100),
    delivery_state NVARCHAR(50),
    delivery_zip NVARCHAR(20),
    delivery_instructions NVARCHAR(500),
    driver_id INT NULL,
    
    -- Dine-in details
    table_number NVARCHAR(20),
    server_id INT NULL,
    
    -- Pickup details
    scheduled_pickup_time DATETIME2,
    
    -- Loyalty
    loyalty_points_earned INT DEFAULT 0,
    loyalty_points_redeemed INT DEFAULT 0,
    
    customer_notes NVARCHAR(1000),
    kitchen_notes NVARCHAR(1000),
    
    estimated_ready_time DATETIME2,
    actual_ready_time DATETIME2,
    completed_at DATETIME2,
    cancelled_at DATETIME2,
    cancellation_reason NVARCHAR(500),
    
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (driver_id) REFERENCES users(user_id),
    FOREIGN KEY (server_id) REFERENCES users(user_id)
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_location ON orders(location_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_date ON orders(created_at);
CREATE INDEX idx_orders_number ON orders(order_number);
```

### 9. order_items

Line items within an order.

```sql
CREATE TABLE order_items (
    order_item_id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    item_name NVARCHAR(200) NOT NULL, -- Snapshot at order time
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    special_instructions NVARCHAR(500),
    printer_route NVARCHAR(50),
    is_printed BIT DEFAULT 0,
    printed_at DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### 10. order_item_modifiers

Modifiers applied to order items.

```sql
CREATE TABLE order_item_modifiers (
    order_item_modifier_id INT IDENTITY(1,1) PRIMARY KEY,
    order_item_id INT NOT NULL,
    modifier_id INT NOT NULL,
    modifier_name NVARCHAR(100) NOT NULL, -- Snapshot
    price_adjustment DECIMAL(10, 2) NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id),
    FOREIGN KEY (modifier_id) REFERENCES modifiers(modifier_id)
);

CREATE INDEX idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);
```

---

## 💳 Payment Tables

### 11. payments

Payment records for orders.

```sql
CREATE TABLE payments (
    payment_id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method NVARCHAR(50) NOT NULL, -- 'credit_card', 'debit_card', 'cash', 'terminal'
    amount DECIMAL(10, 2) NOT NULL,
    payment_status NVARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'
    transaction_id NVARCHAR(100), -- From payment gateway
    authorization_code NVARCHAR(50),
    card_last_four NVARCHAR(4),
    card_brand NVARCHAR(20), -- 'Visa', 'Mastercard', 'Amex'
    payment_token NVARCHAR(255), -- Tokenized card
    gateway NVARCHAR(50) DEFAULT 'authorize_net', -- 'authorize_net', 'clover', 'ingenico'
    gateway_response TEXT,
    processed_at DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_transaction ON payments(transaction_id);
```

### 12. payment_refunds

Refund records.

```sql
CREATE TABLE payment_refunds (
    refund_id INT IDENTITY(1,1) PRIMARY KEY,
    payment_id INT NOT NULL,
    order_id INT NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    refund_reason NVARCHAR(500),
    refund_status NVARCHAR(20) NOT NULL, -- 'pending', 'completed', 'failed'
    transaction_id NVARCHAR(100),
    processed_by_user_id INT,
    processed_at DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (payment_id) REFERENCES payments(payment_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (processed_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_refunds_payment ON payment_refunds(payment_id);
CREATE INDEX idx_refunds_order ON payment_refunds(order_id);
```

---

## 🎁 Loyalty Tables

### 13. loyalty_rules

Configurable loyalty rules.

```sql
CREATE TABLE loyalty_rules (
    loyalty_rule_id INT IDENTITY(1,1) PRIMARY KEY,
    rule_name NVARCHAR(100) NOT NULL,
    rule_type NVARCHAR(50) NOT NULL, -- 'earn_percentage', 'earn_fixed', 'redeem_discount', 'redeem_item'
    location_id INT NULL, -- NULL = applies to all locations
    points_per_dollar DECIMAL(5, 2), -- For earn_percentage
    fixed_points INT, -- For earn_fixed
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0.00,
    redemption_value DECIMAL(10, 2), -- Dollar value per point when redeeming
    is_active BIT DEFAULT 1,
    start_date DATETIME2,
    end_date DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);
```

### 14. loyalty_transactions

Loyalty point transactions.

```sql
CREATE TABLE loyalty_transactions (
    loyalty_transaction_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL,
    order_id INT NULL,
    transaction_type NVARCHAR(20) NOT NULL, -- 'earn', 'redeem', 'adjustment', 'expire'
    points_amount INT NOT NULL, -- Positive for earn, negative for redeem
    balance_after INT NOT NULL,
    description NVARCHAR(500),
    expiration_date DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (customer_id) REFERENCES users(user_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

CREATE INDEX idx_loyalty_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_loyalty_order ON loyalty_transactions(order_id);
```

### 15. customer_loyalty_balances

Current loyalty balance per customer.

```sql
CREATE TABLE customer_loyalty_balances (
    balance_id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT UNIQUE NOT NULL,
    total_points INT DEFAULT 0,
    lifetime_points_earned INT DEFAULT 0,
    lifetime_points_redeemed INT DEFAULT 0,
    tier_level NVARCHAR(50) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (customer_id) REFERENCES users(user_id)
);

CREATE INDEX idx_loyalty_balance_customer ON customer_loyalty_balances(customer_id);
```

---

## 🚚 Delivery Tables

### 16. delivery_assignments

Tracks delivery assignments to drivers.

```sql
CREATE TABLE delivery_assignments (
    assignment_id INT IDENTITY(1,1) PRIMARY KEY,
    order_id INT NOT NULL,
    driver_id INT NOT NULL,
    assignment_status NVARCHAR(20) DEFAULT 'assigned', -- 'assigned', 'accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled'
    assigned_at DATETIME2 DEFAULT GETUTCDATE(),
    accepted_at DATETIME2,
    picked_up_at DATETIME2,
    delivered_at DATETIME2,
    cancelled_at DATETIME2,
    driver_notes NVARCHAR(500),
    estimated_delivery_time DATETIME2,
    actual_delivery_time DATETIME2,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (driver_id) REFERENCES users(user_id)
);

CREATE INDEX idx_delivery_order ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_driver ON delivery_assignments(driver_id);
CREATE INDEX idx_delivery_status ON delivery_assignments(assignment_status);
```

---

## 📦 Inventory Tables

### 17. inventory

Stock levels per location.

```sql
CREATE TABLE inventory (
    inventory_id INT IDENTITY(1,1) PRIMARY KEY,
    location_id INT NOT NULL,
    item_id INT NOT NULL,
    current_stock INT DEFAULT 0,
    min_stock_level INT DEFAULT 0, -- Trigger for purchase orders
    max_stock_level INT DEFAULT 0,
    unit_of_measure NVARCHAR(20) DEFAULT 'unit', -- 'unit', 'lb', 'kg', 'oz'
    last_restocked_at DATETIME2,
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (item_id) REFERENCES items(item_id),
    UNIQUE (location_id, item_id)
);

CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inventory_item ON inventory(item_id);
```

### 18. stock_movements

Audit trail for inventory changes.

```sql
CREATE TABLE stock_movements (
    movement_id INT IDENTITY(1,1) PRIMARY KEY,
    inventory_id INT NOT NULL,
    movement_type NVARCHAR(20) NOT NULL, -- 'restock', 'sale', 'waste', 'adjustment'
    quantity_change INT NOT NULL, -- Positive or negative
    balance_after INT NOT NULL,
    order_id INT NULL, -- If related to a sale
    performed_by_user_id INT,
    notes NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (inventory_id) REFERENCES inventory(inventory_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (performed_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_stock_movements_inventory ON stock_movements(inventory_id);
```

### 19. purchase_orders

Auto-generated purchase orders when stock is low.

```sql
CREATE TABLE purchase_orders (
    purchase_order_id INT IDENTITY(1,1) PRIMARY KEY,
    po_number NVARCHAR(50) UNIQUE NOT NULL,
    location_id INT NOT NULL,
    supplier_name NVARCHAR(200),
    supplier_contact NVARCHAR(500),
    status NVARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'received', 'cancelled'
    total_amount DECIMAL(10, 2),
    expected_delivery_date DATETIME2,
    created_by_user_id INT,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);
```

### 20. purchase_order_items

Items in a purchase order.

```sql
CREATE TABLE purchase_order_items (
    po_item_id INT IDENTITY(1,1) PRIMARY KEY,
    purchase_order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(purchase_order_id),
    FOREIGN KEY (item_id) REFERENCES items(item_id)
);
```

---

## 🔔 Notification Tables

### 21. push_notifications

Sent push notifications log.

```sql
CREATE TABLE push_notifications (
    notification_id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    message NVARCHAR(1000) NOT NULL,
    notification_type NVARCHAR(50), -- 'order_status', 'promotion', 'loyalty', 'general'
    target_user_id INT NULL, -- NULL = broadcast to all
    target_role NVARCHAR(20), -- 'customer', 'driver', 'staff'
    location_id INT NULL,
    order_id INT NULL,
    image_url NVARCHAR(500),
    action_url NVARCHAR(500),
    is_sent BIT DEFAULT 0,
    sent_at DATETIME2,
    scheduled_for DATETIME2,
    created_by_user_id INT,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (target_user_id) REFERENCES users(user_id),
    FOREIGN KEY (location_id) REFERENCES locations(location_id),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
);

CREATE INDEX idx_notifications_user ON push_notifications(target_user_id);
CREATE INDEX idx_notifications_sent ON push_notifications(is_sent);
```

---

## 🖨️ Printer Configuration Tables

### 22. printers

Physical printer configuration.

```sql
CREATE TABLE printers (
    printer_id INT IDENTITY(1,1) PRIMARY KEY,
    location_id INT NOT NULL,
    printer_name NVARCHAR(100) NOT NULL,
    printer_type NVARCHAR(50) NOT NULL, -- 'kitchen', 'receipt', 'bar', 'sushi'
    ip_address NVARCHAR(50),
    port INT DEFAULT 9100,
    connection_type NVARCHAR(20) DEFAULT 'network', -- 'network', 'usb', 'bluetooth'
    printer_model NVARCHAR(50), -- 'epson_tm_t88', 'star_tsp100'
    paper_width_mm INT DEFAULT 80, -- 58mm or 80mm
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (location_id) REFERENCES locations(location_id)
);
```

---

## 📊 Summary Statistics

**Total Tables:** 22  
**Total Indexes:** 35+  
**Foreign Key Relationships:** 28  

---

## 🔧 Maintenance Views

### Active Orders View

```sql
CREATE VIEW vw_active_orders AS
SELECT 
    o.order_id,
    o.order_number,
    o.order_type,
    o.order_status,
    o.total_amount,
    u.first_name + ' ' + u.last_name AS customer_name,
    u.phone AS customer_phone,
    l.location_name,
    o.created_at
FROM orders o
JOIN users u ON o.customer_id = u.user_id
JOIN locations l ON o.location_id = l.location_id
WHERE o.order_status IN ('pending', 'confirmed', 'preparing', 'ready')
    AND o.deleted_at IS NULL;
```

### Customer Loyalty Summary View

```sql
CREATE VIEW vw_customer_loyalty AS
SELECT 
    u.user_id,
    u.first_name + ' ' + u.last_name AS customer_name,
    u.email,
    clb.total_points,
    clb.lifetime_points_earned,
    clb.tier_level,
    COUNT(o.order_id) AS total_orders,
    SUM(o.total_amount) AS total_spent
FROM users u
LEFT JOIN customer_loyalty_balances clb ON u.user_id = clb.customer_id
LEFT JOIN orders o ON u.user_id = o.customer_id AND o.payment_status = 'paid'
WHERE u.role = 'customer'
GROUP BY u.user_id, u.first_name, u.last_name, u.email, 
         clb.total_points, clb.lifetime_points_earned, clb.tier_level;
```

---

## 🔒 Security Considerations

1. **Sensitive Data**: All passwords stored as bcrypt hashes (never plain text)
2. **Payment Tokens**: Card data tokenized via Authorize.Net (never stored raw)
3. **Audit Trail**: All tables include `created_at` and `updated_at` timestamps
4. **Soft Deletes**: Critical tables use `deleted_at` instead of hard deletes
5. **Row-Level Security**: Implement based on user roles and location assignments

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

