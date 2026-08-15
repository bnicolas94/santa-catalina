export type CrmPermission = 'permisoAtencion' | 'permisoAtencionAdmin'

export type ConversationStatus =
  | 'UNASSIGNED'
  | 'OPEN'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'ARCHIVED'

export type MessageDirection = 'INBOUND' | 'OUTBOUND' | 'INTERNAL'

export type MessageDeliveryStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export interface CrmSessionUser {
  id: string
  name: string
  email?: string | null
  rol: string
  permisos: Partial<Record<CrmPermission, boolean>>
}

export interface CustomerSummary {
  crmContactId: string
  erpClientId?: string | null
  displayName: string
  phoneE164: string
  waId: string
  commercialName?: string | null
  zone?: string | null
}

export interface ConversationLock {
  activeById: string
  activeByName: string
  token: string
  expiresAt: string
  version: number
}

export interface ConversationSummary {
  id: string
  status: ConversationStatus
  customer: CustomerSummary
  assignedToId?: string | null
  assignedToName?: string | null
  lock?: ConversationLock | null
  lastMessagePreview: string
  lastMessageAt: string
  unreadCount: number
  priority: number
  serviceWindowExpiresAt?: string | null
  tags: string[]
}

export interface SendMessageRequest {
  conversationId: string
  lockToken: string
  clientMessageId: string
  type: 'TEXT'
  text: string
}

export interface ClaimConversationResponse {
  conversationId: string
  assignedToId: string
  lock: ConversationLock
}

export interface ApiErrorResponse {
  error: string
  code: string
  correlationId?: string
}
