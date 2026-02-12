import { supabase } from '@/lib/supabase';

export type EntityType = 
  | 'sales_order' | 'invoice' | 'payment' | 'customer'
  | 'purchase_order' | 'bill' | 'goods_receipt' | 'supplier'
  | 'product' | 'journal_entry' | 'pos_transaction'
  | 'chart_of_accounts' | 'fixed_asset' | 'stock_transfer'
  | 'stock_opname' | 'down_payment' | 'company';

export type ActionType = 'create' | 'update' | 'delete' | 'confirm' | 'cancel' | 'post' | 'close';

interface LogActivityParams {
  companyId: string;
  userId?: string;
  action: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityNumber?: string;
  description: string;
  changes?: Record<string, { old: any; new: any }>;
}

export const logActivity = async (params: LogActivityParams) => {
  try {
    await supabase.from('activity_logs').insert({
      company_id: params.companyId,
      user_id: params.userId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      entity_number: params.entityNumber || null,
      description: params.description,
      changes: params.changes || null,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

export const getActionLabel = (action: string): string => {
  const labels: Record<string, string> = {
    create: 'Dibuat',
    update: 'Diubah',
    delete: 'Dihapus',
    confirm: 'Dikonfirmasi',
    cancel: 'Dibatalkan',
    post: 'Diposting',
    close: 'Ditutup',
  };
  return labels[action] || action;
};

export const getEntityLabel = (entityType: string): string => {
  const labels: Record<string, string> = {
    sales_order: 'Sales Order',
    invoice: 'Invoice',
    payment: 'Pembayaran',
    customer: 'Customer',
    purchase_order: 'Purchase Order',
    bill: 'Bill',
    goods_receipt: 'Penerimaan Barang',
    supplier: 'Supplier',
    product: 'Produk',
    journal_entry: 'Jurnal',
    pos_transaction: 'Transaksi POS',
    chart_of_accounts: 'Akun',
    fixed_asset: 'Aset Tetap',
    stock_transfer: 'Transfer Stok',
    stock_opname: 'Stock Opname',
    down_payment: 'Down Payment',
    company: 'Perusahaan',
  };
  return labels[entityType] || entityType;
};
