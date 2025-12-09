# API Documentation - Restaurant Ecosystem

## Base URL

```
Development: http://localhost:3000/api/v1
Production: https://api.restaurantname.com/api/v1
```

---

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

---

## 🔐 Authentication Endpoints

### POST /auth/register

Register a new customer account.

**Request Body:**
```json
{
  "email": "customer@example.com",
  "phone": "+1234567890",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user_id": 123,
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /auth/login

Login with email and password.

**Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "email": "customer@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "customer",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /auth/refresh-token

Refresh expired access token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### POST /auth/send-otp

Send OTP for phone verification.

**Request Body:**
```json
{
  "phone": "+1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

### POST /auth/verify-otp

Verify OTP code.

**Request Body:**
```json
{
  "phone": "+1234567890",
  "otp_code": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Phone verified successfully"
}
```

---

## 🍔 Menu Endpoints

### GET /menu/locations

Get all active locations.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "location_id": 1,
      "location_name": "Downtown Branch",
      "address_line1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip_code": "10001",
      "phone": "+1234567890",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "accepts_pickup": true,
      "accepts_delivery": true,
      "accepts_dinein": true,
      "delivery_radius_miles": 5.0
    }
  ]
}
```

### GET /menu/categories

Get all categories with items.

**Query Parameters:**
- `location_id` (optional): Filter by location

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "category_id": 1,
      "category_name": "Appetizers",
      "description": "Start your meal right",
      "image_url": "https://...",
      "display_order": 1,
      "items": [
        {
          "item_id": 101,
          "item_name": "Buffalo Wings",
          "description": "Spicy chicken wings with ranch",
          "base_price": 12.99,
          "image_url": "https://...",
          "calories": 850,
          "is_featured": true,
          "dietary_flags": ["gluten-free"],
          "modifier_groups": [
            {
              "modifier_group_id": 1,
              "group_name": "Spice Level",
              "selection_type": "single",
              "is_required": true,
              "modifiers": [
                {
                  "modifier_id": 1,
                  "modifier_name": "Mild",
                  "price_adjustment": 0.00,
                  "is_default": true
                },
                {
                  "modifier_id": 2,
                  "modifier_name": "Hot",
                  "price_adjustment": 0.00
                },
                {
                  "modifier_id": 3,
                  "modifier_name": "Extra Hot",
                  "price_adjustment": 1.00
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### GET /menu/items/:item_id

Get detailed item information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "item_id": 101,
    "item_name": "Buffalo Wings",
    "description": "Spicy chicken wings with ranch",
    "base_price": 12.99,
    "image_url": "https://...",
    "calories": 850,
    "is_featured": true,
    "dietary_flags": ["gluten-free"],
    "preparation_time_minutes": 15,
    "modifier_groups": [...]
  }
}
```

---

## 🛒 Order Endpoints

### POST /orders/create

Create a new order.

**Request Body:**
```json
{
  "location_id": 1,
  "order_type": "delivery",
  "items": [
    {
      "item_id": 101,
      "quantity": 2,
      "special_instructions": "Extra crispy",
      "modifiers": [
        {
          "modifier_id": 2
        }
      ]
    }
  ],
  "delivery_address": {
    "address_line1": "456 Oak Ave",
    "address_line2": "Apt 3B",
    "city": "New York",
    "state": "NY",
    "zip_code": "10002"
  },
  "delivery_instructions": "Ring doorbell twice",
  "tip_amount": 5.00,
  "loyalty_points_to_redeem": 100,
  "customer_notes": "Please include extra napkins"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order_id": 5001,
    "order_number": "ORD-5001",
    "order_status": "pending",
    "subtotal": 25.98,
    "tax_amount": 2.14,
    "tip_amount": 5.00,
    "delivery_fee": 3.99,
    "discount_amount": 5.00,
    "total_amount": 32.11,
    "loyalty_points_earned": 32,
    "estimated_ready_time": "2025-12-09T15:30:00Z",
    "payment_required": true
  }
}
```

### POST /orders/:order_id/payment

Process payment for an order.

**Request Body:**
```json
{
  "payment_method": "credit_card",
  "payment_token": "tok_1234567890",
  "save_card": true
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "payment_id": 8001,
    "order_id": 5001,
    "payment_status": "completed",
    "transaction_id": "AUTH-123456789",
    "amount": 32.11
  }
}
```

### GET /orders/:order_id

Get order details.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "order_id": 5001,
    "order_number": "ORD-5001",
    "order_type": "delivery",
    "order_status": "preparing",
    "subtotal": 25.98,
    "tax_amount": 2.14,
    "tip_amount": 5.00,
    "total_amount": 32.11,
    "payment_status": "paid",
    "estimated_ready_time": "2025-12-09T15:30:00Z",
    "items": [
      {
        "item_name": "Buffalo Wings",
        "quantity": 2,
        "unit_price": 12.99,
        "subtotal": 25.98,
        "modifiers": [
          {
            "modifier_name": "Hot",
            "price_adjustment": 0.00
          }
        ],
        "special_instructions": "Extra crispy"
      }
    ],
    "delivery_address": {
      "address_line1": "456 Oak Ave",
      "city": "New York",
      "state": "NY",
      "zip_code": "10002"
    },
    "driver": {
      "driver_id": 201,
      "first_name": "Mike",
      "phone": "+1987654321"
    },
    "status_history": [
      {
        "status": "pending",
        "timestamp": "2025-12-09T14:45:00Z"
      },
      {
        "status": "confirmed",
        "timestamp": "2025-12-09T14:46:00Z"
      },
      {
        "status": "preparing",
        "timestamp": "2025-12-09T14:50:00Z"
      }
    ]
  }
}
```

### GET /orders/customer/:customer_id

Get customer order history.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` (optional): Filter by status

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "order_id": 5001,
        "order_number": "ORD-5001",
        "order_type": "delivery",
        "order_status": "completed",
        "total_amount": 32.11,
        "created_at": "2025-12-09T14:45:00Z",
        "items_count": 2
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_orders": 87,
      "per_page": 20
    }
  }
}
```

### POST /orders/:order_id/reorder

Reorder a previous order.

**Response (201):**
```json
{
  "success": true,
  "message": "Order recreated successfully",
  "data": {
    "order_id": 5150,
    "order_number": "ORD-5150",
    "subtotal": 25.98,
    "total_amount": 32.11
  }
}
```

### PATCH /orders/:order_id/status

Update order status (Admin/Staff only).

**Request Body:**
```json
{
  "order_status": "ready",
  "notes": "Order is ready for pickup"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Order status updated",
  "data": {
    "order_id": 5001,
    "order_status": "ready",
    "updated_at": "2025-12-09T15:20:00Z"
  }
}
```

### POST /orders/:order_id/cancel

Cancel an order.

**Request Body:**
```json
{
  "cancellation_reason": "Customer changed mind"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "order_id": 5001,
    "order_status": "cancelled",
    "refund_initiated": true
  }
}
```

---

## 🎁 Loyalty Endpoints

### GET /loyalty/balance

Get customer loyalty balance.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customer_id": 123,
    "total_points": 1250,
    "lifetime_points_earned": 3480,
    "lifetime_points_redeemed": 2230,
    "tier_level": "gold",
    "points_to_next_tier": 750,
    "dollar_value": 12.50
  }
}
```

### GET /loyalty/transactions

Get loyalty transaction history.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "loyalty_transaction_id": 9001,
        "transaction_type": "earn",
        "points_amount": 32,
        "balance_after": 1250,
        "description": "Order ORD-5001",
        "created_at": "2025-12-09T15:30:00Z"
      },
      {
        "loyalty_transaction_id": 9000,
        "transaction_type": "redeem",
        "points_amount": -100,
        "balance_after": 1218,
        "description": "Discount on Order ORD-5001",
        "created_at": "2025-12-09T14:45:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "per_page": 50
    }
  }
}
```

### POST /loyalty/redeem

Redeem loyalty points.

**Request Body:**
```json
{
  "points_to_redeem": 100,
  "order_id": 5001
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Points redeemed successfully",
  "data": {
    "points_redeemed": 100,
    "discount_amount": 5.00,
    "new_balance": 1150
  }
}
```

### GET /loyalty/rules

Get current loyalty rules.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "loyalty_rule_id": 1,
      "rule_name": "Standard Earning",
      "rule_type": "earn_percentage",
      "points_per_dollar": 1.00,
      "min_purchase_amount": 0.00,
      "is_active": true
    },
    {
      "loyalty_rule_id": 2,
      "rule_name": "Redemption Rate",
      "rule_type": "redeem_discount",
      "redemption_value": 0.05,
      "is_active": true
    }
  ]
}
```

---

## 💳 Payment Endpoints

### POST /payments/tokenize

Tokenize a credit card (Authorize.Net).

**Request Body:**
```json
{
  "card_number": "4111111111111111",
  "expiry_month": "12",
  "expiry_year": "2027",
  "cvv": "123",
  "billing_zip": "10001"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "payment_token": "tok_1234567890abcdef",
    "card_last_four": "1111",
    "card_brand": "Visa",
    "expiry_month": "12",
    "expiry_year": "2027"
  }
}
```

### POST /payments/charge

Charge a payment method.

**Request Body:**
```json
{
  "order_id": 5001,
  "payment_token": "tok_1234567890abcdef",
  "amount": 32.11
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "data": {
    "payment_id": 8001,
    "transaction_id": "AUTH-123456789",
    "authorization_code": "ABC123",
    "payment_status": "completed",
    "amount": 32.11
  }
}
```

### POST /payments/:payment_id/refund

Refund a payment (Admin only).

**Request Body:**
```json
{
  "refund_amount": 32.11,
  "refund_reason": "Customer complaint"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Refund processed successfully",
  "data": {
    "refund_id": 7001,
    "payment_id": 8001,
    "refund_amount": 32.11,
    "refund_status": "completed",
    "transaction_id": "REFUND-987654321"
  }
}
```

---

## 🚚 Delivery Endpoints

### GET /delivery/assignments

Get assigned deliveries for driver.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "assignment_id": 301,
      "order_id": 5001,
      "order_number": "ORD-5001",
      "assignment_status": "assigned",
      "delivery_address": {
        "address_line1": "456 Oak Ave",
        "city": "New York",
        "state": "NY",
        "zip_code": "10002"
      },
      "customer_name": "John Doe",
      "customer_phone": "+1234567890",
      "total_amount": 32.11,
      "assigned_at": "2025-12-09T15:00:00Z",
      "estimated_delivery_time": "2025-12-09T15:45:00Z"
    }
  ]
}
```

### PATCH /delivery/:assignment_id/status

Update delivery status.

**Request Body:**
```json
{
  "assignment_status": "picked_up",
  "driver_notes": "Order picked up from restaurant"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Delivery status updated",
  "data": {
    "assignment_id": 301,
    "assignment_status": "picked_up",
    "picked_up_at": "2025-12-09T15:25:00Z"
  }
}
```

### GET /delivery/history

Get delivery history for driver.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deliveries": [
      {
        "assignment_id": 300,
        "order_number": "ORD-5000",
        "assignment_status": "delivered",
        "total_amount": 45.50,
        "delivered_at": "2025-12-09T14:30:00Z"
      }
    ],
    "statistics": {
      "total_deliveries": 127,
      "completed_today": 8,
      "earnings_today": 320.00
    }
  }
}
```

---

## 🔔 Notification Endpoints

### POST /notifications/send

Send push notification (Admin only).

**Request Body:**
```json
{
  "title": "Special Offer!",
  "message": "Get 20% off your next order",
  "notification_type": "promotion",
  "target_role": "customer",
  "location_id": 1,
  "image_url": "https://...",
  "action_url": "app://menu/specials",
  "scheduled_for": "2025-12-10T12:00:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Notification scheduled successfully",
  "data": {
    "notification_id": 401,
    "scheduled_for": "2025-12-10T12:00:00Z",
    "estimated_recipients": 1250
  }
}
```

### PATCH /notifications/token

Update FCM token for user.

**Request Body:**
```json
{
  "fcm_token": "fcm_device_token_here"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token updated successfully"
}
```

---

## 📊 Admin Endpoints

### GET /admin/orders

Get all orders (Admin/Staff).

**Query Parameters:**
- `location_id` (optional)
- `status` (optional)
- `order_type` (optional)
- `date_from` (optional)
- `date_to` (optional)
- `page` (default: 1)
- `limit` (default: 50)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {...},
    "statistics": {
      "total_orders": 523,
      "total_revenue": 12450.00,
      "average_order_value": 23.80
    }
  }
}
```

### GET /admin/reports/sales

Get sales report.

**Query Parameters:**
- `location_id` (optional)
- `date_from` (required)
- `date_to` (required)
- `group_by` (optional): 'day', 'week', 'month'

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_orders": 523,
      "total_revenue": 12450.00,
      "total_tax": 1026.00,
      "total_tips": 1892.50,
      "average_order_value": 23.80
    },
    "breakdown": [
      {
        "date": "2025-12-09",
        "orders": 87,
        "revenue": 2104.50
      }
    ]
  }
}
```

---

## 🛡️ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "email": "Email is required",
      "password": "Password must be at least 8 characters"
    }
  }
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this resource"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found"
  }
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "request_id": "req_1234567890"
  }
}
```

---

## 📡 WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'jwt_token_here'
  }
});
```

### Events

**order:status_updated**
```json
{
  "order_id": 5001,
  "order_status": "preparing",
  "updated_at": "2025-12-09T15:10:00Z"
}
```

**delivery:location_updated**
```json
{
  "assignment_id": 301,
  "latitude": 40.7128,
  "longitude": -74.0060,
  "updated_at": "2025-12-09T15:30:00Z"
}
```

**loyalty:points_earned**
```json
{
  "customer_id": 123,
  "points_earned": 32,
  "new_balance": 1250,
  "order_id": 5001
}
```

---

**Document Version:** 1.0  
**Last Updated:** December 9, 2025  
**Author:** Domenico

