-- 为 shop_configs 表添加支付说明字段
ALTER TABLE public.shop_configs ADD COLUMN IF NOT EXISTS payment_notice text DEFAULT '⚠️ 超时订单将自动取消并删除
⚠️付款转账精确到小数点后面数值
⚠️虚拟货币转账不包含扣除的手续费
下面举个例子👇币安
例：金额10.12TRX+手续费1TRX=11.12TRX
tokenpocket（简称TP）
直接付金额10.12TRX（手续费扣余额）
币安充TRX提现到你的TP钱包
付错额度不会发货联系人工客服处理
虚拟货币转账使用能量租赁不会回调发货
✅ 支付成功后将自动发货到此对话';