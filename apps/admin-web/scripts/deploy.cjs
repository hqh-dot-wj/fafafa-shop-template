#!/usr/bin/env node

/**
 * 前端部署脚本
 * 功能：
 * 1. 打包前端项目
 * 2. 备份服务器上的旧文件
 * 3. 上传新的 dist 文件到服务器
 * 4. 清理临时文件
 *
 * 使用方法：
 * node deploy.js [env]
 * 例如：node deploy.js dev
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { Client } = require('ssh2');
const ora = require('ora');
const chalk = require('chalk');
const compressing = require('compressing');

// 项目根目录（脚本在 scripts 目录中，需要访问上一级目录）
const projectRoot = path.resolve(__dirname, '..');

// 读取配置文件
const deployConfig = require('./deploy.config.cjs');

// 获取命令行参数
const env = process.argv[2] || 'dev';
const config = deployConfig[env];

if (!config) {
  console.log(chalk.red(`❌ 未找到 ${env} 环境配置`));
  console.log(chalk.yellow('可用环境：'), Object.keys(deployConfig).join(', '));
  process.exit(1);
}

const conn = new Client();
let spinner;

// 格式化时间
function formatTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

// 执行本地命令
function execCommand(command, description) {
  spinner = ora(description).start();
  try {
    execSync(command, { stdio: 'inherit', cwd: projectRoot });
    spinner.succeed(chalk.green(`✓ ${description}`));
    return true;
  } catch (error) {
    spinner.fail(chalk.red(`✗ ${description} 失败`));
    console.error(error);
    return false;
  }
}

// 执行远程命令
function execRemoteCommand(command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream
        .on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
          } else {
            resolve(stdout);
          }
        })
        .on('data', (data) => {
          stdout += data.toString();
        })
        .stderr.on('data', (data) => {
          stderr += data.toString();
        });
    });
  });
}

// 上传文件到服务器
function uploadFile(localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err);
        return;
      }

      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

// 主部署流程
async function deploy() {
  console.log(chalk.blue('='.repeat(50)));
  console.log(chalk.blue(`开始部署到 ${config.name}`));
  console.log(chalk.blue('='.repeat(50)));
  console.log('');

  // 1. 打包前端项目
  console.log(chalk.cyan('📦 步骤 1: 打包前端项目'));
  const buildSuccess = execCommand('pnpm run build', '正在打包前端项目...');

  if (!buildSuccess) {
    console.log(chalk.red('打包失败，部署终止'));
    process.exit(1);
  }

  // 2. 检查 dist 目录是否存在
  const distPath = path.join(projectRoot, config.distPath);
  if (!fs.existsSync(distPath)) {
    console.log(chalk.red(`❌ 打包目录不存在: ${distPath}`));
    process.exit(1);
  }

  // 3. 压缩 dist 目录
  console.log('');
  console.log(chalk.cyan('📦 步骤 2: 压缩文件'));
  const zipFileName = `dist_${formatTime()}.tar.gz`;
  const zipFilePath = path.join(projectRoot, zipFileName);

  spinner = ora('正在压缩文件...').start();
  try {
    await compressing.tgz.compressDir(distPath, zipFilePath);
    spinner.succeed(chalk.green('✓ 文件压缩完成'));
  } catch (error) {
    spinner.fail(chalk.red('✗ 文件压缩失败'));
    console.error(error);
    process.exit(1);
  }

  // 4. 连接服务器
  console.log('');
  console.log(chalk.cyan('🔗 步骤 3: 连接服务器'));
  spinner = ora(`正在连接 ${config.host}...`).start();

  const connectionConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
  };

  // 优先使用私钥，其次使用密码
  if (config.privateKey) {
    connectionConfig.privateKey = fs.readFileSync(config.privateKey);
    if (config.passphrase) {
      connectionConfig.passphrase = config.passphrase;
    }
  } else if (config.password) {
    connectionConfig.password = config.password;
  } else {
    spinner.fail(chalk.red('✗ 未配置登录凭证（密码或私钥）'));
    fs.unlinkSync(zipFilePath);
    process.exit(1);
  }

  conn
    .on('ready', async () => {
      spinner.succeed(chalk.green('✓ 服务器连接成功'));

      try {
        // 5. 备份旧文件
        if (config.isBackup) {
          console.log('');
          console.log(chalk.cyan('💾 步骤 4: 备份旧文件'));
          spinner = ora('正在备份...').start();

          const backupFileName = `backup_${formatTime()}.tar.gz`;
          const backupFullPath = `${config.backupPath}/${backupFileName}`;

          try {
            // 创建备份目录
            await execRemoteCommand(`mkdir -p ${config.backupPath}`);

            // 检查远程目录是否存在
            const checkCmd = `[ -d "${config.remotePath}" ] && echo "exists" || echo "not exists"`;
            const checkResult = await execRemoteCommand(checkCmd);

            if (checkResult.trim() === 'exists') {
              // 备份现有文件
              await execRemoteCommand(`cd ${config.remotePath} && tar -czf ${backupFullPath} . 2>/dev/null || true`);
              spinner.succeed(chalk.green('✓ 备份完成'));
            } else {
              spinner.info(chalk.yellow('⚠ 远程目录不存在，跳过备份'));
            }
          } catch (error) {
            spinner.warn(chalk.yellow('⚠ 备份失败，继续部署'));
            console.error(error.message);
          }
        }

        // 6. 上传压缩包
        console.log('');
        console.log(chalk.cyan('📤 步骤 5: 上传文件'));
        spinner = ora('正在上传...').start();

        const remoteZipPath = `/tmp/${zipFileName}`;
        await uploadFile(zipFilePath, remoteZipPath);

        spinner.succeed(chalk.green('✓ 文件上传完成'));

        // 7. 解压文件
        console.log('');
        console.log(chalk.cyan('📂 步骤 6: 部署文件'));
        spinner = ora('正在部署...').start();

        // 创建远程目录
        await execRemoteCommand(`mkdir -p ${config.remotePath}`);

        // 清空目标目录
        await execRemoteCommand(`rm -rf ${config.remotePath}/*`);

        // 解压文件到目标目录（去除第一层 dist 目录）
        await execRemoteCommand(`tar -xzf ${remoteZipPath} -C ${config.remotePath} --strip-components=1`);

        // 删除临时压缩包
        await execRemoteCommand(`rm -f ${remoteZipPath}`);

        spinner.succeed(chalk.green('✓ 文件部署完成'));

        // 8. 清理本地临时文件
        console.log('');
        console.log(chalk.cyan('🧹 步骤 7: 清理临时文件'));
        fs.unlinkSync(zipFilePath);
        console.log(chalk.green('✓ 清理完成'));

        // 部署完成
        console.log('');
        console.log(chalk.blue('='.repeat(50)));
        console.log(chalk.green('🎉 部署成功！'));
        console.log(chalk.blue('='.repeat(50)));
        console.log('');
        console.log(chalk.gray('环境：'), chalk.white(config.name));
        console.log(chalk.gray('服务器：'), chalk.white(config.host));
        console.log(chalk.gray('部署路径：'), chalk.white(config.remotePath));
        console.log('');

        conn.end();
        process.exit(0);
      } catch (error) {
        if (spinner) {
          spinner.fail(chalk.red('✗ 部署失败'));
        }
        console.error(chalk.red('错误信息：'), error.message);

        // 清理临时文件
        if (fs.existsSync(zipFilePath)) {
          fs.unlinkSync(zipFilePath);
        }

        conn.end();
        process.exit(1);
      }
    })
    .on('error', (err) => {
      spinner.fail(chalk.red('✗ 服务器连接失败'));
      console.error(chalk.red('错误信息：'), err.message);

      // 清理临时文件
      if (fs.existsSync(zipFilePath)) {
        fs.unlinkSync(zipFilePath);
      }

      process.exit(1);
    })
    .connect(connectionConfig);
}

// 执行部署
deploy();
