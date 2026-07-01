import type { SmsProviderAdapter, SmsResult } from "../types";

/**
 * İletim Merkezi SMS Adapter
 * REST JSON API kullanır.
 */
export const iletimMerkeziAdapter: SmsProviderAdapter = {
  async sendSms({ phone, message, apiKey, apiSecret, senderId }): Promise<SmsResult> {
    const url = "https://api.iletimerkezi.com/v1/send-sms/get/";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: {
            authentication: {
              key: apiKey,
              hash: apiSecret || "",
            },
            order: {
              sender: senderId,
              message: {
                text: message,
                receipents: {
                  number: [phone.replace(/\+/g, "")],
                },
              },
            },
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      const statusCode = (data as any)?.response?.status?.code;
      const success = statusCode === "200" || statusCode === 200 || res.ok;

      return {
        success,
        providerResponse: { ...data, httpStatus: res.status },
        errorMessage: success ? undefined : `İletim Merkezi hatası: ${JSON.stringify(data)}`,
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
