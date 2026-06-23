/// <reference types="vite/client" />

declare namespace Env {
  interface ImportMeta {
    readonly VITE_BASE_URL: string;
    readonly VITE_API_BASE: string;
    readonly VITE_TENANT_ID: string;
    readonly VITE_DEV_API_PROXY?: string;
    readonly VITE_FEATURE_O2O?: string;
    readonly VITE_FEATURE_DISTRIBUTION?: string;
    readonly VITE_FEATURE_LBS?: string;
    readonly VITE_FEATURE_WALLET?: string;
    readonly VITE_FEATURE_FINANCE_SETTLEMENT?: string;
  }
}

interface ImportMeta {
  readonly env: Env.ImportMeta;
}
