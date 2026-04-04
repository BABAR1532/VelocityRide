# Velocity — Microservices Backend

A production-grade MERN microservices backend for the Velocity ride-hailing platform.

## Architecture

```
React Frontend (Vite)
        │ HTTP :3000
        ▼
  API Gateway          ← JWT auth, rate-limiting, request proxying
        │
        ├── Auth Service       :3001   MongoDB: velocity_auth
        ├── User Service       :3002   MongoDB: velocity_users    + Redis cache
        ├── Ride Service       :3003   MongoDB: velocity_rides    + Redis lock + MQ
        ├── Carpool Service    :3004   MongoDB: velocity_carpool  + optimistic lock
        ├── Parcel Service     :3005   MongoDB: velocity_parcels  + MQ
        ├── Notification Svc   :3006   MongoDB: velocity_notifs   (event consumer)
        └── Subscription Svc   :3007   MongoDB: velocity_subs     + Redis cache

Shared Infrastructure:
  MongoDB 7   — persistent storage (Database-per-Service pattern)
  Redis 7     — caching + distributed locking
  RabbitMQ 3  — async event bus (topic exchange: velocity.events)
```

## The Four Requirements

### i. Inter-Service Communication
- **API Gateway** (`http-proxy-middleware`) routes all frontend traffic to the correct downstream service
- Services communicate synchronously via the gateway (REST) and asynchronously via RabbitMQ events

### ii. Concurrency Control & Consistency
- **Redis distributed lock** in Ride Service: prevents two concurrent requests from assigning the same driver (`SETNX`-based lock with TTL)
- **MongoDB optimistic locking** in Carpool Service: `findOneAndUpdate` with `__v` version check ensures seats are never over-subscribed

### iii. Caching (Redis)
| Service | Cache Key | TTL |
|---|---|---|
| User Service | `user:${userId}` | 5 min |
| Ride Service | `estimate:${from}:${to}:${type}` | 2 min |
| Carpool Service | `pools:available` | 30 sec |
| Subscription Service | `plans:all` | 1 hour |

### iv. Event-Driven Messaging (RabbitMQ)
Exchange: `velocity.events` (topic)

| Event | Publisher | Consumer |
|---|---|---|
| `user.registered` | Auth Service | Notification Service |
| `ride.booked` | Ride Service | Notification Service |
| `ride.cancelled` | Ride Service | Notification Service |
| `ride.completed` | Ride Service | Notification Service |
| `carpool.joined` | Carpool Service | Notification Service |
| `carpool.full` | Carpool Service | Notification Service |
| `parcel.booked` | Parcel Service | Notification Service |
| `parcel.dispatched` | Parcel Service | Notification Service |
| `parcel.delivered` | Parcel Service | Notification Service |
| `subscription.activated` | Subscription Service | Notification Service |

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Run Everything
```bash
cd velocity-backend
cp .env.example .env
docker-compose up --build
```

### Service URLs
| Service | URL |
|---|---|
| API Gateway | http://localhost:3000 |
| Auth Service | http://localhost:3001 |
| User Service | http://localhost:3002 |
| Ride Service | http://localhost:3003 |
| Carpool Service | http://localhost:3004 |
| Parcel Service | http://localhost:3005 |
| Notification Service | http://localhost:3006 |
| Subscription Service | http://localhost:3007 |
| RabbitMQ Management | http://localhost:15672 (admin/password) |

## API Reference (via Gateway on :3000)

### Auth
```
POST /api/auth/register     { name, email, password }
POST /api/auth/login        { email, password }
POST /api/auth/refresh      { refreshToken }
POST /api/auth/logout       { refreshToken }
```

### Users
```
GET  /api/users/me
PUT  /api/users/me          { name, phone, address }
GET  /api/users/me/locations
POST /api/users/me/locations { label, address }
```

### Rides
```
POST /api/rides/estimate    { from, to, type }
POST /api/rides             { from, to, type, fare }
GET  /api/rides
GET  /api/rides/:id
PATCH /api/rides/:id/cancel
```

### Carpool
```
GET  /api/carpool/pools
POST /api/carpool/pools     { from, to, departureTime, totalSeats, farePerPerson }
POST /api/carpool/pools/:id/join
DELETE /api/carpool/pools/:id/leave
```

### Parcel
```
POST /api/parcel/estimate   { weight }
POST /api/parcel            { pickupAddress, dropoffAddress, weight, packageType }
GET  /api/parcel
GET  /api/parcel/:id
PATCH /api/parcel/:id/status { status }
```

### Subscriptions
```
GET  /api/subscriptions/plans
POST /api/subscriptions     { planId }
GET  /api/subscriptions/me
DELETE /api/subscriptions/me
```

### Notifications
```
GET  /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all
```

## Health Checks
Each service exposes `GET /health` → `{ status: "ok", service: "..." }`
