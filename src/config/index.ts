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
    baseUrl: process.env.UPLOAD_BASE_URL || 'https://app.staffsynctech.co.uk/uploads',
  },

  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    bucket: process.env.SUPABASE_BUCKET || 'uploads',
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
    
    // Per-worker pricing model (prices in pence)
    perWorkerPricing: {
      starter: {
        name: 'Starter',
        minWorkers: parseInt(process.env.STRIPE_STARTER_MIN_WORKERS || '1', 10),
        maxWorkers: parseInt(process.env.STRIPE_STARTER_MAX_WORKERS || '10', 10),
        monthlyPricePerWorker: parseInt(process.env.STRIPE_STARTER_MONTHLY_PRICE_PER_WORKER || '500', 10),
        yearlyPricePerWorker: parseInt(process.env.STRIPE_STARTER_YEARLY_PRICE_PER_WORKER || '400', 10),
        stripePriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
        monthlyStripePriceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || '',
        yearlyStripePriceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID_TEST || process.env.STRIPE_STARTER_YEARLY_PRICE_ID || '',
        features: [
          'Basic scheduling & time tracking',
          'Mobile app access',
          'Email support',
          'Up to 10 workers',
        ],
      },
      professional: {
        name: 'Professional',
        minWorkers: parseInt(process.env.STRIPE_PROFESSIONAL_MIN_WORKERS || '11', 10),
        maxWorkers: parseInt(process.env.STRIPE_PROFESSIONAL_MAX_WORKERS || '50', 10),
        monthlyPricePerWorker: parseInt(process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_PER_WORKER || '400', 10),
        yearlyPricePerWorker: parseInt(process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_PER_WORKER || '350', 10),
        stripePriceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || '',
        monthlyStripePriceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID_TEST || process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || '',
        yearlyStripePriceId: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID_TEST || process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID || '',
        features: [
          'Everything in Starter',
          'Advanced reporting & analytics',
          'Invoicing & payroll',
          'Priority support',
          'API access',
          '11-50 workers',
        ],
      },
      business: {
        name: 'Business',
        minWorkers: parseInt(process.env.STRIPE_BUSINESS_MIN_WORKERS || '51', 10),
        maxWorkers: parseInt(process.env.STRIPE_BUSINESS_MAX_WORKERS || '200', 10),
        monthlyPricePerWorker: parseInt(process.env.STRIPE_BUSINESS_MONTHLY_PRICE_PER_WORKER || '300', 10),
        yearlyPricePerWorker: parseInt(process.env.STRIPE_BUSINESS_YEARLY_PRICE_PER_WORKER || '250', 10),
        stripePriceId: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
        monthlyStripePriceId: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID || '',
        yearlyStripePriceId: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID || '',
        features: [
          'Everything in Professional',
          'Compliance management',
          'Custom integrations',
          'Dedicated account manager',
          'Phone support',
          '51-200 workers',
        ],
      },
      enterprise: {
        name: 'Enterprise',
        minWorkers: parseInt(process.env.STRIPE_ENTERPRISE_MIN_WORKERS || '201', 10),
        maxWorkers: parseInt(process.env.STRIPE_ENTERPRISE_MAX_WORKERS || '-1', 10),
        monthlyPricePerWorker: null, // custom pricing
        yearlyPricePerWorker: null,
        stripePriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
        monthlyStripePriceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || '',
        yearlyStripePriceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || '',
        isCustomPricing: true,
        features: [
          'Everything in Business',
          'White-label branding',
          'Custom SLA',
          'On-site training',
          'Volume discounts',
          '200+ workers - Contact sales',
        ],
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
