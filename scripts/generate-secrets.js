#!/usr/bin/env node

/**
 * シークレット生成スクリプト
 *
 * JWT_SECRETとENCRYPTION_KEYを生成します
 */

const crypto = require('crypto');

console.log('='.repeat(60));
console.log('Hermes シークレット生成');
console.log('='.repeat(60));
console.log('');

// JWT_SECRET生成（64文字のランダムな16進数文字列）
const jwtSecret = crypto.randomBytes(32).toString('hex');
console.log('JWT_SECRET:');
console.log(jwtSecret);
console.log('');

// ENCRYPTION_KEY生成（AES-256-GCM用の32バイト、base64エンコード）
const encryptionKey = crypto.randomBytes(32).toString('base64');
console.log('ENCRYPTION_KEY:');
console.log(encryptionKey);
console.log('');

console.log('='.repeat(60));
console.log('使用方法:');
console.log('='.repeat(60));
console.log('');
console.log('【ローカル開発】.dev.vars ファイルに追加:');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log('');
console.log('【本番環境】以下のコマンドを実行:');
console.log('');
console.log(`echo "${jwtSecret}" | wrangler secret put JWT_SECRET`);
console.log(`echo "${encryptionKey}" | wrangler secret put ENCRYPTION_KEY`);
console.log('');
console.log('='.repeat(60));
