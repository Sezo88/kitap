import type { CustomAdapterParams, SmsResult } from "../types";

/**
 * Generic/Custom SMS Adapter
 * İdareci kendi URL, header şablonu, body şablonu girebilir.
 * Yer tutucular: {phone}, {message}, {api_key}, {api_secret}, {sender_id}
 */
function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

export async function customAdapterSendSms(params: CustomAdapterParams): Promise<SmsResult> {
  const { phone, message, apiKey, apiSecret, senderId, apiBaseUrl, httpMethod, headerTemplate, bodyTemplate } = params;

  const vars: Record<string, string> = {
    phone: phone.replace(/\+/g, ""),
    phone_plus: phone, // +90XXXXXXXXXX formatında
    message,
    api_key: apiKey,
    api_secret: apiSecret || "",
    sender_id: senderId,
  };

  try {
    // Headers
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (headerTemplate) {
      for (const [key, val] of Object.entries(headerTemplate)) {
        headers[key] = replacePlaceholders(val, vars);
      }
    }

    // Body
    let fetchOptions: RequestInit = { method: httpMethod, headers };

    if (httpMethod === "POST" && bodyTemplate) {
      fetchOptions.body = replacePlaceholders(bodyTemplate, vars);
    }

    // URL — GET ise query parametreleri varsa body template'i URL'e ekle
    let url = apiBaseUrl;
    if (httpMethod === "GET" && bodyTemplate) {
      // Body template'i URL query string olarak parse et
      const queryStr = replacePlaceholders(bodyTemplate, vars);
      url = `${apiBaseUrl}?${queryStr}`;
    }

    const res = await fetch(url, fetchOptions);
    const text = await res.text();

    let jsonData: Record<string, unknown> | null = null;
    try {
      jsonData = JSON.parse(text);
    } catch {
      // JSON değilse düz metin olarak sakla
    }

    return {
      success: res.ok,
      providerResponse: jsonData ?? { raw: text, httpStatus: res.status },
      errorMessage: res.ok ? undefined : `HTTP ${res.status}: ${text.substring(0, 200)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      providerResponse: { error: err.message },
      errorMessage: `Bağlantı hatası: ${err.message}`,
    };
  }
}
