import { describe, expect, it } from 'vitest';
import { normalizeMainImagesFromProductDetail } from './normalize-product-main-images';

describe('normalizeMainImagesFromProductDetail', () => {
  it('优先使用 mainImages 数组', () => {
    expect(
      normalizeMainImagesFromProductDetail({
        mainImages: ['https://a.com/1.jpg', '', '  ', 'https://a.com/2.jpg'],
        albumPics: 'ignored',
      }),
    ).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('无 mainImages 时解析 albumPics 逗号串', () => {
    expect(
      normalizeMainImagesFromProductDetail({
        albumPics: ' https://x/1.png , https://x/2.png ',
      }),
    ).toEqual(['https://x/1.png', 'https://x/2.png']);
  });

  it('空数据返回空数组', () => {
    expect(normalizeMainImagesFromProductDetail({})).toEqual([]);
    expect(normalizeMainImagesFromProductDetail({ mainImages: [] })).toEqual([]);
  });
});
