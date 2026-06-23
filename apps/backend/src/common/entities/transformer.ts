import { decode, encode } from '@xobj/core';

type BlobTransformValue = object | string | number | boolean | null;

export const blobJSONTransformer = {
  to: (value: BlobTransformValue | undefined) => (value ? Buffer.from(encode(value)) : undefined),
  from: (value: Buffer): BlobTransformValue | null => {
    if (value?.length) return decode(new Uint8Array(value).buffer) as BlobTransformValue;
    return null;
  },
};
