# 🚀 Deployment Guide

Complete guide to deploy the Doctor Appointment Booking System to production.

## Overview

- **Backend**: Deploy to Render (with PostgreSQL)
- **Frontend**: Deploy to Vercel
- **Database**: Render PostgreSQL

## Backend Deployment (Render)

### Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** → **PostgreSQL**
3. Configure:
   - **Name**: `doctor-appointments-db`
   - **Database**: `doctor_appointments`
   - **User**: `doctor_admin`
   - **Region**: Choose closest to your users
   - **Plan**: Free (for testing) or Starter
4. Click **Create Database**
5. **Save credentials** (you'll need them):
   - Internal Database URL
   - External Database URL
   - Username
   - Password

### Step 2: Deploy Backend Service

1. Click **New** → **Web Service**
2. Connect your GitHub repository: `doctor-appointment-backend`
3. Configure:
   - **Name**: `doctor-appointment-api`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run migrate`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter

4. **Environment Variables** (click Advanced):
```env
NODE_ENV=production
PORT=5000
DB_HOST=<from-render-postgres-internal-url>
DB_PORT=5432
DB_NAME=doctor_appointments
DB_USER=<from-render-postgres>
DB_PASSWORD=<from-render-postgres>
BOOKING_TIMEOUT_MINUTES=2
CORS_ORIGIN=https://your-frontend-url.vercel.app
API_URL=https://doctor-appointment-api.onrender.com
```

5. Click **Create Web Service**
6. Wait for deployment (5-10 minutes)
7. **Test API**: Visit `https://your-api-url.onrender.com/health`

### Step 3: Run Database Migration

The migration runs automatically during build. To run manually:

1. Go to your service → **Shell**
2. Run: `npm run migrate`

## Frontend Deployment (Vercel)

### Step 1: Deploy to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import `doctor-appointment-frontend` from GitHub
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: Leave empty
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Environment Variables**:
```env
VITE_API_URL=https://your-backend-url.onrender.com
```

6. Click **Deploy**
7. Wait for deployment (2-3 minutes)

### Step 2: Update Backend CORS

1. Go back to Render backend service
2. Update `CORS_ORIGIN` environment variable:
```env
CORS_ORIGIN=https://your-frontend-url.vercel.app
```
3. Service will auto-redeploy

## Post-Deployment Setup

### 1. Test the Application

**Backend Health Check:**
```bash
curl https://your-api-url.onrender.com/health
```

**API Documentation:**
Visit: `https://your-api-url.onrender.com/api-docs`

**Frontend:**
Visit: `https://your-frontend-url.vercel.app`

### 2. Create Sample Data

Use the admin dashboard or API to create:

1. **Doctors** (via Admin page or API)
```bash
curl -X POST https://your-api-url.onrender.com/api/doctors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Sarah Johnson",
    "specialization": "Cardiologist",
    "email": "sarah.johnson@hospital.com",
    "phone": "+1-555-0101"
  }'
```

2. **Appointment Slots** (via Admin page or API)
```bash
curl -X POST https://your-api-url.onrender.com/api/slots/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "doctor_id": 1,
    "slot_date": "2025-12-15",
    "start_time": "09:00",
    "end_time": "17:00",
    "duration_minutes": 30
  }'
```

### 3. Monitor Application

**Render Monitoring:**
- View logs in Render dashboard
- Set up alerts for downtime
- Monitor resource usage

**Vercel Monitoring:**
- View deployment logs
- Monitor function execution
- Check analytics

## Environment Variables Reference

### Backend (.env)

```env
# Server
NODE_ENV=production
PORT=5000

# Database (from Render PostgreSQL)
DB_HOST=dpg-xxxxx.oregon-postgres.render.com
DB_PORT=5432
DB_NAME=doctor_appointments
DB_USER=doctor_admin
DB_PASSWORD=xxxxxxxxxxxxx

# Application
BOOKING_TIMEOUT_MINUTES=2

# CORS (Frontend URL)
CORS_ORIGIN=https://doctor-appointment.vercel.app

# API URL (for Swagger docs)
API_URL=https://doctor-appointment-api.onrender.com
```

### Frontend (.env)

```env
# Backend API URL
VITE_API_URL=https://doctor-appointment-api.onrender.com
```

## Troubleshooting

### Backend Issues

**Issue: Database connection fails**
```
Solution:
1. Check DB credentials in environment variables
2. Ensure using Internal Database URL for Render
3. Verify database is running
```

**Issue: Migration fails**
```
Solution:
1. Check database permissions
2. Run migration manually via Shell
3. Check migration logs
```

**Issue: CORS errors**
```
Solution:
1. Update CORS_ORIGIN with exact frontend URL
2. Include protocol (https://)
3. No trailing slash
```

### Frontend Issues

**Issue: API calls fail**
```
Solution:
1. Check VITE_API_URL is correct
2. Ensure backend is deployed and running
3. Check browser console for errors
```

**Issue: Build fails**
```
Solution:
1. Check TypeScript errors
2. Ensure all dependencies installed
3. Review build logs in Vercel
```

## Performance Optimization

### Backend

1. **Enable Connection Pooling** (already configured)
2. **Add Redis Caching** (future enhancement)
3. **Enable Compression**:
```javascript
app.use(compression());
```

### Frontend

1. **Enable Vercel Analytics**
2. **Add Image Optimization**
3. **Enable Edge Caching**

## Security Checklist

- [ ] HTTPS enabled (automatic on Vercel/Render)
- [ ] Environment variables secured
- [ ] CORS properly configured
- [ ] Database credentials not in code
- [ ] API rate limiting (future enhancement)
- [ ] Input validation on both frontend and backend
- [ ] SQL injection prevention (parameterized queries)

## Scaling Considerations

### When to Scale

- Response time > 1 second
- CPU usage > 80%
- Memory usage > 80%
- Database connections maxed out

### Scaling Options

**Render:**
- Upgrade to Starter/Standard plan
- Enable auto-scaling
- Add more instances

**Database:**
- Upgrade PostgreSQL plan
- Add read replicas
- Enable connection pooling

**Vercel:**
- Automatic scaling included
- Monitor function execution time
- Optimize bundle size

## Monitoring & Alerts

### Set Up Monitoring

1. **Render:**
   - Enable email alerts
   - Monitor service health
   - Track deployment status

2. **Vercel:**
   - Enable deployment notifications
   - Monitor function logs
   - Track build times

3. **Database:**
   - Monitor connection count
   - Track query performance
   - Set up backup alerts

## Backup Strategy

### Database Backups

Render automatically backs up PostgreSQL:
- Daily backups (retained 7 days on free plan)
- Point-in-time recovery available on paid plans

### Manual Backup

```bash
# Export database
pg_dump -h <host> -U <user> -d <database> > backup.sql

# Restore database
psql -h <host> -U <user> -d <database> < backup.sql
```

## Cost Estimation

### Free Tier (Testing)

- **Render Web Service**: Free (sleeps after 15 min inactivity)
- **Render PostgreSQL**: Free (1GB storage, 90 days retention)
- **Vercel**: Free (100GB bandwidth, unlimited deployments)
- **Total**: $0/month

### Production Tier

- **Render Web Service**: $7/month (Starter)
- **Render PostgreSQL**: $7/month (Starter, 1GB)
- **Vercel**: Free (sufficient for most use cases)
- **Total**: ~$14/month

### High-Traffic Tier

- **Render Web Service**: $25/month (Standard)
- **Render PostgreSQL**: $20/month (Standard, 10GB)
- **Vercel**: $20/month (Pro)
- **Total**: ~$65/month

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] Environment variables documented
- [ ] Database schema finalized
- [ ] API documentation complete
- [ ] Frontend build successful
- [ ] CORS configured correctly

### Deployment

- [ ] Database created and migrated
- [ ] Backend deployed and healthy
- [ ] Frontend deployed successfully
- [ ] Environment variables set
- [ ] CORS updated with frontend URL

### Post-Deployment

- [ ] Health check passing
- [ ] Sample data created
- [ ] All features tested
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Documentation updated

## Support & Maintenance

### Regular Tasks

**Daily:**
- Monitor error logs
- Check service health

**Weekly:**
- Review performance metrics
- Check database size
- Update dependencies (if needed)

**Monthly:**
- Review costs
- Analyze usage patterns
- Plan optimizations

## Useful Commands

### Backend

```bash
# View logs
render logs -s doctor-appointment-api

# SSH into service
render shell -s doctor-appointment-api

# Run migration
npm run migrate
```

### Frontend

```bash
# View deployment logs
vercel logs

# Deploy manually
vercel --prod
```

### Database

```bash
# Connect to database
psql <external-database-url>

# Check tables
\dt

# View bookings
SELECT * FROM bookings;
```

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Deployment completed! 🎉**

Your application is now live and ready for users!