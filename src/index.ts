import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import routes from './routes';
import { prisma } from './lib/prisma';
import { SocketService } from './services/chat';
import { config } from './config';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration - allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Vite default port
  'http://localhost:5174', // Frontend dev server
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:51180',
  'https://app.staffsynctech.co.uk', // Production frontend
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(morgan('dev'));

// Webhook route must be before express.json() to get raw body
import { webhookRouter } from './routes/subscription.routes';
app.use('/api/v1/subscriptions', webhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
const uploadDir = path.join(process.cwd(), config.upload.uploadDir);
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Email diagnostic endpoint (remove in production)
app.get('/debug/email-test', async (_req, res) => {
  const { EmailService } = await import('./services/notifications/email.service');
  const emailInfo = {
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? `${process.env.SENDGRID_API_KEY.substring(0, 5)}...` : '(NOT SET)',
    SMTP_PASS: process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 5)}...` : '(NOT SET)',
    SMTP_FROM: process.env.SMTP_FROM || '(NOT SET)',
    SMTP_HOST: process.env.SMTP_HOST || '(not set)',
    mode: process.env.SENDGRID_API_KEY?.startsWith('SG.') || process.env.SMTP_PASS?.startsWith('SG.')
      ? 'SendGrid HTTP API' : 'SMTP (will hang on Render)',
  };
  try {
    const testEmail = (_req.query.to as string) || process.env.SMTP_FROM || 'test@example.com';
    const messageId = await EmailService.send({
      to: testEmail,
      subject: 'StaffSync Email Test',
      html: '<h1>Email is working!</h1><p>This is a test from StaffSync backend.</p>',
      text: 'Email is working! This is a test from StaffSync backend.',
    });
    res.json({ success: true, messageId, config: emailInfo });
  } catch (err: any) {
    res.json({
      success: false,
      error: err?.message || String(err),
      code: err?.code,
      response: err?.response?.body,
      config: emailInfo,
    });
  }
});

// Public email routes (no authentication required)
import { ShiftController } from './controllers/shift.controller';
const shiftController = new ShiftController();

app.post('/api/v1/shifts/:shiftId/accept-email', shiftController.acceptShiftByEmail);
app.post('/api/v1/shifts/:shiftId/reject-email', shiftController.rejectShiftByEmail);

// API Routes
app.use('/api/v1', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Socket.IO
SocketService.initialize(httpServer);

// Start server
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 StaffSync API running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO enabled for real-time chat`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
