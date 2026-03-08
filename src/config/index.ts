export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string,
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@staffsync.com',
  },

  emailVerification: {
    codeLength: 6,
    expiresInMinutes: 15,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
  },
  
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    freeTrialDays: parseInt(process.env.FREE_TRIAL_DAYS || '180', 10),
    plans: {
      standard: {
        monthlyPriceId: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID || '',
        yearlyPriceId: process.env.STRIPE_STANDARD_YEARLY_PRICE_ID || '',
        monthlyPrice: parseInt(process.env.STRIPE_STANDARD_MONTHLY_PRICE || '500', 10),   // £500/month (in pounds)
        yearlyPrice: parseInt(process.env.STRIPE_STANDARD_YEARLY_PRICE || '5000', 10),     // £5000/year
        workerLimit: parseInt(process.env.STRIPE_STANDARD_WORKER_LIMIT || '-1', 10),       // -1 = unlimited
        clientLimit: parseInt(process.env.STRIPE_STANDARD_CLIENT_LIMIT || '-1', 10),
      },
      enterprise: {
        monthlyPriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
        yearlyPriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || '',
        workerLimit: parseInt(process.env.STRIPE_ENTERPRISE_WORKER_LIMIT || '-1', 10),
        clientLimit: parseInt(process.env.STRIPE_ENTERPRISE_CLIENT_LIMIT || '-1', 10),
      },
    },
  },

  // UK Working Time Regulations defaults
  workingTime: {
    minRestHours: 11,
    maxWeeklyHours: 48,
  },

  // UK Statutory Holiday Entitlement
  leave: {
    statutoryWeeks: 5.6,           // UK statutory: 5.6 weeks paid leave
    defaultContractedHours: 40,    // Full-time weekly hours
    workingDaysPerWeek: 5,         // Standard working days
    hoursPerShift: 8,              // Standard shift = 8 hours for holiday pay
    yearStartMonth: 4,             // UK leave year starts April (month 4)
  },

  // Attendance/Clock-in settings
  attendance: {
    defaultGeofenceRadius: parseInt(process.env.DEFAULT_GEOFENCE_RADIUS || '300', 10), // meters
    earlyClockInMinutes: parseInt(process.env.EARLY_CLOCK_IN_MINUTES || '15', 10),
  },
};
