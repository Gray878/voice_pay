/**
 * 简单的 TypeScript 类型定义验证脚本
 * 检查 types.ts 文件的基本语法
 */

const fs = require('fs');
const path = require('path');

const typesFile = path.join(__dirname, 'types.ts');
const content = fs.readFileSync(typesFile, 'utf-8');

console.log('验证 TypeScript 类型定义文件...\n');

// 检查必需的枚举类型
const requiredEnums = ['IntentType', 'PaymentState', 'TxStatus'];
const requiredInterfaces = ['Product', 'Transaction', 'User', 'UserSession'];

let allChecksPass = true;

// 检查枚举
console.log('检查枚举类型:');
requiredEnums.forEach(enumName => {
  const regex = new RegExp(`export enum ${enumName}`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${enumName} 已定义`);
  } else {
    console.log(`  ✗ ${enumName} 未找到`);
    allChecksPass = false;
  }
});

console.log('\n检查接口:');
requiredInterfaces.forEach(interfaceName => {
  const regex = new RegExp(`export interface ${interfaceName}`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${interfaceName} 已定义`);
  } else {
    console.log(`  ✗ ${interfaceName} 未找到`);
    allChecksPass = false;
  }
});

// 检查 IntentType 枚举值
console.log('\n检查 IntentType 枚举值:');
const intentValues = ['QUERY', 'PURCHASE', 'CONFIRM', 'CANCEL', 'HELP', 'HISTORY'];
intentValues.forEach(value => {
  const regex = new RegExp(`${value}\\s*=\\s*"`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${value} 已定义`);
  } else {
    console.log(`  ✗ ${value} 未找到`);
    allChecksPass = false;
  }
});

// 检查 PaymentState 枚举值
console.log('\n检查 PaymentState 枚举值:');
const paymentStates = ['IDLE', 'WALLET_SELECTION', 'TRANSACTION_PREVIEW', 'USER_CONFIRMATION', 
                       'SIGNING', 'BROADCASTING', 'CONFIRMING', 'COMPLETED', 'FAILED'];
paymentStates.forEach(value => {
  const regex = new RegExp(`${value}\\s*=\\s*"`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${value} 已定义`);
  } else {
    console.log(`  ✗ ${value} 未找到`);
    allChecksPass = false;
  }
});

// 检查 TxStatus 枚举值
console.log('\n检查 TxStatus 枚举值:');
const txStatuses = ['PENDING', 'CONFIRMED', 'FAILED'];
txStatuses.forEach(value => {
  const regex = new RegExp(`${value}\\s*=\\s*"`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${value} 已定义`);
  } else {
    console.log(`  ✗ ${value} 未找到`);
    allChecksPass = false;
  }
});

// 检查 Product 接口的必需字段
console.log('\n检查 Product 接口字段:');
const productFields = ['id', 'name', 'description', 'category', 'price', 'currency', 
                       'chain', 'contractAddress', 'metadata', 'createdAt', 'updatedAt'];
productFields.forEach(field => {
  const regex = new RegExp(`${field}[?:]`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${field} 已定义`);
  } else {
    console.log(`  ✗ ${field} 未找到`);
    allChecksPass = false;
  }
});

// 检查 Transaction 接口的必需字段
console.log('\n检查 Transaction 接口字段:');
const transactionFields = ['id', 'userId', 'sessionId', 'productId', 'txHash', 'status', 
                          'chain', 'fromAddress', 'toAddress', 'value', 'gasFee', 
                          'createdAt', 'confirmedAt'];
transactionFields.forEach(field => {
  const regex = new RegExp(`${field}[?:]`, 'g');
  if (regex.test(content)) {
    console.log(`  ✓ ${field} 已定义`);
  } else {
    console.log(`  ✗ ${field} 未找到`);
    allChecksPass = false;
  }
});

console.log('\n' + '='.repeat(50));
if (allChecksPass) {
  console.log('✓ 所有检查通过！类型定义完整。');
  process.exit(0);
} else {
  console.log('✗ 部分检查失败，请检查类型定义。');
  process.exit(1);
}
