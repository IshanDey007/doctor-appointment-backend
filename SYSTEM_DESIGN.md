# System Design Document
## Doctor Appointment Booking System

### Executive Summary

This document outlines the system design for a production-grade healthcare appointment booking platform capable of handling high concurrency, preventing overbooking, and scaling to millions of users.

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
                                    ┌─────────────────┐
                                    │   CDN (Static)  │
                                    └────────┬────────┘
                                             │
┌──────────────┐                    ┌────────▼────────┐
│   Patients   │───────────────────▶│  Load Balancer  │
│   Doctors    │                    │   (AWS ALB)     │
│   Admins     │                    └────────┬────────┘
└──────────────┘                             │
                                    ┌────────┴────────┐
                                    │                 │
                            ┌───────▼──────┐  ┌──────▼───────┐
                            │   API Server │  │  API Server  │
                            │   (Node.js)  │  │  (Node.js)   │
                            └───────┬──────┘  └──────┬───────┘
                                    │                │
                            ┌───────┴────────────────┴───────┐
                            │                                │
                    ┌───────▼────────┐              ┌────────▼────────┐
                    │  Redis Cache   │              │  Message Queue  │
                    │  (ElastiCache) │              │  (RabbitMQ/SQS) │
                    └───────┬────────┘              └────────┬────────┘
                            │                                │
                    ┌───────▼────────────────────────────────▼────────┐
                    │         PostgreSQL Primary (RDS)                │
                    │         - Write Operations                      │
                    └───────┬─────────────────────────────────────────┘
                            │
                    ┌───────┴────────┬────────────────┐
                    │                │                │
            ┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
            │ Read Replica │ │Read Replica │ │Read Replica │
            │   (Region 1) │ │  (Region 2) │ │  (Region 3) │
            └──────────────┘ └─────────────┘ └─────────────┘
```

### 1.2 Component Breakdown

**Frontend Layer**
- React SPA hosted on CDN (CloudFront/Cloudflare)
- Static assets cached globally
- API calls to backend via HTTPS

**Load Balancer**
- AWS Application Load Balancer (ALB)
- SSL termination
- Health checks every 30 seconds
- Auto-scaling based on CPU/memory

**API Servers**
- Node.js with Express
- Stateless design for horizontal scaling
- Auto-scaling group (min: 2, max: 20)
- Container-based deployment (ECS/Kubernetes)

**Caching Layer**
- Redis for hot data
- Cache available slots (1-minute TTL)
- Cache doctor profiles (1-hour TTL)
- Session management

**Message Queue**
- RabbitMQ or AWS SQS
- Async booking confirmations
- Email/SMS notifications
- Analytics events

**Database**
- PostgreSQL primary for writes
- Read replicas for queries
- Automated backups every 6 hours
- Point-in-time recovery

---

## 2. Database Design

### 2.1 Schema Design

**Doctors Table**
```sql
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    hospital_id INTEGER REFERENCES hospitals(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doctors_specialization ON doctors(specialization);
CREATE INDEX idx_doctors_hospital ON doctors(hospital_id);
```

**Appointment Slots Table**
```sql
CREATE TABLE appointment_slots (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    slot_date DATE NOT NULL,
    slot_time TIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    is_available BOOLEAN DEFAULT TRUE,
    max_bookings INTEGER DEFAULT 1,
    current_bookings INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, slot_date, slot_time)
);

CREATE INDEX idx_slots_doctor_date ON appointment_slots(doctor_id, slot_date);
CREATE INDEX idx_slots_available ON appointment_slots(is_available) 
    WHERE is_available = TRUE;
CREATE INDEX idx_slots_date_range ON appointment_slots(slot_date) 
    WHERE slot_date >= CURRENT_DATE;
```

**Bookings Table**
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES appointment_slots(id),
    patient_id INTEGER REFERENCES patients(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_email VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDING',
    booking_reference VARCHAR(50) UNIQUE,
    payment_status VARCHAR(20),
    payment_id VARCHAR(100),
    notes TEXT,
    version INTEGER DEFAULT 1,
    booking_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED'))
);

CREATE INDEX idx_bookings_slot ON bookings(slot_id);
CREATE INDEX idx_bookings_patient ON bookings(patient_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX idx_bookings_pending ON bookings(status, booking_time) 
    WHERE status = 'PENDING';
```

### 2.2 Partitioning Strategy

**Time-Based Partitioning for Bookings**
```sql
-- Partition by month for better query performance
CREATE TABLE bookings_2025_01 PARTITION OF bookings
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE bookings_2025_02 PARTITION OF bookings
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

**Benefits:**
- Faster queries on recent data
- Easy archival of old data
- Improved maintenance operations

### 2.3 Sharding Strategy (Future)

**Shard by Geographic Region**
```
Shard 1: US East (doctors 1-10000)
Shard 2: US West (doctors 10001-20000)
Shard 3: Europe (doctors 20001-30000)
Shard 4: Asia (doctors 30001-40000)
```

**Shard Key:** `doctor_id % num_shards`

---

## 3. Concurrency Control

### 3.1 Multi-Layer Approach

**Layer 1: Application Level**
```javascript
// Optimistic locking with version check
async function bookSlot(slotId, patientData) {
  const slot = await getSlot(slotId);
  
  if (!slot.is_available) {
    throw new Error('Slot unavailable');
  }
  
  // Attempt booking with version check
  const result = await db.query(`
    UPDATE appointment_slots 
    SET is_available = FALSE, version = version + 1
    WHERE id = $1 AND version = $2 AND is_available = TRUE
    RETURNING *
  `, [slotId, slot.version]);
  
  if (result.rows.length === 0) {
    throw new Error('Booking conflict - please retry');
  }
  
  return createBooking(slotId, patientData);
}
```

**Layer 2: Database Level**
```sql
-- Pessimistic locking for critical sections
BEGIN ISOLATION LEVEL SERIALIZABLE;

SELECT * FROM appointment_slots 
WHERE id = $1 
FOR UPDATE NOWAIT;

-- If lock acquired, proceed with booking
INSERT INTO bookings (...) VALUES (...);
UPDATE appointment_slots SET is_available = FALSE WHERE id = $1;

COMMIT;
```

**Layer 3: Distributed Lock (Redis)**
```javascript
const redlock = new Redlock([redisClient]);

async function bookWithDistributedLock(slotId, patientData) {
  const lock = await redlock.lock(`slot:${slotId}`, 5000);
  
  try {
    // Perform booking
    const booking = await createBooking(slotId, patientData);
    return booking;
  } finally {
    await lock.unlock();
  }
}
```

### 3.2 Race Condition Prevention

**Problem:** 100 users try to book the same slot simultaneously

**Solution:**
1. **Database Constraint**: UNIQUE(doctor_id, slot_date, slot_time)
2. **Row-Level Locking**: FOR UPDATE prevents concurrent modifications
3. **Transaction Isolation**: SERIALIZABLE ensures consistency
4. **Idempotency**: Booking reference prevents duplicate bookings
5. **Queue-Based**: Move to async processing for high load

---

## 4. Caching Strategy

### 4.1 Cache Layers

**L1: Application Cache (In-Memory)**
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 });

// Cache doctor profiles
async function getDoctor(id) {
  const cached = cache.get(`doctor:${id}`);
  if (cached) return cached;
  
  const doctor = await db.query('SELECT * FROM doctors WHERE id = $1', [id]);
  cache.set(`doctor:${id}`, doctor.rows[0]);
  return doctor.rows[0];
}
```

**L2: Redis Cache (Distributed)**
```javascript
// Cache available slots
async function getAvailableSlots(doctorId, date) {
  const cacheKey = `slots:${doctorId}:${date}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const slots = await db.query(`
    SELECT * FROM appointment_slots 
    WHERE doctor_id = $1 AND slot_date = $2 AND is_available = TRUE
  `, [doctorId, date]);
  
  await redis.setex(cacheKey, 60, JSON.stringify(slots.rows));
  return slots.rows;
}
```

### 4.2 Cache Invalidation

**Write-Through Pattern**
```javascript
async function updateSlotAvailability(slotId, isAvailable) {
  // Update database
  await db.query('UPDATE appointment_slots SET is_available = $1 WHERE id = $2', 
    [isAvailable, slotId]);
  
  // Invalidate cache
  const slot = await db.query('SELECT doctor_id, slot_date FROM appointment_slots WHERE id = $1', [slotId]);
  await redis.del(`slots:${slot.doctor_id}:${slot.slot_date}`);
}
```

---

## 5. Scalability Plan

### 5.1 Horizontal Scaling

**API Servers**
- Stateless design allows unlimited horizontal scaling
- Auto-scaling based on metrics:
  - CPU > 70% → Scale up
  - CPU < 30% → Scale down
  - Request rate > 1000/sec → Scale up

**Database Read Replicas**
- Route read queries to replicas
- Write queries to primary
- Replication lag monitoring (< 1 second)

### 5.2 Vertical Scaling

**Database Optimization**
- Upgrade to larger instance types during peak hours
- Use provisioned IOPS for consistent performance
- Enable query performance insights

### 5.3 Geographic Distribution

```
Region: US-East-1 (Primary)
├── API Servers: 5 instances
├── Database: Primary + 2 replicas
└── Redis: 3-node cluster

Region: EU-West-1 (Secondary)
├── API Servers: 3 instances
├── Database: 2 read replicas
└── Redis: 3-node cluster

Region: AP-South-1 (Tertiary)
├── API Servers: 2 instances
├── Database: 1 read replica
└── Redis: 3-node cluster
```

---

## 6. Message Queue Architecture

### 6.1 Queue Design

**Booking Queue**
```
User Request → API → Booking Queue → Worker → Database
                ↓
         Immediate Response
         (Booking ID + PENDING status)
```

**Benefits:**
- Decouples booking from confirmation
- Handles traffic spikes
- Retry failed bookings
- Rate limiting

### 6.2 Queue Implementation

```javascript
// Producer (API Server)
async function createBookingAsync(slotId, patientData) {
  const bookingId = generateId();
  
  await queue.publish('bookings', {
    bookingId,
    slotId,
    patientData,
    timestamp: Date.now()
  });
  
  return {
    bookingId,
    status: 'PENDING',
    message: 'Booking is being processed'
  };
}

// Consumer (Worker)
queue.subscribe('bookings', async (message) => {
  try {
    const booking = await processBooking(message);
    await sendConfirmationEmail(booking);
    await updateBookingStatus(message.bookingId, 'CONFIRMED');
  } catch (error) {
    await updateBookingStatus(message.bookingId, 'FAILED');
    await queue.publish('failed-bookings', message);
  }
});
```

---

## 7. Monitoring & Observability

### 7.1 Metrics to Track

**Application Metrics**
- Request rate (requests/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Active connections

**Database Metrics**
- Query execution time
- Connection pool usage
- Replication lag
- Deadlock count

**Business Metrics**
- Bookings per hour
- Booking success rate
- Average booking time
- Slot utilization rate

### 7.2 Monitoring Stack

```
Prometheus → Grafana → Alerting
     ↑
     │
Application (Metrics Endpoint)
```

**Alert Rules**
- Error rate > 5% → Page on-call engineer
- Response time > 1s → Warning
- Database CPU > 80% → Scale up
- Replication lag > 5s → Critical

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

**JWT-Based Auth**
```javascript
// Middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Role-based access
function authorize(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### 8.2 Data Protection

- **Encryption at Rest**: Database encryption enabled
- **Encryption in Transit**: TLS 1.3 for all connections
- **PII Protection**: Hash sensitive data (phone, email)
- **GDPR Compliance**: Data retention policies

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

**Automated Backups**
- Full backup: Daily at 2 AM UTC
- Incremental backup: Every 6 hours
- Retention: 30 days
- Cross-region replication

**Point-in-Time Recovery**
- Restore to any point in last 7 days
- RTO (Recovery Time Objective): < 1 hour
- RPO (Recovery Point Objective): < 5 minutes

### 9.2 Failover Plan

**Database Failover**
```
Primary Fails → Automatic Promotion of Replica → Update DNS → Resume Operations
```

**Multi-Region Failover**
```
Region 1 Down → Route53 Health Check Fails → Traffic to Region 2 → Continue Service
```

---

## 10. Cost Optimization

### 10.1 Infrastructure Costs (Monthly)

| Component | Configuration | Cost |
|-----------|--------------|------|
| EC2 (API) | 5 x t3.medium | $150 |
| RDS (PostgreSQL) | db.r5.large + 2 replicas | $400 |
| ElastiCache (Redis) | cache.r5.large | $150 |
| ALB | 1 instance | $25 |
| S3 + CloudFront | 1TB transfer | $50 |
| **Total** | | **$775/month** |

### 10.2 Optimization Strategies

- Use spot instances for non-critical workers
- Auto-scaling to reduce idle capacity
- Reserved instances for predictable load (40% savings)
- Compress API responses (gzip)
- CDN caching for static assets

---

## 11. Future Enhancements

1. **AI-Powered Scheduling**
   - Predict no-shows
   - Optimize slot allocation
   - Suggest best appointment times

2. **Video Consultation**
   - Integrate WebRTC
   - Record consultations
   - Prescription generation

3. **Mobile Apps**
   - Native iOS/Android apps
   - Push notifications
   - Offline mode

4. **Analytics Dashboard**
   - Doctor performance metrics
   - Patient satisfaction scores
   - Revenue analytics

---

## Conclusion

This system design provides a robust, scalable foundation for a production-grade healthcare appointment booking platform. The multi-layered concurrency control ensures data consistency, while the caching and queueing strategies enable handling millions of users efficiently.

**Key Strengths:**
- ✅ Prevents overbooking with multiple safeguards
- ✅ Scales horizontally to handle traffic spikes
- ✅ Geographic distribution for low latency
- ✅ Comprehensive monitoring and alerting
- ✅ Disaster recovery with < 1 hour RTO

**Author:** Ishan Dey  
**Date:** December 2025  
**Version:** 1.0