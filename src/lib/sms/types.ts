/**
 * SMS Sağlayıcı Adapter Arayüzü
 * Her SMS sağlayıcısı bu arayüzü implement eder.
 */

export interface SmsResult {
  success: boolean;
  providerResponse?: Record<string, unknown>;
  errorMessage?: string;
}

export interface SmsProviderAdapter {
  sendSms(params: {
    phone: string;
    message: string;
    apiKey: string;
    apiSecret?: string | null;
    senderId: string;
    apiBaseUrl?: string | null;
  }): Promise<SmsResult>;
}

/**
 * Custom/Generic adapter için ek parametreler
 */
export interface CustomAdapterParams {
  phone: string;
  message: string;
  apiKey: string;
  apiSecret?: string | null;
  senderId: string;
  apiBaseUrl: string;
  httpMethod: "GET" | "POST";
  headerTemplate?: Record<string, string> | null;
  bodyTemplate?: string | null;
}
