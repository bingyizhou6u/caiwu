#!/usr/bin/env node
/**
 * 批量优化错误处理脚本 - 增强版 v2
 * 将所有 return c.json({ error: ... }, status) 替换为统一错误处理
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要处理的文件列表
const filesToProcess = [
  'master-data.ts',
  'import.ts',
  'employee-allowances.ts',
  'fixed-assets.ts',
  'borrowings.ts',
  'account-transfers.ts',
  'allowance-payments.ts',
  'salary-payments.ts',
  'ip-whitelist.ts',
  'site-config.ts',
  'position-permissions.ts',
  'system-config.ts',
  'site-bills.ts',
  'rental.ts',
  'audit.ts',
];

function processFile(filePath) {
  console.log(`处理文件: ${path.basename(filePath)}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // 检查是否已导入 Errors
  if (!content.includes("import { Errors }")) {
    // 查找最后一个 import 语句
    const importRegex = /^import .+$/gm;
    const imports = content.match(importRegex) || [];
    const lastImport = imports[imports.length - 1];
    
    if (lastImport) {
      const insertIndex = content.lastIndexOf(lastImport) + lastImport.length;
      const importLine = lastImport.includes('errors') 
        ? '' 
        : "\nimport { Errors } from '../utils/errors.js'";
      content = content.slice(0, insertIndex) + importLine + content.slice(insertIndex);
    }
  }
  
  // ========== 1. 权限错误 (403) ==========
  content = content.replace(/return c\.json\(\{ error:\s*['"]forbidden['"]\s*\},\s*403\)/g, 'throw Errors.FORBIDDEN()');
  content = content.replace(/return c\.json\(\{ error:\s*['"]只有总部人员可以查看报表['"]\s*\},\s*403\)/g, "throw Errors.FORBIDDEN('只有总部人员可以查看报表')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]employee can only confirm their own salary['"]\s*\},\s*403\)/g, "throw Errors.FORBIDDEN('员工只能确认自己的工资')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]employee can only request allocation for their own salary['"]\s*\},\s*403\)/g, "throw Errors.FORBIDDEN('员工只能为自己的工资申请分配')");
  
  // ========== 2. 验证错误 (400) - 常见模式 ==========
  // 必填字段
  content = content.replace(/return c\.json\(\{ error:\s*['"]name required['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('name参数必填')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]department_id and name required['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('department_id和name参数必填')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]file required['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('文件必填')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]voucher_url required \(凭证上传是必填的\)['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('voucher_url参数必填（凭证上传是必填的）')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]yearly_rent_cents required for yearly rent['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('年租模式需要yearly_rent_cents参数')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]monthly_rent_cents required for monthly rent['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('月租模式需要monthly_rent_cents参数')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]department owner requires department_id or site_id['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('department所有者需要提供department_id或site_id')");
  
  // 数值验证
  content = content.replace(/return c\.json\(\{ error:\s*['"]amount_cents must be > 0['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('amount_cents必须大于0')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]settle_amount_cents must be > 0['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('settle_amount_cents必须大于0')");
  
  // 类型验证
  content = content.replace(/return c\.json\(\{ error:\s*['"]kind required AR\|AP['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('kind必须为AR或AP')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]kind must be income\|expense['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('kind必须为income或expense')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]invalid status['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('无效的状态')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]unsupported kind['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('不支持的类型')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]no data rows['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('没有数据行')");
  
  // 文件相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]file too large \(max 10MB\)['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('文件过大（最大10MB）')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]file too large \(max 20MB\)['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('文件过大（最大20MB）')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]只允许上传图片格式（JPEG、PNG、GIF、WebP）['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('只允许上传图片格式（JPEG、PNG、GIF、WebP）')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]请在前端将图片转换为WebP格式后上传['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('请在前端将图片转换为WebP格式后上传')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]只允许上传PDF格式文件['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('只允许上传PDF格式文件')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]no updates['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('没有需要更新的字段')");
  
  // 路径验证
  content = content.replace(/return c\.json\(\{ error:\s*`invalid path:\s*\$\{fullPath\},\s*requestPath:\s*\$\{requestPath\}`\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR(`无效路径: ${fullPath}`)");
  
  // ========== 3. 资源不存在 (404) ==========
  content = content.replace(/return c\.json\(\{ error:\s*['"]not found['"]\s*\},\s*404\)/g, 'throw Errors.NOT_FOUND()');
  content = content.replace(/return c\.json\(\{ error:\s*['"]department not found['"]\s*\},\s*404\)/g, "throw Errors.NOT_FOUND('部门')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]site not found['"]\s*\},\s*404\)/g, "throw Errors.NOT_FOUND('站点')");
  content = content.replace(/return c\.json\(\{ error:\s*`file not found in R2:\s*\$\{fullPath\}`\s*\},\s*404\)/g, "throw Errors.NOT_FOUND('凭证文件')");
  
  // 模板字符串中的资源不存在
  content = content.replace(/return c\.json\(\{ error:\s*`currency \$\{currency\} not found`\s*\},\s*400\)/g, "throw Errors.NOT_FOUND(`币种 ${currency}`)");
  content = content.replace(/return c\.json\(\{ error:\s*`currency \$\{code\} not found`\s*\},\s*400\)/g, "throw Errors.NOT_FOUND(`币种 ${code}`)");
  content = content.replace(/return c\.json\(\{ error:\s*`currency \$\{alloc\.currency_id\} not found`\s*\},\s*400\)/g, "throw Errors.NOT_FOUND(`币种 ${alloc.currency_id}`)");
  
  // ========== 4. 重复错误 (409) ==========
  content = content.replace(/return c\.json\(\{ error:\s*['"]duplicate department name['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('项目名称')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]duplicate name['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('名称')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]duplicate site_code['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('站点代码')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]duplicate name in new department['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('新部门中的名称')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]property_code already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('物业代码')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]payment for this month already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('该月的付款记录')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]employee already allocated to this dormitory['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('员工已分配到该宿舍')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]headquarters configuration disabled['"]\s*\},\s*409\)/g, "throw Errors.BUSINESS_ERROR('总部配置已禁用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]account is inactive['"]\s*\},\s*409\)/g, "throw Errors.BUSINESS_ERROR('账户已停用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]employee is inactive['"]\s*\},\s*409\)/g, "throw Errors.BUSINESS_ERROR('员工已停用')");
  
  // ========== 5. 业务错误 (400) ==========
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete department with sites['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该项目下还有站点')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete account with cash flows['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该账户还有流水记录')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete currency with accounts['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该币种还有账户使用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete category with cash flows['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该类别还有流水记录')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete property with payment records['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该物业还有付款记录')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]document already confirmed['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('单据已确认')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]already returned['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('已归还')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]already paid['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('已支付')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]can only delete pending payments['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('只能删除待处理的付款')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]can only request allocation before finance approval['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('只能在财务审批前申请分配')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]currency allocation must be approved first['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('币种分配必须先获得批准')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]all allocations must be approved['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('所有分配必须已批准')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]total allocation exceeds salary amount['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('总分配金额超过工资金额')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]account currency does not match allocation currency['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('账户币种与分配币种不匹配')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]account currency mismatch['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('账户币种不匹配')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]property is not a dormitory['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('该物业不是宿舍')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]parent department must belong to the same project or headquarters['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('上级部门必须属于同一项目或总部')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot set parent to itself['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('不能将上级部门设置为自己')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot set parent to child department['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('不能将上级部门设置为子部门')");
  
  // ========== 6. 内部错误 (500) ==========
  // catch块中的错误处理
  content = content.replace(/return c\.json\(\{ error:\s*err\.message \|\| '查询失败'\s*\},\s*500\)/g, 
    "if (err && typeof err === 'object' && 'statusCode' in err) throw err\n    throw Errors.INTERNAL_ERROR(err.message || '查询失败')");
  
  // 模板字符串中的错误
  content = content.replace(/return c\.json\(\{ error:\s*`upload failed:\s*\$\{error\.message\}`\s*\},\s*500\)/g, 
    "if (error && typeof error === 'object' && 'statusCode' in error) throw error\n    throw Errors.INTERNAL_ERROR(`上传失败: ${error.message}`)");
  content = content.replace(/return c\.json\(\{ error:\s*`download failed:\s*\$\{error\.message\}`\s*\},\s*500\)/g, 
    "if (error && typeof error === 'object' && 'statusCode' in error) throw error\n    throw Errors.INTERNAL_ERROR(`下载失败: ${error.message}`)");
  
  // ========== 7. 中文错误消息和特殊模式 ==========
  // 账户转账相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]转出账户和转入账户不能相同['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('转出账户和转入账户不能相同')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]转出金额必须大于0['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('转出金额必须大于0')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]转入金额必须大于0['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('转入金额必须大于0')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]转出账户不存在或已停用['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('转出账户不存在或已停用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]转入账户不存在或已停用['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('转入账户不存在或已停用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]不同币种转账必须提供汇率['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('不同币种转账必须提供汇率')");
  content = content.replace(/return c\.json\(\{ error:\s*`转入金额与汇率计算结果不一致（.*?）`\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('转入金额与汇率计算结果不一致')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]同币种转账，转出金额和转入金额必须相等['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('同币种转账，转出金额和转入金额必须相等')");
  content = content.replace(/return c\.json\(\{ error:\s*`转出账户余额不足（当前余额：.*?）`\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('转出账户余额不足')");
  
  // IP白名单相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]invalid IP address format \(IPv4 or IPv6 required\)['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('无效的IP地址格式（需要IPv4或IPv6）')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]IP address already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('IP地址')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]ips array required and must not be empty['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('ips数组必填且不能为空')");
  content = content.replace(/return c\.json\(\{ error:\s*`Invalid IP addresses:\s*\$\{invalidIPs\.join\(', '\)\}`\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR(`无效的IP地址: ${invalidIPs.join(', ')}`)");
  content = content.replace(/return c\.json\(\{ error:\s*['"]ids array required and must not be empty['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('ids数组必填且不能为空')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]enabled must be boolean['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('enabled必须是布尔值')");
  
  // Cloudflare相关错误
  content = content.replace(/return c\.json\(\{ error:\s*result\.error \|\| 'failed to add IP to Cloudflare list'\s*\},\s*500\)/g, 
    "if (result && typeof result === 'object' && 'statusCode' in result) throw result\n    throw Errors.INTERNAL_ERROR(result.error || '添加IP到Cloudflare列表失败')");
  content = content.replace(/return c\.json\(\{ error:\s*error\.message \|\| 'internal server error'\s*\},\s*500\)/g, 
    "if (error && typeof error === 'object' && 'statusCode' in error) throw error\n    throw Errors.INTERNAL_ERROR(error.message || '服务器内部错误')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]failed to remove IP from Cloudflare list['"]\s*\},\s*500\)/g, "throw Errors.INTERNAL_ERROR('从Cloudflare列表移除IP失败')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]failed to create rule['"]\s*\},\s*500\)/g, "throw Errors.INTERNAL_ERROR('创建规则失败')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]failed to toggle rule['"]\s*,\s*details:\s*['"].*?['"]\s*\},\s*500\)/g, "throw Errors.INTERNAL_ERROR('切换规则状态失败')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]internal server error['"]\s*,\s*details:\s*error\?\.message \|\| 'Unknown error'\s*\},\s*500\)/g, 
    "if (error && typeof error === 'object' && 'statusCode' in error) throw error\n    throw Errors.INTERNAL_ERROR(error?.message || '服务器内部错误')");
  
  // 职位权限相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]position code already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('职位代码')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]no fields to update['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('没有需要更新的字段')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete position that is assigned to employees['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给员工')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete position that is assigned to users['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该职位已分配给用户')");
  
  // 固定资产相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]asset_code already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('资产代码')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete asset with depreciation records['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('无法删除，该资产还有折旧记录')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]depreciation exceeds purchase price['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('折旧金额超过购买价格')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]asset already sold['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('资产已出售')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]account currency mismatch with asset currency['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('账户币种与资产币种不匹配')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]can only allocate assets in use or idle['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('只能分配使用中或闲置的资产')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]asset already allocated and not returned['"]\s*\},\s*409\)/g, "throw Errors.BUSINESS_ERROR('资产已分配且未归还')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]asset already returned['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('资产已归还')");
  
  // 借款相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]user is inactive['"]\s*\},\s*409\)/g, "throw Errors.BUSINESS_ERROR('用户已停用')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]currency mismatch with borrowing['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('币种与借款币种不匹配')");
  
  // 工资支付相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]allocation not requested['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('分配未申请')");
  
  // 站点配置相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]config_value must be a string['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('config_value必须是字符串')");
  
  // 角色权限相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]invalid role['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('无效的角色')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]cannot delete role permissions, only update allowed['"]\s*\},\s*400\)/g, "throw Errors.BUSINESS_ERROR('不能删除角色权限，只能更新')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]unauthorized['"]\s*\},\s*401\)/g, "throw Errors.UNAUTHORIZED('未授权')");
  
  // 站点账单相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]bill_type must be income or expense['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('bill_type必须为income或expense')");
  
  // 津贴支付相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]missing required fields['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('缺少必填字段')");
  content = content.replace(/return c\.json\(\{ error:\s*['"]allowance payment already exists['"]\s*\},\s*409\)/g, "throw Errors.DUPLICATE('津贴支付记录')");
  
  // 员工津贴相关
  content = content.replace(/return c\.json\(\{ error:\s*['"]allowances must be an array['"]\s*\},\s*400\)/g, "throw Errors.VALIDATION_ERROR('allowances必须是数组')");
  
  // 系统配置相关
  content = content.replace(/return c\.json\(\{ error:\s*err\.message \|\| '更新失败'\s*\},\s*500\)/g, 
    "if (err && typeof err === 'object' && 'statusCode' in err) throw err\n    throw Errors.INTERNAL_ERROR(err.message || '更新失败')");
  
  // ========== 8. 通用模式处理 ==========
  // 处理其他 require 模式
  content = content.replace(/return c\.json\(\{ error:\s*['"](.+?) required['"]\s*\},\s*400\)/g, (match, p1) => {
    const msgMap = {
      'start,end': 'start和end',
      'doc_id': 'doc_id',
      'flow_id': 'flow_id',
      'account_id': 'account_id',
      'category_id': 'category_id',
      'biz_date': 'biz_date',
    };
    const mapped = msgMap[p1] || p1;
    return `throw Errors.VALIDATION_ERROR('${mapped}参数必填')`;
  });
  
  // 处理其他 not found 模式
  content = content.replace(/return c\.json\(\{ error:\s*['"](.+?) not found['"]\s*\},\s*404\)/g, (match, p1) => {
    const resourceMap = {
      'user': '用户',
      'employee': '员工',
      'account': '账户',
      'currency': '币种',
      'category': '类别',
      'department': '部门',
      'site': '站点',
      'document': '单据',
    };
    const resource = resourceMap[p1] || p1;
    return `throw Errors.NOT_FOUND('${resource}')`;
  });
  
  // 如果有变化，写回文件
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ 已更新: ${path.basename(filePath)}`);
    return true;
  } else {
    console.log(`- 无需更新: ${path.basename(filePath)}`);
    return false;
  }
}

// 处理所有文件
const routesDir = path.join(__dirname, 'src', 'routes');
let processedCount = 0;
let totalReplacements = 0;

filesToProcess.forEach(file => {
  const filePath = path.join(routesDir, file);
  if (fs.existsSync(filePath)) {
    const before = (fs.readFileSync(filePath, 'utf8').match(/return c\.json\(\{ error:/g) || []).length;
    if (processFile(filePath)) {
      processedCount++;
      const after = (fs.readFileSync(filePath, 'utf8').match(/return c\.json\(\{ error:/g) || []).length;
      const replaced = before - after;
      totalReplacements += replaced;
      console.log(`  替换了 ${replaced} 处错误处理`);
    }
  } else {
    console.log(`✗ 文件不存在: ${filePath}`);
  }
});

console.log(`\n完成! 共处理 ${processedCount} 个文件，替换了约 ${totalReplacements} 处错误处理`);
