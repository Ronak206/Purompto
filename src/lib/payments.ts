// Payment Gateway Configuration for Prompty
// Supports: PayPal, Google Pay, PayTM

export type PaymentProvider = "paypal" | "gpay" | "paytm";

export interface PaymentConfig {
  provider: PaymentProvider;
  enabled: boolean;
  sandbox: boolean;
  credentials: {
    clientId?: string;
    secret?: string;
    merchantId?: string;
    apiKey?: string;
  };
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  planId: string;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  error?: string;
}

// Get payment config from environment
export function getPaymentConfig(provider: PaymentProvider): PaymentConfig {
  const sandbox = process.env.PAYMENT_SANDBOX === "true";

  switch (provider) {
    case "paypal":
      return {
        provider: "paypal",
        enabled: !!process.env.PAYPAL_CLIENT_ID,
        sandbox,
        credentials: {
          clientId: process.env.PAYPAL_CLIENT_ID,
          secret: process.env.PAYPAL_SECRET,
        },
      };

    case "gpay":
      return {
        provider: "gpay",
        enabled: !!process.env.GOOGLE_PAY_MERCHANT_ID,
        sandbox,
        credentials: {
          merchantId: process.env.GOOGLE_PAY_MERCHANT_ID,
          apiKey: process.env.GOOGLE_PAY_API_KEY,
        },
      };

    case "paytm":
      return {
        provider: "paytm",
        enabled: !!process.env.PAYTM_MERCHANT_ID,
        sandbox,
        credentials: {
          merchantId: process.env.PAYTM_MERCHANT_ID,
          apiKey: process.env.PAYTM_API_KEY,
          secret: process.env.PAYTM_SECRET,
        },
      };

    default:
      return {
        provider,
        enabled: false,
        sandbox: true,
        credentials: {},
      };
  }
}

// Get all enabled payment providers
export function getEnabledPaymentProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = ["paypal", "gpay", "paytm"];
  return providers.filter((p) => getPaymentConfig(p).enabled);
}

// Pricing plans
export const PRICING_PLANS = {
  pro: {
    name: "Pro",
    price: 19,
    currency: "USD",
    description: "For professionals who need more power",
    features: [
      "Unlimited prompts",
      "Advanced AI analysis",
      "Full prompt history (50 prompts)",
      "Export to PDF/Word",
      "Priority support",
      "Custom templates",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: 49,
    currency: "USD",
    description: "For teams and businesses",
    features: [
      "Everything in Pro",
      "Team collaboration (5 seats)",
      "API access",
      "Custom branding",
      "Dedicated support",
      "SSO authentication",
    ],
  },
};

// Create PayPal order
export async function createPayPalOrder(request: PaymentRequest): Promise<PaymentResponse> {
  const config = getPaymentConfig("paypal");

  if (!config.enabled || !config.credentials.clientId) {
    return { success: false, error: "PayPal is not configured" };
  }

  const baseUrl = config.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  try {
    // Get access token
    const auth = Buffer.from(
      `${config.credentials.clientId}:${config.credentials.secret}`
    ).toString("base64");

    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create order
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: request.currency,
              value: request.amount.toString(),
            },
            description: `Prompty ${request.planId} subscription`,
          },
        ],
        application_context: {
          return_url: request.successUrl,
          cancel_url: request.cancelUrl,
        },
      }),
    });

    const orderData = await orderResponse.json();

    return {
      success: true,
      paymentId: orderData.id,
      redirectUrl: orderData.links?.find((l: { rel: string; href: string }) => l.rel === "approve")?.href,
    };
  } catch (error) {
    console.error("PayPal order creation failed:", error);
    return { success: false, error: "Failed to create PayPal order" };
  }
}

// Create PayTM order
export async function createPayTMOrder(request: PaymentRequest): Promise<PaymentResponse> {
  const config = getPaymentConfig("paytm");

  if (!config.enabled || !config.credentials.merchantId) {
    return { success: false, error: "PayTM is not configured" };
  }

  // Generate unique order ID
  const orderId = `PROMPTY_${Date.now()}_${request.userId.slice(0, 8)}`;

  // PayTM payment parameters
  const paytmParams = {
    MID: config.credentials.merchantId,
    ORDER_ID: orderId,
    CUST_ID: request.userId,
    TXN_AMOUNT: request.amount.toString(),
    CHANNEL_ID: "WEB",
    INDUSTRY_TYPE_ID: "Retail",
    WEBSITE: config.sandbox ? "WEBSTAGING" : "DEFAULT",
    CALLBACK_URL: request.successUrl,
    EMAIL: request.email,
  };

  // In production, you would generate checksum here
  // For demo, return the order ID
  return {
    success: true,
    paymentId: orderId,
    redirectUrl: config.sandbox
      ? `https://securegw-stage.paytm.in/theia/processTransaction`
      : `https://securegw.paytm.in/theia/processTransaction`,
  };
}

// Create Google Pay request
export function createGooglePayRequest(request: PaymentRequest): PaymentResponse {
  const config = getPaymentConfig("gpay");

  if (!config.enabled || !config.credentials.merchantId) {
    return { success: false, error: "Google Pay is not configured" };
  }

  // Google Pay is typically handled on the frontend
  // Return configuration for the frontend to use
  return {
    success: true,
    paymentId: `GPAY_${Date.now()}`,
    redirectUrl: request.successUrl,
  };
}
