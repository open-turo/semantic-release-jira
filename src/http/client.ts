/**
 * Resilient HTTP client factory with timeouts, retries, and connection pooling
 */

import axios, { type AxiosError, type AxiosInstance } from "axios";
import axiosRetry, {
  exponentialDelay,
  isNetworkOrIdempotentRequestError,
} from "axios-retry";
import http from "node:http";
import https from "node:https";

import { getPackageInfo } from "~/utils.js";

export interface HttpClientConfig {
  baseURL: string;
  concurrency?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Creates a resilient HTTP client with:
 * - Configurable timeouts (default: 30s)
 * - Automatic retries with exponential backoff (default: 3 attempts)
 * - Connection pooling with keep-alive
 * - Rate limit handling (429 responses)
 * - Credential sanitization in errors (defense in depth)
 */
export function createResilientHttpClient(
  config: HttpClientConfig,
): AxiosInstance {
  const packageInfo = getPackageInfo();

  const client = axios.create({
    baseURL: config.baseURL,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `semantic-release-jira/${packageInfo.version}`,
      ...config.headers,
    },
    // HTTP agent with connection pooling
    httpAgent: new http.Agent({
      keepAlive: true,
      maxSockets: config.concurrency ?? 10,
    }),
    // HTTPS agent with connection pooling
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: config.concurrency ?? 10,
    }),
    timeout: config.timeout ?? 30_000, // 30 second default timeout
  });

  // Add retry logic with exponential backoff
  axiosRetry(client, {
    retries: config.retries ?? 3,
    retryCondition: (error) => {
      // Retry on network errors, idempotent request errors, rate limits, and server errors
      return (
        isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429 || // Rate limit
        (error.response?.status ?? 0) >= 500 // Server errors
      );
    },
    retryDelay: (retryCount) => {
      const baseDelay = config.retryDelay ?? 1000;
      return exponentialDelay(retryCount, undefined, baseDelay);
    },
  });

  // Add credential sanitization interceptor (defense in depth)
  // This prevents credentials from appearing in error objects even before logging
  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.config) {
        // Sanitize Authorization headers in error config (case-insensitive)
        if (error.config.headers) {
          const headers = error.config.headers;
          if (headers.Authorization || headers.authorization) {
            headers.Authorization = "[REDACTED]";
            headers.authorization = "[REDACTED]";
          }
        }

        // Sanitize auth object if present (not actual credential storage, just error sanitization)
        if (error.config.auth) {
          error.config.auth = {
            password: "[REDACTED]",
            username: "[REDACTED]",
          };
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}
