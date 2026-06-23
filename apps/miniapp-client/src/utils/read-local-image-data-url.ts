/**
 * 将本地图片路径读成 data URL（供注册时 `avatarImageBase64` 上传）
 * 依赖 `uni.getImageInfo` 得到可读路径，仅小程序端打包资源/临时文件适用。
 */
export function readLocalImagePathAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    uni.getImageInfo({
      src,
      success: (info) => {
        const fs = uni.getFileSystemManager();
        fs.readFile({
          filePath: info.path,
          encoding: 'base64',
          success: (r) => {
            const lower = src.toLowerCase();
            const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const b64 = typeof r.data === 'string' ? r.data : '';
            resolve(`data:${mime};base64,${b64}`);
          },
          fail: (err) => reject(err),
        });
      },
      fail: (err) => reject(err),
    });
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error('当前端不支持本地头像读取'));
    // #endif
  });
}
