export const COMMISSION_EMAIL_LABELS = {
  legacy: '未安排邮件', disabled: '投递时邮件未启用', unconfigured: '投递时未配置收件人',
  pending: '待发送', sending: '发送中', sent: '已交付邮件服务器', partial: '部分交付',
  failed: '发送失败', cancelled: '已取消',
} as const

export const COMMISSION_EMAIL_ERRORS = {
  AUTH: '邮箱认证失败，请检查服务端账号与授权码。',
  REJECTED: '邮件服务器拒收，请核对收件地址及服务商限制。',
  TOO_LARGE: '邮件大小被拒绝，设定图未能交付，请联系维护人员。',
  CONNECTION: '邮件服务器连接异常，系统将按重试上限处理。',
  ATTACHMENT: '私有设定图读取失败，请检查附件后重试。',
  UNKNOWN: '邮件发送异常，请联系维护人员。',
} as const
