/**
 * OpenAPI 契约源路径判定。规则须与 scripts/tasks/openapi-contract-paths.mjs 保持一致。
 */
const SRC_CONTRACT_PATTERNS: RegExp[] = [
  /\/controller\/.+\.ts$/,
  /\/controllers\/.+\.ts$/,
  /\/dto\/.+\.ts$/,
  /\/vo\/.+\.ts$/,
  /\.controller\.ts$/,
  /\.dto\.ts$/,
  /\.vo\.ts$/,
];

const REPO_CONTRACT_PATTERNS: RegExp[] = [
  /^apps\/backend\/src\/.+\/controller\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/controllers\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/dto\/.+\.ts$/,
  /^apps\/backend\/src\/.+\/vo\/.+\.ts$/,
  /^apps\/backend\/src\/.+\.controller\.ts$/,
  /^apps\/backend\/src\/.+\.dto\.ts$/,
  /^apps\/backend\/src\/.+\.vo\.ts$/,
];

export function isOpenApiContractSource(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (REPO_CONTRACT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  return SRC_CONTRACT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isSkippableSourceScanFile(fileName: string): boolean {
  return (
    fileName.endsWith('.spec.ts') ||
    fileName.endsWith('.test.ts') ||
    fileName === 'metadata.ts'
  );
}
