export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
}

export interface Business {
  id: string
  name: string
}

export interface User {
  id: string
  name: string
  email: string
}

export type BidStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
export type LineItemType = 'labor' | 'material' | 'other'

export interface BidLineItem {
  id: string
  bid_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  assigned_sub_id?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Bid {
  id: string
  title: string
  description?: string
  estimated_amount: number
  status: BidStatus
  contractor_id: string
  customer_name: string
  customer_email: string
  customer_phone?: string
  job_address?: string
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  expires_at?: string
  sent_at?: string
  accepted_at?: string
  rejected_at?: string
  created_at: string
  updated_at: string
  line_items?: BidLineItem[]
  daysUntilExpiration?: number
}

export interface CreateBidInput {
  customer_name: string
  customer_email: string
  customer_phone?: string
  job_address?: string
  title: string
  description?: string
  taxRate: number
  lineItems: CreateLineItemInput[]
}

export interface CreateLineItemInput {
  description: string
  type: LineItemType
  quantity: number
  unit: string
  unitPrice: number
}

export interface UpdateBidInput {
  title?: string
  notes?: string
  terms?: string
  taxRate?: number
  lineItems?: CreateLineItemInput[]
}

export interface BidFilters {
  status?: BidStatus
  customerId?: string
  businessId?: string
  createdBy?: string
}
