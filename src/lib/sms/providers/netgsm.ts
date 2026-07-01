import type { SmsProviderAdapter, SmsResult } from "../types";

/**
 * Netgsm SMS Adapter
 * Dökümantasyon: https://www.netgsm.com.tr/dokuman/
 * XML tabanlı API kullanır.
 */
export const netgsmAdapter: SmsProviderAdapter = {
  async sendSms({ phone, message, apiKey, apiSecret, senderId }): Promise<SmsResult> {
    // Netgsm usercode = apiKey, password = apiSecret şeklinde çalışır
    const url = "https://api.netgsm.com.tr/sms/send/get";

    const params = new URLSearchParams({
      usercode: apiKey,
      password: apiSecret || "",
      gsmno: phone.replace(/\+/g, ""),
      message: message,
      msgheader: senderId,
      dil: "TR",
    });

    try {
      const res = await fetch(`${url}?${params.toString()}`, { method: "GET" });
      const text = await res.text();

      // Netgsm başarılı yanıt: "00 XXXX" (00 = başarılı, XXXX = mesaj ID)
      const success = text.trim().startsWith("00");

      return {
        success,
        providerResponse: { raw: text.trim(), statusCode: res.status },
        errorMessage: success ? undefined : `Netgsm hatası: ${text.trim()}`,
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
