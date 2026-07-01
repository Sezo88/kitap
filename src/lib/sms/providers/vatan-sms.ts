import type { SmsProviderAdapter, SmsResult } from "../types";

/**
 * Vatan SMS Adapter
 * HTTP GET API kullanır.
 */
export const vatanSmsAdapter: SmsProviderAdapter = {
  async sendSms({ phone, message, apiKey, apiSecret, senderId }): Promise<SmsResult> {
    const url = "https://api.vatansms.net/api/v1/1toN";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          api_id: apiKey,
          api_key: apiSecret || "",
          sender: senderId,
          message_type: "normal",
          message: message,
          message_content_type: "bilgi",
          phones: [phone.replace(/\+/g, "")],
        }),
      });

      const data = await res.json().catch(() => ({}));
      const success = res.ok && (data as any)?.status !== false;

      return {
        success,
        providerResponse: { ...data, httpStatus: res.status },
        errorMessage: success ? undefined : `Vatan SMS hatası: ${JSON.stringify(data)}`,
      };
    } catch (err: any) {
      return {
        success: false,
        providerResponse: { error: err.message },
        errorMessage: `Bağlantı hatası: ${err.message}`,
      };
    }
  },
};
