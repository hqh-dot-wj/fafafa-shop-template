/**
 * Backend OpenAPI 契约源路径判定（与 apps/backend/src/bootstrap/openapi-contract-paths.ts 保持同步）。
 */
export const OPENAPI_CONTRACT_PATH_PATTERNS = [
  /^apps\/backend\/src\/.+\/controller\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/controllers\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/dto\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/vo\/.+\.ts$/,
  /^apps\/backend\/src\/.+\.controller\.ts$/,
  /^apps\/backend\/src\/.+\.dto\.ts$/,
  /^apps\/backend\/src\/.+\.vo\.ts$/,
];

/** @param {string} file repo 相对路径或 src 下相对路径（含 apps/backend/src/ 或 module/...） */
export function isOpenApiContractSource(file) {
  const normalized = file.replace(/\\/g, '/');
  if (OPENAPI_CONTRACT_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  // bootstrap 扫描使用 src 相对路径
  return (
    /\/controller\/.+\.ts$/.test(normalized) ||
    /\/controllers\/.+\.ts$/.test(normalized) ||
    /\/dto\/.+\.ts$/.test(normalized) ||
    /\/vo\/.+\.ts$/.test(normalized) ||
    /\.controller\.ts$/.test(normalized) ||
    /\.dto\.ts$/.test(normalized) ||
    /\.vo\.ts$/.test(normalized)
  );
}

/** @deprecated 使用 isOpenApiContractSource */
export const isTriggerFile = isOpenApiContractSource;
