# Stripe Payment Integration Setup

StaffSync uses Stripe for subscription billing and payment processing.

## Pricing Structure

| Plan | Price | Description |
|------|-------|-------------|
| **FREE** | £0 | 180-day free trial with full access |
| **STANDARD** | £500/month | Full platform access after trial |
| **ENTERPRISE** | Custom | Contact sales for negotiated pricing |

---

## Step 1: Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign up or log in
3. Complete business verification (for live payments)

---

## Step 2: Get API Keys

1. Go to **Developers > API Keys**
2. Copy your keys:

```env
# Test mode (for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Live mode (for production)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

> ⚠️ Never commit secret keys to version control!

---

## Step 3: Create Products & Prices

### In Stripe Dashboard:

1. Go to **Products > Add Product**

2. **Create Standard Plan:**
   - Name: `StaffSync Standard`
   - Description: `Full platform access - unlimited workers & clients`
   - Pricing:
     - Monthly: £500/month (recurring)
     - Yearly: £5,000/year (recurring) - 2 months free

3. Copy the Price IDs:

```env
STRIPE_STANDARD_MONTHLY_PRICE_ID=price_1ABC...
STRIPE_STANDARD_YEARLY_PRICE_ID=price_1DEF...
```

### Using Stripe CLI (Alternative):

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Create product
stripe products create \
  --name="StaffSync Standard" \
  --description="Full platform access"

# Create monthly price (£500)
stripe prices create \
  --product=prod_XXX \
  --unit-amount=50000 \
  --currency=gbp \
  --recurring[interval]=month

# Create yearly price (£5000)
stripe prices create \
  --product=prod_XXX \
  --unit-amount=500000 \
  --currency=gbp \
  --recurring[interval]=year
```

---

## Step 4: Configure Webhooks

Webhooks notify your backend of payment events.

### Development (Local):

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to localhost
stripe listen --forward-to localhost:3001/api/v1/subscription/webhook
```

Copy the webhook signing secret:
```
Ready! Your webhook signing secret is whsec_...
```

Add to `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Production:

1. Go to **Developers > Webhooks > Add endpoint**
2. Endpoint URL: `https://api.yourdomain.com/api/v1/subscription/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.trial_will_end`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `checkout.session.completed`

4. Copy the signing secret to your production environment.

---

## Step 5: Environment Variables

Add all variables to your `.env` file:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# Price IDs
STRIPE_STANDARD_MONTHLY_PRICE_ID=price_xxx
STRIPE_STANDARD_YEARLY_PRICE_ID=price_xxx

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```

---

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/subscription/plans` | Get available plans |
| POST | `/api/v1/subscription/webhook` | Stripe webhook handler |

### Authenticated
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/subscription` | Get current subscription |
| GET | `/api/v1/subscription/trial` | Get trial status |
| GET | `/api/v1/subscription/limits` | Get usage limits |
| GET | `/api/v1/subscription/payment-methods` | List payment methods |
| GET | `/api/v1/subscription/invoices` | Get invoice history |

### Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/subscription/checkout` | Create checkout session |
| POST | `/api/v1/subscription` | Create subscription |
| PUT | `/api/v1/subscription` | Update subscription |
| POST | `/api/v1/subscription/cancel` | Cancel subscription |
| POST | `/api/v1/subscription/resume` | Resume subscription |
| POST | `/api/v1/subscription/billing-portal` | Get Stripe billing portal |
| POST | `/api/v1/subscription/setup-intent` | Add payment method |
| POST | `/api/v1/subscription/enterprise-request` | Request enterprise plan |

---

## Frontend Integration

### 1. Checkout Flow

```typescript
// Request checkout session from backend
const response = await fetch('/api/v1/subscription/checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    planTier: 'STANDARD',
    billingCycle: 'monthly', // or 'yearly'
  }),
});

const { data } = await response.json();

// Redirect to Stripe Checkout
window.location.href = data.url;
```

### 2. Billing Portal

```typescript
// Get billing portal URL
const response = await fetch('/api/v1/subscription/billing-portal', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    returnUrl: window.location.href,
  }),
});

const { data } = await response.json();

// Redirect to Stripe Portal
window.location.href = data.url;
```

### 3. Display Trial Status

```typescript
// Get trial status
const response = await fetch('/api/v1/subscription/trial', {
  headers: { 'Authorization': `Bearer ${token}` },
});

const { data } = await response.json();

if (data.isTrialing) {
  console.log(`Trial ends in ${data.daysRemaining} days`);
}
```

---

## Testing

### Test Card Numbers

| Card | Number | Use Case |
|------|--------|----------|
| Visa | `4242 4242 4242 4242` | Successful payment |
| Visa (Declined) | `4000 0000 0000 0002` | Card declined |
| 3D Secure | `4000 0025 0000 3155` | Requires authentication |

Use any future expiry date and any 3-digit CVC.

### Test Webhooks Locally

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:3001/api/v1/subscription/webhook

# Terminal 3: Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

---

## Going Live

1. **Complete Stripe account verification**
2. **Switch to live API keys**
3. **Create live products/prices**
4. **Configure live webhooks**
5. **Test with real cards (small amounts)**
6. **Update environment variables in production**

```env
# Production
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

---

## Troubleshooting

### Webhook Signature Errors
- Ensure `STRIPE_WEBHOOK_SECRET` matches webhook endpoint
- Check webhook is receiving raw body (not parsed JSON)

### Payment Failures
- Check Stripe Dashboard > Payments for details
- Verify price IDs are correct
- Ensure customer has valid payment method

### Trial Not Starting
- Verify subscription is created with `planTier: 'FREE'`
- Check `trialEnd` date is set correctly

---

## Support

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
