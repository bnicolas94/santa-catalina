'use client'

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationStatus, CrmOrderItem, CrmSessionUser, CustomerContextResponse, ErpCustomerCandidate, ErpOrderDetails, ErpPickupLocation, ErpProductCatalogItem } from '@santa-catalina/contracts'

type ApiTag = { id: string; name: string; color: string }
type ApiQuickReply = { id: string; shortcut: string; title: string; body: string; active: boolean }
type QuickReplyForm = { id: string | null; shortcut: string; title: string; body: string; active: boolean }
type ApiContact = { id: string; displayName: string; profileName: string | null; phoneE164: string }
type ApiMessage = { id: string; type: string; caption: string | null; direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL'; body: string | null; status: 'RECEIVED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'; sentById: string | null; providerTimestamp: string | null; createdAt: string }
type ConversationSummary = { id: string; status: ConversationStatus; priority: number; assignedToId: string | null; activeById: string | null; lockExpiresAt: string | null; unreadCount: number; lastMessageAt: string; serviceWindowExpiresAt: string | null; contact: ApiContact; tags: ApiTag[]; lastMessage: ApiMessage | null }
type MessageSync = { id: string; status: ConversationStatus; unreadCount: number; lastMessageAt: string; lastInboundAt: string | null; lastOutboundAt: string | null; serviceWindowExpiresAt: string | null; messages: ApiMessage[] }
type ReadResult = { read: boolean; retry: boolean; providerMarked: boolean }
type OrderDraft = { orderDate: string; orderAddress: string; orderFulfillment: 'DELIVERY' | 'PICKUP' | null; orderPickupLocationId: string | null; orderPickupLocationName: string; orderShift: 'MORNING' | 'SIESTA' | 'AFTERNOON' | null; orderPaid: boolean; orderItems: CrmOrderItem[]; orderNotes: string; orderDraftUpdatedAt?: string | null }
type ScheduledOrder = { id: string; orderDate: string; orderAddress: string | null; orderFulfillment: 'DELIVERY' | 'PICKUP'; orderPickupLocationId: string | null; orderPickupLocationName: string | null; orderShift: 'MORNING' | 'SIESTA' | 'AFTERNOON'; orderPaid: boolean; orderItems: CrmOrderItem[]; orderNotes: string | null; scheduledById: string; scheduledByName: string; scheduledAt: string }
type ConversationDetail = ConversationSummary & { messages: ApiMessage[]; scheduledOrders: ScheduledOrder[]; orderDate: string | null; orderAddress: string | null; orderFulfillment: OrderDraft['orderFulfillment']; orderPickupLocationId: string | null; orderPickupLocationName: string | null; orderShift: OrderDraft['orderShift']; orderPaid: boolean; orderItems: CrmOrderItem[]; orderNotes: string | null; orderDraftUpdatedAt: string | null }
type Lock = { token: string; expiresAt: string; version: number; activeById: string; assignedToId: string }
type FilterId = 'all' | 'mine' | 'unassigned' | 'waiting' | 'resolved'
type ConversationCounts = Record<FilterId, number> & { unreadConversations: number; unreadMessages: number }

const DEMO_AGENT_NAMES: Record<string, string> = { 'agent-marina': 'Marina Soto', 'agent-lucia': 'Lucía Rojas', 'agent-admin': 'Administración' }
const FILTERS: Array<{ id: FilterId; label: string; short: string }> = [
  { id: 'all', label: 'Todas las conversaciones', short: 'Todas' }, { id: 'mine', label: 'Mis conversaciones', short: 'Mías' },
  { id: 'unassigned', label: 'Sin asignar', short: 'Nuevas' }, { id: 'waiting', label: 'En espera', short: 'Espera' },
  { id: 'resolved', label: 'Resueltas', short: 'Cerradas' },
]
const EMPTY_ORDER_DRAFT: OrderDraft = { orderDate: '', orderAddress: '', orderFulfillment: null, orderPickupLocationId: null, orderPickupLocationName: '', orderShift: null, orderPaid: false, orderItems: [], orderNotes: '', orderDraftUpdatedAt: null }
const EMPTY_QUICK_REPLY_FORM: QuickReplyForm = { id: null, shortcut: '', title: '', body: '', active: true }

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    inbox: <><path d="M4 5h16v12H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>, chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, check: <path d="m5 12 4 4L19 6"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2M9 21H5v-4l-2-2 2-3-2-3 3-3 3 2 3-2 3 2 3-1 2 3-2 3"/></>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    back: <path d="m15 18-6-6 6-6"/>, attach: <path d="m21 12-9 9a6 6 0 0 1-9-9l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 1 1-3-3l8-8"/>, smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s2 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>, lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, archive: <><path d="M4 7h16v14H4zM3 3h18v4H3z"/><path d="M9 12h6"/></>, bag: <><path d="M6 8h12l1 13H5z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    phone: <path d="M22 17v3a2 2 0 0 1-2 2 20 20 0 0 1-9-3 20 20 0 0 1-6-6A20 20 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2l1 3-2 3a16 16 0 0 0 6 6l3-2 3 1a2 2 0 0 1 2 2z"/>, note: <><path d="M4 3h16v18H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    tag: <><path d="M20 13 13 20l-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>, map: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></>, truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>, store: <><path d="M4 10v11h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 21v-6h6v6"/></>, money: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.5-1.7-.8-2.8-.8-1.5 0-2.7.7-2.7 1.9 0 3.2 5.5 1.3 5.5 4.5 0 1.2-1.2 2.1-3 2.1-1.2 0-2.4-.4-3.2-1.1M12 6v12"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'SC' }
function agentName(id?: string | null) { return id ? DEMO_AGENT_NAMES[id] || 'Otro agente' : '' }
function formatTime(value: string) { return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value)) }
function localDayKey(value: string) { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
function formatMessageDay(value: string) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (localDayKey(value) === localDayKey(today.toISOString())) return 'Hoy'
  if (localDayKey(value) === localDayKey(yesterday.toISOString())) return 'Ayer'
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' }).format(date)
}
function formatOrderDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day)) }
function formatScheduledAt(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatLongDate(value: string) { return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(value)) }
function formatMoney(value: number) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value) }
function shiftName(value: ScheduledOrder['orderShift']) { return value === 'MORNING' ? 'Mañana' : value === 'SIESTA' ? 'Siesta' : 'Tarde' }
function orderStatus(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'entregado') return 'Entregado'
  if (normalized === 'cancelado') return 'Cancelado'
  if (normalized === 'en_preparacion' || normalized === 'preparando') return 'En preparación'
  return normalized === 'pendiente' ? 'Pendiente' : value
}
function serviceWindow(value: string | null) {
  if (!value) return { expired: true, text: 'Ventana no disponible' }
  const remaining = new Date(value).getTime() - Date.now()
  if (remaining <= 0) return { expired: true, text: 'Ventana de servicio vencida · usá una plantilla aprobada' }
  return { expired: false, text: `Ventana de respuesta abierta · ${Math.floor(remaining / 3_600_000)} h ${Math.floor((remaining % 3_600_000) / 60_000)} min restantes` }
}
function localDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function orderDraftFromConversation(conversation: ConversationDetail): OrderDraft {
  return {
    orderDate: conversation.orderDate || '',
    orderAddress: conversation.orderAddress || '',
    orderFulfillment: conversation.orderFulfillment,
    orderPickupLocationId: conversation.orderPickupLocationId,
    orderPickupLocationName: conversation.orderPickupLocationName || '',
    orderShift: conversation.orderShift,
    orderPaid: conversation.orderPaid,
    orderItems: Array.isArray(conversation.orderItems) ? conversation.orderItems : [],
    orderNotes: conversation.orderNotes || '',
    orderDraftUpdatedAt: conversation.orderDraftUpdatedAt,
  }
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.')
  return body as T
}
function Avatar({ name, color = '#a3152f', small = false }: { name: string; color?: string; small?: boolean }) {
  return <span className={`avatar ${small ? 'avatarSmall' : ''}`} style={{ '--avatar-color': color } as React.CSSProperties}>{initials(name)}</span>
}
function messagePreview(message: ApiMessage | null) {
  if (!message) return 'Sin mensajes'
  if (message.type === 'IMAGE') return `📷 ${message.caption || 'Foto'}`
  return message.body || (message.type === 'AUDIO' ? '🎤 Audio' : message.type === 'VIDEO' ? '🎬 Video' : message.type === 'DOCUMENT' ? '📎 Documento' : 'Mensaje sin texto')
}

function ChatImage({ conversationId, message, onLoad }: { conversationId: string; message: ApiMessage; onLoad: () => void }) {
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const url = `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(message.id)}/image`
  return <div className="chatImageContent">{failed ? <div className="chatImageError"><strong>No se pudo cargar la foto</strong><span>El archivo puede haber vencido o el proveedor no respondió.</span><button type="button" onClick={() => { setFailed(false); setRetry(value => value + 1) }}>Reintentar</button></div> : <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir imagen en tamaño completo">
    {/* La ruta autenticada entrega el archivo privado; no se usa el optimizador público de imágenes. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={retry} src={`${url}?retry=${retry}`} alt={message.caption || 'Foto recibida por WhatsApp'} onError={() => setFailed(true)} onLoad={onLoad} />
  </a>}{message.caption && <p>{message.caption}</p>}</div>
}

export default function AttentionWorkspace() {
  const [user, setUser] = useState<CrmSessionUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [serverCounts, setServerCounts] = useState<ConversationCounts | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [lock, setLock] = useState<Lock | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [draft, setDraft] = useState('')
  const [allTags, setAllTags] = useState<ApiTag[]>([])
  const [quickReplies, setQuickReplies] = useState<ApiQuickReply[]>([])
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [tagBusyId, setTagBusyId] = useState<string | null>(null)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplyIndex, setQuickReplyIndex] = useState(0)
  const [quickReplyManagerOpen, setQuickReplyManagerOpen] = useState(false)
  const [managedQuickReplies, setManagedQuickReplies] = useState<ApiQuickReply[]>([])
  const [quickReplyForm, setQuickReplyForm] = useState<QuickReplyForm>(EMPTY_QUICK_REPLY_FORM)
  const [quickReplyManagerLoading, setQuickReplyManagerLoading] = useState(false)
  const [quickReplyManagerBusy, setQuickReplyManagerBusy] = useState(false)
  const [quickReplyManagerError, setQuickReplyManagerError] = useState<string | null>(null)
  const [showContext, setShowContext] = useState(true)
  const [customerContext, setCustomerContext] = useState<CustomerContextResponse | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextBusy, setContextBusy] = useState(false)
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(EMPTY_ORDER_DRAFT)
  const [pickupLocations, setPickupLocations] = useState<ErpPickupLocation[]>([])
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(true)
  const [pickupLocationsError, setPickupLocationsError] = useState(false)
  const [orderCatalog, setOrderCatalog] = useState<ErpProductCatalogItem[]>([])
  const [orderCatalogLoading, setOrderCatalogLoading] = useState(true)
  const [orderCatalogError, setOrderCatalogError] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [variantPicker, setVariantPicker] = useState<{ productId: string; presentationId: string } | null>(null)
  const [orderModal, setOrderModal] = useState<{ loading: boolean; detail: ErpOrderDetails | null; error: string | null } | null>(null)
  const [scheduledOrderModal, setScheduledOrderModal] = useState<ScheduledOrder | null>(null)
  const [orderDraftDirty, setOrderDraftDirty] = useState(false)
  const [orderSaveState, setOrderSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [schedulingOrder, setSchedulingOrder] = useState(false)
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null)
  const [mobileChat, setMobileChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [markingAllRead, setMarkingAllRead] = useState(false)
  const [listFeedback, setListFeedback] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef<Lock | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const messageCanvasRef = useRef<HTMLDivElement | null>(null)
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const tagMenuRef = useRef<HTMLDivElement | null>(null)
  const messageSyncBusyRef = useRef(false)
  const shouldScrollMessagesRef = useRef(true)
  const orderDraftVersionRef = useRef(0)
  const scheduleActionIdRef = useRef<string | null>(null)

  const refreshList = useCallback(async () => {
    const params = new URLSearchParams({ view: filter })
    if (deferredSearch.trim()) params.set('q', deferredSearch.trim())
    const items = await api<ConversationSummary[]>(`/api/conversations?${params}`)
    setConversations(items)
  }, [deferredSearch, filter])
  const refreshCounts = useCallback(async () => {
    setServerCounts(await api<ConversationCounts>('/api/conversations/counts'))
  }, [])
  const refreshQuickReplies = useCallback(async () => {
    setQuickReplies(await api<ApiQuickReply[]>('/api/quick-replies'))
  }, [])
  useEffect(() => {
    Promise.all([api<CrmSessionUser>('/api/session'), refreshCounts()]).then(([session]) => setUser(session)).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo iniciar Atención.')).finally(() => setLoading(false))
  }, [refreshCounts])
  useEffect(() => {
    refreshList().catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la bandeja.'))
  }, [refreshList])
  useEffect(() => {
    api<ApiTag[]>('/api/tags').then(setAllTags).catch(() => setAllTags([]))
    refreshQuickReplies().catch(() => setQuickReplies([]))
  }, [refreshQuickReplies])
  useEffect(() => {
    if (!showTagMenu) return
    const close = (event: PointerEvent) => {
      if (!tagMenuRef.current?.contains(event.target as Node)) setShowTagMenu(false)
    }
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setShowTagMenu(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeWithEscape)
    }
  }, [showTagMenu])
  const refreshPickupLocations = useCallback(async () => {
    setPickupLocationsLoading(true)
    try {
      setPickupLocations(await api<ErpPickupLocation[]>('/api/pickup-locations'))
      setPickupLocationsError(false)
    } catch {
      setPickupLocationsError(true)
    } finally {
      setPickupLocationsLoading(false)
    }
  }, [])
  const refreshOrderCatalog = useCallback(async () => {
    setOrderCatalogLoading(true)
    try {
      setOrderCatalog(await api<ErpProductCatalogItem[]>('/api/order-catalog'))
      setOrderCatalogError(false)
    } catch {
      setOrderCatalogError(true)
    } finally {
      setOrderCatalogLoading(false)
    }
  }, [])
  useEffect(() => { void refreshPickupLocations() }, [refreshPickupLocations])
  useEffect(() => { void refreshOrderCatalog() }, [refreshOrderCatalog])
  useEffect(() => { const timer = window.setInterval(() => refreshList().catch(() => undefined), 4_000); return () => window.clearInterval(timer) }, [refreshList])
  useEffect(() => { const timer = window.setInterval(() => refreshCounts().catch(() => undefined), 15_000); return () => window.clearInterval(timer) }, [refreshCounts])
  useEffect(() => {
    if (!orderModal && !scheduledOrderModal && !quickReplyManagerOpen) return
    const closeModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOrderModal(null)
      setScheduledOrderModal(null)
      setQuickReplyManagerOpen(false)
    }
    window.addEventListener('keydown', closeModal)
    return () => window.removeEventListener('keydown', closeModal)
  }, [orderModal, quickReplyManagerOpen, scheduledOrderModal])

  const refreshCustomerContext = useCallback(async (conversationId: string) => {
    setContextLoading(true)
    try {
      setCustomerContext(await api<CustomerContextResponse>(`/api/conversations/${conversationId}/customer-context`))
    } catch {
      setCustomerContext({ status: 'UNAVAILABLE', candidates: [], message: 'El contexto comercial no está disponible por el momento.' })
    } finally {
      setContextLoading(false)
    }
  }, [])
  useEffect(() => {
    if (!activeId) return
    setCustomerContext(null)
    void refreshCustomerContext(activeId)
  }, [activeId, refreshCustomerContext])

  const acquire = useCallback(async (conversationId: string) => {
    const result = await api<{ lock: Lock }>(`/api/conversations/${conversationId}/claim`, { method: 'POST', body: '{}' })
    return result.lock
  }, [])
  const refreshActiveMessages = useCallback(async (conversationId: string) => {
    if (messageSyncBusyRef.current) return
    messageSyncBusyRef.current = true
    const canvas = messageCanvasRef.current
    const wasNearBottom = !canvas || canvas.scrollHeight - canvas.scrollTop - canvas.clientHeight < 140
    try {
      const synced = await api<MessageSync>(`/api/conversations/${conversationId}/messages`)
      if (activeIdRef.current !== conversationId) return
      let unreadCount = synced.unreadCount
      const currentLock = lockRef.current
      if (unreadCount > 0 && currentLock) {
        const readResult = await api<ReadResult>(`/api/conversations/${conversationId}/read`, {
          method: 'POST', body: JSON.stringify({ lockToken: currentLock.token }),
        }).catch(() => null)
        if (readResult?.read) {
          unreadCount = 0
          void refreshList()
          void refreshCounts()
        }
      }
      setDetail(current => {
        if (!current || current.id !== conversationId) return current
        const previousLastId = current.messages.at(-1)?.id
        const nextLastId = synced.messages.at(-1)?.id
        if (previousLastId !== nextLastId && wasNearBottom) shouldScrollMessagesRef.current = true
        return {
          ...current,
          status: synced.status,
          unreadCount,
          lastMessageAt: synced.lastMessageAt,
          serviceWindowExpiresAt: synced.serviceWindowExpiresAt,
          messages: synced.messages,
        }
      })
    } catch {
      // La actualización general de la bandeja comunicará errores persistentes.
    } finally {
      messageSyncBusyRef.current = false
    }
  }, [refreshCounts, refreshList])
  useEffect(() => {
    if (!activeId) return
    const sync = () => void refreshActiveMessages(activeId)
    const timer = window.setInterval(sync, 2_000)
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') { void refreshList(); void refreshCounts(); sync() } }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [activeId, refreshActiveMessages, refreshCounts, refreshList])
  useEffect(() => {
    if (!detail?.messages.length || !shouldScrollMessagesRef.current) return
    shouldScrollMessagesRef.current = false
    const frame = window.requestAnimationFrame(() => {
      const canvas = messageCanvasRef.current
      if (canvas) canvas.scrollTop = canvas.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [detail?.id, detail?.messages])
  useEffect(() => {
    if (!activeId || !user) return
    let cancelled = false
    orderDraftVersionRef.current += 1
    shouldScrollMessagesRef.current = true
    setError(null); setDetail(null); setLock(null); setShowTagMenu(false); setShowQuickReplies(false); setQuickReplyIndex(0); setDraft(''); setOrderDraft(EMPTY_ORDER_DRAFT); setOrderDraftDirty(false); setOrderSaveState('idle'); setSchedulingOrder(false); setScheduleFeedback(null); setProductSearch(''); setVariantPicker(null); setOrderModal(null); setScheduledOrderModal(null); scheduleActionIdRef.current = null; lockRef.current = null; activeIdRef.current = activeId
    api<ConversationDetail>(`/api/conversations/${activeId}`).then(async conversation => {
      if (cancelled) return
      setDetail(conversation)
      orderDraftVersionRef.current += 1
      setOrderDraft(orderDraftFromConversation(conversation))
      const canAcquire = conversation.status !== 'RESOLVED'
        && conversation.status !== 'ARCHIVED'
        && (!conversation.assignedToId || conversation.assignedToId === user.id)
      if (!canAcquire) return

      const wasUnassigned = !conversation.assignedToId
      if (wasUnassigned) setClaiming(true)
      try {
        const acquired = await acquire(conversation.id)
        if (cancelled) {
          await api(`/api/conversations/${conversation.id}/release`, { method: 'POST', body: JSON.stringify({ lockToken: acquired.token }), keepalive: true }).catch(() => undefined)
          return
        }
        lockRef.current = acquired; setLock(acquired)
        const readResult = await api<ReadResult>(`/api/conversations/${conversation.id}/read`, {
          method: 'POST', body: JSON.stringify({ lockToken: acquired.token }),
        }).catch(() => null)
        if (readResult?.read) { void refreshList(); void refreshCounts() }
        if (wasUnassigned) {
          setDetail({ ...conversation, status: 'OPEN', assignedToId: user.id, activeById: user.id, lockExpiresAt: acquired.expiresAt })
          await refreshList()
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Otro operador tomó esta conversación.')
          if (wasUnassigned) await refreshList()
        }
      } finally {
        if (!cancelled) setClaiming(false)
      }
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo abrir la conversación.') })
    return () => { cancelled = true }
  }, [activeId, user, acquire, refreshCounts, refreshList])
  useEffect(() => {
    if (!lock || !activeId) return
    const timer = window.setInterval(async () => {
      const current = lockRef.current
      if (!current || activeIdRef.current !== activeId) return
      try {
        const result = await api<{ lock: Lock }>(`/api/conversations/${activeId}/heartbeat`, { method: 'POST', body: JSON.stringify({ lockToken: current.token }) })
        lockRef.current = result.lock; setLock(result.lock)
      } catch (cause) { lockRef.current = null; setLock(null); setError(cause instanceof Error ? cause.message : 'Se perdió el control de la conversación.') }
    }, 25_000)
    return () => window.clearInterval(timer)
  }, [lock, activeId])
  const releaseCurrent = useCallback(async () => {
    const currentLock = lockRef.current; const currentId = activeIdRef.current
    if (!currentLock || !currentId) return
    lockRef.current = null; setLock(null)
    await api(`/api/conversations/${currentId}/release`, { method: 'POST', body: JSON.stringify({ lockToken: currentLock.token }), keepalive: true }).catch(() => undefined)
  }, [])
  const closeConversation = useCallback(() => {
    void releaseCurrent()
    activeIdRef.current = null
    setActiveId(null)
    setDetail(null)
    setMobileChat(false)
    setShowTagMenu(false)
    setShowQuickReplies(false)
    setDraft('')
  }, [releaseCurrent])
  useEffect(() => {
    if (!activeId) return
    const closeWithEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || orderModal || scheduledOrderModal || quickReplyManagerOpen || showTagMenu || showQuickReplies) return
      event.preventDefault()
      closeConversation()
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [activeId, closeConversation, orderModal, quickReplyManagerOpen, scheduledOrderModal, showQuickReplies, showTagMenu])
  const selectConversation = async (id: string) => { if (id !== activeId) await releaseCurrent(); setActiveId(id); setMobileChat(true) }
  const linkCustomer = async (candidate: ErpCustomerCandidate) => {
    if (!active) return
    setContextBusy(true)
    try {
      const linked = await api<CustomerContextResponse>(`/api/conversations/${active.id}/customer-context`, {
        method: 'POST',
        body: JSON.stringify({ erpClientId: candidate.id }),
      })
      setCustomerContext(linked)
    } catch (cause) {
      setCustomerContext({ status: 'UNAVAILABLE', candidates: [], message: cause instanceof Error ? cause.message : 'No se pudo vincular el cliente.' })
    } finally {
      setContextBusy(false)
    }
  }
  const sendMessage = async (event: FormEvent) => {
    event.preventDefault(); const text = draft.trim(); if (!text || !detail || !lock) return
    setBusy(true); setError(null)
    try {
      await api(`/api/conversations/${detail.id}/messages`, { method: 'POST', body: JSON.stringify({ text, lockToken: lock.token, clientMessageId: crypto.randomUUID() }) })
      setDraft(''); setShowQuickReplies(false); setQuickReplyIndex(0); setDetail(await api<ConversationDetail>(`/api/conversations/${detail.id}`)); await refreshList()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar el mensaje.') }
    finally { setBusy(false) }
  }
  const toggleConversationTag = async (tag: ApiTag) => {
    if (!detail || tagBusyId) return
    const selected = detail.tags.some(item => item.id === tag.id)
    setTagBusyId(tag.id)
    setError(null)
    try {
      const result = await api<{ tags: ApiTag[] }>(`/api/conversations/${detail.id}/tags`, {
        method: 'PUT', body: JSON.stringify({ tagId: tag.id, selected: !selected }),
      })
      setDetail(current => current && current.id === detail.id ? { ...current, tags: result.tags } : current)
      setConversations(current => current.map(item => item.id === detail.id ? { ...item, tags: result.tags } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la etiqueta.')
    } finally {
      setTagBusyId(null)
    }
  }
  const unassignConversation = async () => {
    if (!detail || !window.confirm(`¿Liberar la conversación de ${detail.contact.displayName}? Volverá a la bandeja de consultas nuevas.`)) return
    setBusy(true); setError(null)
    try {
      await api(`/api/conversations/${detail.id}/unassign`, { method: 'POST', body: '{}' })
      lockRef.current = null; setLock(null)
      setDetail({ ...detail, status: 'UNASSIGNED', assignedToId: null, activeById: null, lockExpiresAt: null })
      await refreshList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo liberar la conversación.')
    } finally {
      setBusy(false)
    }
  }
  const resolveConversation = async () => {
    if (!detail || !window.confirm(`¿Marcar como resuelta la conversación de ${detail.contact.displayName}? El historial se conservará.`)) return
    setBusy(true); setError(null)
    try {
      await api(`/api/conversations/${detail.id}/resolve`, {
        method: 'POST', body: JSON.stringify({ lockToken: lockRef.current?.token || null }),
      })
      lockRef.current = null; setLock(null)
      setDetail(current => current && current.id === detail.id ? { ...current, status: 'RESOLVED', unreadCount: 0, activeById: null, lockExpiresAt: null } : current)
      setConversations(current => current.map(item => item.id === detail.id ? { ...item, status: 'RESOLVED', unreadCount: 0, activeById: null, lockExpiresAt: null } : item))
      setFilter('resolved')
      await refreshList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo resolver la conversación.')
    } finally {
      setBusy(false)
    }
  }
  const archiveConversation = async () => {
    if (!detail || !window.confirm(`¿Archivar la conversación de ${detail.contact.displayName}? Desaparecerá de las bandejas y se reabrirá si el cliente vuelve a escribir.`)) return
    setBusy(true); setError(null)
    try {
      await api(`/api/conversations/${detail.id}/archive`, { method: 'POST', body: '{}' })
      const archivedId = detail.id
      const remaining = conversations.filter(item => item.id !== archivedId)
      const nextResolved = remaining.find(item => item.status === 'RESOLVED')
      const next = nextResolved || remaining.find(item => item.status !== 'ARCHIVED') || null
      if (!nextResolved) setFilter('all')
      lockRef.current = null; activeIdRef.current = next?.id || null
      setLock(null); setDetail(null); setConversations(remaining); setActiveId(next?.id || null)
      await refreshList()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo archivar la conversación.')
    } finally {
      setBusy(false)
    }
  }

  const canEditOrderDraft = Boolean(detail && lock && !schedulingOrder && detail.assignedToId === user?.id && detail.status !== 'RESOLVED' && detail.status !== 'ARCHIVED')
  const changeOrderDraft = useCallback((patch: Partial<OrderDraft>) => {
    if (!canEditOrderDraft) return
    orderDraftVersionRef.current += 1
    setOrderDraft(current => ({ ...current, ...patch }))
    setOrderDraftDirty(true)
    setOrderSaveState('idle')
    setScheduleFeedback(null)
  }, [canEditOrderDraft])
  const linkedAddress = customerContext?.status === 'LINKED' ? customerContext.customer.address?.trim() || '' : ''
  useEffect(() => {
    if (!linkedAddress || !canEditOrderDraft || orderDraft.orderAddress.trim() || orderDraft.orderFulfillment === 'PICKUP') return
    changeOrderDraft({ orderAddress: linkedAddress })
  }, [linkedAddress, canEditOrderDraft, orderDraft.orderAddress, orderDraft.orderFulfillment, changeOrderDraft])
  useEffect(() => {
    if (!orderDraftDirty || !canEditOrderDraft || !detail) return
    const version = orderDraftVersionRef.current
    const timer = window.setTimeout(async () => {
      const currentLock = lockRef.current
      if (!currentLock || activeIdRef.current !== detail.id) return
      setOrderSaveState('saving')
      try {
        const result = await api<{ draft: OrderDraft }>(`/api/conversations/${detail.id}/order-draft`, {
          method: 'PUT',
          body: JSON.stringify({ ...orderDraft, lockToken: currentLock.token }),
        })
        if (orderDraftVersionRef.current !== version) return
        setOrderDraft(current => ({ ...current, orderDraftUpdatedAt: result.draft.orderDraftUpdatedAt }))
        setOrderDraftDirty(false)
        setOrderSaveState('saved')
        setDetail(current => current && current.id === detail.id ? {
          ...current,
          orderDate: result.draft.orderDate || null,
          orderAddress: result.draft.orderAddress || null,
          orderFulfillment: result.draft.orderFulfillment,
          orderPickupLocationId: result.draft.orderPickupLocationId,
          orderPickupLocationName: result.draft.orderPickupLocationName || null,
          orderShift: result.draft.orderShift,
          orderPaid: result.draft.orderPaid,
          orderItems: result.draft.orderItems,
          orderNotes: result.draft.orderNotes || null,
          orderDraftUpdatedAt: result.draft.orderDraftUpdatedAt || null,
        } : current)
      } catch (cause) {
        if (orderDraftVersionRef.current !== version) return
        setOrderSaveState('error')
        setError(cause instanceof Error ? cause.message : 'No se pudo guardar la ficha del pedido.')
      }
    }, 450)
    return () => window.clearTimeout(timer)
  }, [orderDraft, orderDraftDirty, canEditOrderDraft, detail])

  const openHistoricalOrder = async (orderId: string) => {
    if (!detail) return
    setScheduledOrderModal(null)
    setOrderModal({ loading: true, detail: null, error: null })
    try {
      const historicalOrder = await api<ErpOrderDetails>(`/api/conversations/${detail.id}/erp-orders/${encodeURIComponent(orderId)}`)
      setOrderModal({ loading: false, detail: historicalOrder, error: null })
    } catch (cause) {
      setOrderModal({ loading: false, detail: null, error: cause instanceof Error ? cause.message : 'No se pudo abrir el pedido.' })
    }
  }

  const openScheduledOrder = (order: ScheduledOrder) => {
    setOrderModal(null)
    setScheduledOrderModal(order)
  }

  const catalogResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return []
    return orderCatalog.filter(product => `${product.name} ${product.code}`.toLowerCase().includes(term)).slice(0, 6)
  }, [orderCatalog, productSearch])
  const addOrderItem = (product: ErpProductCatalogItem, presentationId: string, variantId?: string) => {
    const presentation = product.presentations.find(item => item.id === presentationId)
    if (!presentation) return
    if (product.variants.length > 0 && presentation.unitsPerPackage !== 8) return
    if (product.variants.length > 0 && !variantId) {
      setVariantPicker({ productId: product.id, presentationId })
      setProductSearch('')
      return
    }
    const variant = variantId ? product.variants.find(item => item.id === variantId) : null
    if (product.variants.length > 0 && !variant) return
    const existing = orderDraft.orderItems.find(item => item.presentationId === presentationId && (item.variantId || null) === (variant?.id || null))
    const items = existing
      ? orderDraft.orderItems.map(item => item.presentationId === presentationId && (item.variantId || null) === (variant?.id || null) ? { ...item, quantity: Math.min(999, item.quantity + 1) } : item)
      : [...orderDraft.orderItems, { productId: product.id, presentationId, productName: product.name, productCode: product.code, unitsPerPackage: presentation.unitsPerPackage, quantity: 1, variantId: variant?.id || null, variantCode: variant?.code || null, variantName: variant?.name || null }]
    changeOrderDraft({ orderItems: items })
    setProductSearch('')
  }
  const changeOrderItemQuantity = (presentationId: string, variantId: string | null | undefined, change: number) => {
    const items = orderDraft.orderItems
      .map(item => item.presentationId === presentationId && (item.variantId || null) === (variantId || null) ? { ...item, quantity: Math.min(999, item.quantity + change) } : item)
      .filter(item => item.quantity > 0)
    changeOrderDraft({ orderItems: items })
  }
  const localCounts = useMemo<ConversationCounts>(() => ({
    all: conversations.filter(c => c.status !== 'RESOLVED').length,
    mine: conversations.filter(c => c.assignedToId === user?.id && c.status !== 'RESOLVED').length,
    unassigned: conversations.filter(c => c.status === 'UNASSIGNED').length,
    waiting: conversations.filter(c => c.status === 'WAITING_CUSTOMER').length,
    resolved: conversations.filter(c => c.status === 'RESOLVED').length,
    unreadConversations: conversations.filter(c => c.status !== 'RESOLVED' && c.unreadCount > 0).length,
    unreadMessages: conversations.reduce((total, c) => total + (c.status !== 'RESOLVED' ? c.unreadCount : 0), 0),
  }), [conversations, user])
  const counts = serverCounts || localCounts
  const visible = conversations
  const matchingQuickReplies = useMemo(() => {
    if (!draft.startsWith('/')) return quickReplies.slice(0, 8)
    const query = draft.slice(1).trim().toLowerCase()
    if (!query) return quickReplies.slice(0, 8)
    return quickReplies.filter(reply => `${reply.shortcut} ${reply.title} ${reply.body}`.toLowerCase().includes(query)).slice(0, 8)
  }, [draft, quickReplies])
  const active = detail || conversations.find(item => item.id === activeId) || null
  const variantPickerProduct = variantPicker ? orderCatalog.find(item => item.id === variantPicker.productId) || null : null
  const variantPickerPresentation = variantPickerProduct?.presentations.find(item => item.id === variantPicker?.presentationId) || null
  const scheduledOrderUnits = scheduledOrderModal?.orderItems.reduce((total, item) => total + (item.quantity * item.unitsPerPackage), 0) || 0
  const assignedToOther = Boolean(active?.assignedToId && active.assignedToId !== user?.id)
  const canReply = Boolean(active && lock && active.assignedToId === user?.id && active.status !== 'RESOLVED' && active.status !== 'ARCHIVED')
  const chooseQuickReply = (reply: ApiQuickReply) => {
    setDraft(reply.body)
    setShowQuickReplies(false)
    setQuickReplyIndex(0)
    window.requestAnimationFrame(() => composerInputRef.current?.focus())
  }
  const openQuickReplies = () => {
    if (!canReply) return
    setDraft('/')
    setQuickReplyIndex(0)
    setShowQuickReplies(true)
    window.requestAnimationFrame(() => composerInputRef.current?.focus())
  }
  const loadManagedQuickReplies = async () => {
    setQuickReplyManagerLoading(true)
    try {
      setManagedQuickReplies(await api<ApiQuickReply[]>('/api/quick-replies?includeInactive=true'))
      setQuickReplyManagerError(null)
    } catch (cause) {
      setQuickReplyManagerError(cause instanceof Error ? cause.message : 'No se pudieron cargar las respuestas rápidas.')
    } finally {
      setQuickReplyManagerLoading(false)
    }
  }
  const openQuickReplyManager = () => {
    setShowQuickReplies(false)
    setQuickReplyForm(EMPTY_QUICK_REPLY_FORM)
    setQuickReplyManagerError(null)
    setQuickReplyManagerOpen(true)
    void loadManagedQuickReplies()
  }
  const saveQuickReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (quickReplyManagerBusy) return
    setQuickReplyManagerBusy(true)
    setQuickReplyManagerError(null)
    try {
      const url = quickReplyForm.id ? `/api/quick-replies/${quickReplyForm.id}` : '/api/quick-replies'
      await api<ApiQuickReply>(url, {
        method: quickReplyForm.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          shortcut: quickReplyForm.shortcut,
          title: quickReplyForm.title,
          body: quickReplyForm.body,
          active: quickReplyForm.active,
        }),
      })
      setQuickReplyForm(EMPTY_QUICK_REPLY_FORM)
      await Promise.all([refreshQuickReplies(), loadManagedQuickReplies()])
    } catch (cause) {
      setQuickReplyManagerError(cause instanceof Error ? cause.message : 'No se pudo guardar la respuesta rápida.')
    } finally {
      setQuickReplyManagerBusy(false)
    }
  }
  const toggleQuickReply = async (reply: ApiQuickReply) => {
    if (quickReplyManagerBusy) return
    setQuickReplyManagerBusy(true)
    setQuickReplyManagerError(null)
    try {
      await api<ApiQuickReply>(`/api/quick-replies/${reply.id}`, { method: 'PUT', body: JSON.stringify({ active: !reply.active }) })
      await Promise.all([refreshQuickReplies(), loadManagedQuickReplies()])
    } catch (cause) {
      setQuickReplyManagerError(cause instanceof Error ? cause.message : 'No se pudo cambiar el estado de la respuesta.')
    } finally {
      setQuickReplyManagerBusy(false)
    }
  }
  const deleteQuickReply = async (reply: ApiQuickReply) => {
    if (quickReplyManagerBusy || !window.confirm(`¿Eliminar definitivamente la respuesta /${reply.shortcut}?`)) return
    setQuickReplyManagerBusy(true)
    setQuickReplyManagerError(null)
    try {
      await api<{ deleted: boolean }>(`/api/quick-replies/${reply.id}`, { method: 'DELETE' })
      if (quickReplyForm.id === reply.id) setQuickReplyForm(EMPTY_QUICK_REPLY_FORM)
      await Promise.all([refreshQuickReplies(), loadManagedQuickReplies()])
    } catch (cause) {
      setQuickReplyManagerError(cause instanceof Error ? cause.message : 'No se pudo eliminar la respuesta.')
    } finally {
      setQuickReplyManagerBusy(false)
    }
  }
  const markAllAsRead = async () => {
    if (markingAllRead || counts.unreadConversations === 0) return
    const confirmed = window.confirm(`¿Marcar como leídas las ${counts.unreadConversations} conversaciones pendientes del CRM? No se borrarán chats ni mensajes.`)
    if (!confirmed) return

    setMarkingAllRead(true)
    setListFeedback(null)
    setError(null)
    try {
      const result = await api<{ updated: number }>('/api/conversations/read-all', { method: 'POST', body: '{}' })
      await Promise.all([refreshList(), refreshCounts()])
      setListFeedback(result.updated > 0 ? `${result.updated} conversaciones marcadas como leídas.` : 'No había conversaciones pendientes.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron marcar las conversaciones como leídas.')
    } finally {
      setMarkingAllRead(false)
    }
  }
  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (showQuickReplies) {
      if (event.key === 'Escape') {
        event.preventDefault()
        setShowQuickReplies(false)
        return
      }
      if (matchingQuickReplies.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        setQuickReplyIndex(current => (current + direction + matchingQuickReplies.length) % matchingQuickReplies.length)
        return
      }
      if (matchingQuickReplies.length > 0 && (event.key === 'Enter' && !event.shiftKey || event.key === 'Tab')) {
        event.preventDefault()
        chooseQuickReply(matchingQuickReplies[Math.min(quickReplyIndex, matchingQuickReplies.length - 1)])
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }
  const service = serviceWindow(active?.serviceWindowExpiresAt || null)
  const currentName = user?.name || 'Agente de Atención'
  const isSupervisor = user?.rol === 'ADMIN' || user?.permisos.permisoAtencionAdmin === true
  const canResolveActive = Boolean(active && active.status !== 'RESOLVED' && active.status !== 'ARCHIVED' && (isSupervisor || canReply))
  const canArchiveActive = Boolean(active && active.status === 'RESOLVED' && (isSupervisor || active.assignedToId === user?.id))
  const orderCompleted = [
    orderDraft.orderItems.length > 0,
    Boolean(orderDraft.orderDate),
    Boolean(orderDraft.orderFulfillment),
    Boolean(orderDraft.orderShift),
    orderDraft.orderFulfillment === 'PICKUP'
      ? Boolean(orderDraft.orderPickupLocationId)
      : orderDraft.orderFulfillment === 'DELIVERY' && Boolean(orderDraft.orderAddress.trim()),
  ].filter(Boolean).length
  const scheduleOrder = async () => {
    const currentLock = lockRef.current
    if (!detail || !currentLock || orderCompleted !== 5 || orderDraftDirty || orderSaveState === 'saving') return
    const clientActionId = scheduleActionIdRef.current || crypto.randomUUID()
    scheduleActionIdRef.current = clientActionId
    setSchedulingOrder(true)
    setScheduleFeedback(null)
    setError(null)
    try {
      const result = await api<{ scheduledOrder: ScheduledOrder; draft: { orderDraftUpdatedAt: string | null } }>(`/api/conversations/${detail.id}/schedule-order`, {
        method: 'POST',
        body: JSON.stringify({ lockToken: currentLock.token, clientActionId }),
      })
      scheduleActionIdRef.current = null
      orderDraftVersionRef.current += 1
      setOrderDraft({ ...EMPTY_ORDER_DRAFT, orderDraftUpdatedAt: result.draft.orderDraftUpdatedAt })
      setOrderDraftDirty(false)
      setOrderSaveState('idle')
      setDetail(current => current && current.id === detail.id ? {
        ...current,
        orderDate: null,
        orderAddress: null,
        orderFulfillment: null,
        orderPickupLocationId: null,
        orderPickupLocationName: null,
        orderShift: null,
        orderPaid: false,
        orderItems: [],
        orderNotes: null,
        orderDraftUpdatedAt: result.draft.orderDraftUpdatedAt,
        scheduledOrders: [result.scheduledOrder, ...current.scheduledOrders.filter(item => item.id !== result.scheduledOrder.id)],
      } : current)
      setScheduleFeedback('Pedido guardado en el historial. La ficha está lista para el próximo.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo marcar el pedido como agendado.')
    } finally {
      setSchedulingOrder(false)
    }
  }

  if (loading) return <main className="workspaceLoading"><span className="brandMark">SC</span><strong>Preparando tu bandeja…</strong></main>
  return <main className={`workspaceShell ${active && showContext ? 'contextOpen' : ''}`}>
    <aside className="navigationRail" aria-label="Navegación principal">
      <div className="brandMark" title="Santa Catalina Atención">SC</div>
      <nav className="railNav" aria-label="Bandejas">
        {FILTERS.map((item, index) => {
          const badgeCount = index === 0 ? counts.unreadConversations : counts[item.id]
          const title = index === 0 ? `${item.label} · ${counts.unreadConversations} pendientes en el CRM (${counts.unreadMessages} mensajes)` : `${item.label} · ${counts[item.id]}`
          return <button key={item.id} className={`railButton ${filter === item.id ? 'railButtonActive' : ''}`} aria-label={title} title={title} onClick={() => setFilter(item.id)}><Icon name={index === 0 ? 'inbox' : index === 1 ? 'chat' : index === 2 ? 'users' : index === 3 ? 'clock' : 'check'} />{badgeCount > 0 && <span className={index === 0 ? 'railUnreadBadge' : 'railCategoryBadge'}>{badgeCount}</span>}</button>
        })}
      </nav>
      {isSupervisor && <a className="railButton railMetrics" aria-label="Métricas" title="Métricas" href="/metrics"><Icon name="chart" /></a>}
      <a className="railButton railSettings" aria-label="Configuración" title="Configuración" href="/settings"><Icon name="settings" /></a>
      <div className="railAgent" title={`${currentName} · Disponible`}><span className="onlineDot" /><Avatar name={currentName} small /></div>
    </aside>
    <section className={`conversationList ${mobileChat ? 'mobileHidden' : ''}`}>
      <header className="listHeader">
        <div className="listToolbar"><div><span className="brandEyebrow">Santa Catalina</span><h1>Chats</h1></div><div className="listActions">{isSupervisor && <button type="button" className="markAllReadButton" onClick={() => void markAllAsRead()} disabled={markingAllRead || counts.unreadConversations === 0} title="Poner en cero los pendientes del CRM"><Icon name="check" size={14} /><span>{markingAllRead ? 'Marcando…' : 'Marcar leídos'}</span></button>}<span className="liveBadge"><i /> Conectado</span><a className="iconButton" aria-label="Configuración" href="/settings"><Icon name="settings" /></a></div></div>
        <label className="searchBox"><Icon name="search" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar un chat" /><kbd>/</kbd></label>
        <nav className="filterChips" aria-label="Filtrar conversaciones">{FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'filterActive' : ''} onClick={() => setFilter(item.id)}>{item.short}<span>{counts[item.id]}</span></button>)}</nav>
        <div className="listMeta"><span>{visible.length} de {counts[filter]} · {counts.unreadConversations} pendientes CRM</span><span>{currentName}</span></div>
        {listFeedback && <div className="listFeedback" role="status"><Icon name="check" size={13} />{listFeedback}<button type="button" onClick={() => setListFeedback(null)} aria-label="Cerrar aviso">×</button></div>}
      </header>
      <div className="conversationCards">{visible.length === 0 ? <div className="emptyList"><span><Icon name="chat" size={28} /></span><strong>No hay conversaciones aquí</strong><p>Probá con otro filtro o búsqueda.</p></div> : visible.map(c => <button key={c.id} className={`conversationCard ${activeId === c.id ? 'conversationCardActive' : ''}`} onClick={() => selectConversation(c.id)}><div className="cardAvatarWrap"><Avatar name={c.contact.displayName} color={c.priority > 0 ? '#a3152f' : '#687782'} />{c.unreadCount > 0 && <span className="unreadCount">{c.unreadCount}</span>}</div><div className="cardContent"><div className="cardTop"><strong>{c.contact.displayName}</strong><time className={c.unreadCount ? 'timeUnread' : ''}>{formatTime(c.lastMessageAt)}</time></div><p className={c.unreadCount ? 'previewUnread' : ''}>{c.lastMessage?.direction === 'OUTBOUND' && <span className="previewChecks">✓✓</span>}{messagePreview(c.lastMessage)}</p><div className="cardBottom"><span className="companyName">{c.contact.profileName || c.contact.phoneE164}</span><span className={`statusPill status-${c.status.toLowerCase()}`}>{c.status === 'UNASSIGNED' ? 'Sin asignar' : c.status === 'WAITING_CUSTOMER' ? 'En espera' : c.status === 'RESOLVED' ? 'Resuelta' : agentName(c.assignedToId)}</span>{c.priority > 0 && <span className="priorityPill">Prioridad</span>}</div></div></button>)}</div>
    </section>
    {active ? <section className={`chatPanel ${mobileChat ? 'mobileVisible' : ''}`}>
      <header className="chatHeader">
        <button className="mobileBack" onClick={() => setMobileChat(false)} aria-label="Volver a los chats"><Icon name="back" /></button>
        <button className="avatarButton" onClick={() => setShowContext(true)} aria-label="Ver información del cliente"><Avatar name={active.contact.displayName} color={active.priority > 0 ? '#a3152f' : '#687782'} /></button>
        <div className="chatIdentity"><div><h2>{active.contact.displayName}</h2>{active.priority > 0 && <span className="priorityPill">Prioridad</span>}</div><span><i className="channelDot" />{assignedToOther ? `Atiende ${agentName(active.assignedToId)}` : active.assignedToId ? 'Conversación asignada a vos' : 'WhatsApp Business · sin asignar'}</span></div>
        <div className="chatTagPicker" ref={tagMenuRef}>
          <button type="button" className="chatTagButton" aria-haspopup="listbox" aria-expanded={showTagMenu} onClick={() => setShowTagMenu(current => !current)}>
            {active.tags[0] ? <span className="tagDot" style={{ background: active.tags[0].color }} /> : <Icon name="tag" size={16} />}
            <span className="chatTagButtonText">{active.tags[0]?.name || 'Etiquetar'}</span>
            {active.tags.length > 1 && <b>+{active.tags.length - 1}</b>}
            <span className="tagChevron">⌄</span>
          </button>
          {showTagMenu && <div className="tagMenu" role="listbox" aria-label="Etiquetas de la conversación">
            <header><div><Icon name="tag" size={17} /><strong>Etiquetas</strong></div><span>{active.tags.length} seleccionada{active.tags.length === 1 ? '' : 's'}</span></header>
            <div className="tagMenuList">
              {allTags.length === 0 && <p>No hay etiquetas disponibles.</p>}
              {allTags.map(tag => {
                const selected = active.tags.some(item => item.id === tag.id)
                return <button type="button" role="option" key={tag.id} aria-selected={selected} disabled={Boolean(tagBusyId)} onClick={() => toggleConversationTag(tag)}>
                  <span className="tagDot" style={{ background: tag.color }} /><strong>{tag.name}</strong><i>{tagBusyId === tag.id ? '…' : selected ? '✓' : ''}</i>
                </button>
              })}
            </div>
            <footer>Los cambios se guardan para todo el equipo.</footer>
          </div>}
        </div>
        <div className="chatActions"><button className="iconButton" aria-label="Buscar en la conversación" title="Buscar"><Icon name="search" size={19} /></button><button className="iconButton" aria-label="Llamar al contacto" title="Llamar"><Icon name="phone" size={18} /></button>{(canResolveActive || canArchiveActive) && <button className="iconButton lifecycleHeaderAction" disabled={busy} onClick={() => void (active.status === 'RESOLVED' ? archiveConversation() : resolveConversation())} aria-label={active.status === 'RESOLVED' ? 'Archivar conversación' : 'Resolver conversación'} title={active.status === 'RESOLVED' ? 'Archivar conversación' : 'Resolver conversación'}><Icon name={active.status === 'RESOLVED' ? 'archive' : 'check'} size={18} /></button>}{isSupervisor && active.assignedToId && active.status !== 'RESOLVED' && <button className="iconButton adminHeaderAction" onClick={unassignConversation} aria-label="Liberar chat" title="Liberar chat"><Icon name="lock" size={17} /></button>}<button className={`iconButton ${showContext ? 'iconButtonActive' : ''}`} onClick={() => setShowContext(v => !v)} aria-label="Información del cliente" title="Información del cliente"><Icon name="more" /></button></div>
      </header>
      {error && <div className="errorBanner" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
      {assignedToOther && <div className="lockBanner"><span className="lockIcon"><Icon name="lock" size={18} /></span><div><strong>{agentName(active.assignedToId)} tiene asignada esta conversación</strong><span>Podés seguirla en tiempo real. La respuesta está bloqueada para evitar mensajes cruzados.</span></div><span className="watchingBadge">Sólo lectura</span></div>}
      {!active.assignedToId && <div className="claimBanner"><div><span className="claimSpinner" /><div><strong>{claiming ? 'Asignando conversación…' : 'Preparando la conversación…'}</strong><span>Quedará reservada automáticamente para vos.</span></div></div></div>}
      <div className="messageCanvas" ref={messageCanvasRef}>{detail?.messages.map((m, index, messages) => { const occurredAt = m.providerTimestamp || m.createdAt; const previousOccurredAt = index > 0 ? messages[index - 1].providerTimestamp || messages[index - 1].createdAt : null; const showDay = !previousOccurredAt || localDayKey(previousOccurredAt) !== localDayKey(occurredAt); return <div key={m.id}>{showDay && <div className="dateDivider"><span>{formatMessageDay(occurredAt)}</span></div>}{m.direction === 'INTERNAL' ? <div className="systemNote"><span><Icon name="check" size={14} /></span>{m.body} · {formatTime(m.createdAt)}</div> : <div className={`messageRow ${m.direction === 'OUTBOUND' ? 'messageRowOut' : ''}`}><div className={`messageBubble ${m.direction === 'OUTBOUND' ? 'messageOut' : 'messageIn'}`}>{m.direction === 'OUTBOUND' && <span className="messageSender">{agentName(m.sentById) || 'Atención'}</span>}{m.type === 'IMAGE' && detail ? <ChatImage conversationId={detail.id} message={m} onLoad={() => { const canvas = messageCanvasRef.current; if (canvas && canvas.scrollHeight - canvas.scrollTop - canvas.clientHeight < 450) canvas.scrollTop = canvas.scrollHeight }} /> : <p>{messagePreview(m)}</p>}<span className="messageTime">{formatTime(occurredAt)}{m.direction === 'OUTBOUND' && <b className={m.status === 'READ' ? 'readChecks' : ''}>✓✓</b>}</span></div></div>}</div> })}</div>
      <div className="composerArea">
        <div className={`serviceWindow ${service.expired ? 'serviceWindowExpired' : ''}`}><Icon name="clock" size={14} /><span>{service.text}</span></div>
        {showQuickReplies && canReply && <div className="quickReplyMenu" role="listbox" aria-label="Respuestas rápidas">
          <header><div><b>/</b><strong>Respuestas rápidas</strong></div><div className="quickReplyHeaderActions"><span>Elegí una para insertarla</span>{isSupervisor && <button type="button" onClick={openQuickReplyManager}>+ Nueva respuesta</button>}</div></header>
          <div>
            {matchingQuickReplies.length === 0 && <p>No encontramos una respuesta para “{draft}”.</p>}
            {matchingQuickReplies.map((reply, index) => <button type="button" key={reply.id} role="option" aria-selected={index === quickReplyIndex} className={index === quickReplyIndex ? 'quickReplyActive' : ''} onMouseEnter={() => setQuickReplyIndex(index)} onMouseDown={event => event.preventDefault()} onClick={() => chooseQuickReply(reply)}>
              <span><b>/{reply.shortcut}</b><strong>{reply.title}</strong></span><p>{reply.body}</p>
            </button>)}
          </div>
          <footer><span>↑↓ para elegir · Enter para insertar · Esc para cerrar</span></footer>
        </div>}
        <form className={`composer ${!canReply ? 'composerDisabled' : ''}`} onSubmit={sendMessage}>
          <button type="button" aria-label="Agregar emoji" disabled={!canReply}><Icon name="smile" /></button>
          <button type="button" aria-label="Adjuntar archivo" disabled={!canReply}><Icon name="attach" /></button>
          <button type="button" className="quickReplyTrigger" aria-label="Abrir respuestas rápidas" title="Respuestas rápidas (/)" disabled={!canReply} onClick={openQuickReplies}>/</button>
          <textarea ref={composerInputRef} value={draft} onChange={event => { const value = event.target.value; setDraft(value); setQuickReplyIndex(0); setShowQuickReplies(value.startsWith('/')) }} placeholder={assignedToOther ? `Respuesta bloqueada por ${agentName(active.assignedToId)}` : !active.assignedToId ? 'Tomá la conversación para responder' : active.status === 'RESOLVED' ? 'Conversación resuelta' : !lock ? 'Obteniendo control seguro…' : 'Escribe un mensaje o / para respuestas rápidas'} rows={1} disabled={!canReply || busy} onKeyDown={handleComposerKeyDown} />
          <button className="sendButton" type="submit" aria-label="Enviar mensaje" disabled={!canReply || !draft.trim() || busy}><Icon name="send" size={18} /></button>
        </form>
      </div>
    </section> : <section className="chatPanel chatEmptyPanel">
      <div className="chatEmptyContent">
        <div className="chatEmptyVisual"><span>SC</span><i><Icon name="chat" size={34} /></i></div>
        <h2>Santa Catalina Atención</h2>
        <p>Seleccioná una conversación de la bandeja para comenzar a atender.</p>
        <span className="chatEmptyHint"><kbd>Esc</kbd> cierra el chat activo y libera la ventana de atención.</span>
      </div>
      <footer><Icon name="lock" size={13} /> Las conversaciones se protegen para evitar respuestas cruzadas.</footer>
    </section>}
    {active && showContext && <aside className="contextPanel">
      <header><span>Información del cliente</span><button className="iconButton" onClick={() => setShowContext(false)}>×</button></header>
      <div className="customerHero">
        <Avatar name={customerContext?.status === 'LINKED' ? customerContext.customer.commercialName : active.contact.displayName} color={active.priority > 0 ? '#a3152f' : '#67717f'} />
        <h3>{customerContext?.status === 'LINKED' ? customerContext.customer.commercialName : active.contact.displayName}</h3>
        <p>{customerContext?.status === 'LINKED' ? customerContext.customer.contactName || 'Cliente del ERP' : active.contact.profileName || 'Contacto de WhatsApp'}</p>
        <div className="customerTags">
          {customerContext?.status === 'LINKED' && <span className="erpTag">Cliente ERP</span>}
          {active.tags.map(tag => <span key={tag.id}>{tag.name}</span>)}
        </div>
      </div>
      <section className="orderPlanner">
        <div className="plannerHeading"><div><span>Ficha rápida</span><h4>Datos del pedido</h4></div><b className={orderCompleted === 5 ? 'plannerComplete' : ''}>{orderCompleted}/5</b></div>
        <div className="plannerField orderItemsField">
          <label><Icon name="bag" size={15} /> ¿Qué va a pedir?</label>
          <label className="orderProductSearch"><Icon name="search" size={15} /><input value={productSearch} disabled={!canEditOrderDraft || orderCatalogLoading} onChange={event => setProductSearch(event.target.value)} placeholder={orderCatalogLoading ? 'Cargando productos del ERP…' : 'Buscar producto o código'} /></label>
          {orderCatalogError && <div className="orderCatalogNotice orderCatalogWarning"><span>No pudimos consultar el catálogo del ERP.</span><button type="button" onClick={() => void refreshOrderCatalog()}>Reintentar</button></div>}
          {productSearch.trim() && !orderCatalogError && <div className="orderCatalogResults">
            {catalogResults.map(product => { const selectedPresentation = product.presentations.find(presentation => presentation.unitsPerPackage === 8); return <article key={product.id}><div><strong>{product.name}</strong><small>{product.code}{product.variants.length > 0 ? ` · ${product.variants.length} variedades en x8` : ''}</small></div><div>{product.variants.length > 0 ? selectedPresentation ? <button type="button" disabled={!canEditOrderDraft} onClick={() => addOrderItem(product, selectedPresentation.id)}>Elegir sabores · x8</button> : <span className="orderCatalogUnavailable">x8 no disponible</span> : product.presentations.map(presentation => <button type="button" key={presentation.id} disabled={!canEditOrderDraft} onClick={() => addOrderItem(product, presentation.id)}>+ x{presentation.unitsPerPackage}</button>)}</div></article> })}
            {!orderCatalogLoading && catalogResults.length === 0 && <div className="orderCatalogNotice">No encontramos productos activos con ese nombre o código.</div>}
          </div>}
          {variantPicker && variantPickerProduct && variantPickerPresentation && <div className="variantPicker"><header><div><span>Sumá porciones de x8</span><strong>{variantPickerProduct.name} · cada toque agrega x8</strong></div><button type="button" aria-label="Cerrar variedades" onClick={() => setVariantPicker(null)}>×</button></header><div>{variantPickerProduct.variants.map(variant => { const selected = orderDraft.orderItems.find(item => item.presentationId === variantPickerPresentation.id && item.variantId === variant.id); return <button type="button" key={variant.id} className={selected ? 'selected' : ''} disabled={!canEditOrderDraft} onClick={() => addOrderItem(variantPickerProduct, variantPickerPresentation.id, variant.id)}><b>{variant.code.toUpperCase()}</b><span>{selected ? `+${selected.quantity} · total x${selected.quantity * 8}` : '+1 · sumar x8'}</span></button> })}</div><small>Cada pulsación suma otra porción x8 del mismo sabor. No se admite texto libre.</small></div>}
          {orderDraft.orderItems.length > 0 ? <div className="selectedOrderItems">{orderDraft.orderItems.map(item => <article key={`${item.presentationId}:${item.variantId || ''}`}><div><strong>{item.productName}{item.variantCode ? <span className="selectedVariantBadge">x8 · {item.variantCode.toUpperCase()}</span> : null}</strong><small>{item.variantId ? `Cantidad +${item.quantity} · total x${item.quantity * 8}` : `${item.productCode} · presentación x${item.unitsPerPackage}`}{item.variantName && item.variantName.toUpperCase() !== item.variantCode?.toUpperCase() ? ` · ${item.variantName}` : ''}</small></div><div className="itemQuantity"><button type="button" disabled={!canEditOrderDraft} aria-label={`Quitar una presentación de ${item.productName}`} onClick={() => changeOrderItemQuantity(item.presentationId, item.variantId, -1)}>−</button><b>{item.quantity}</b><button type="button" disabled={!canEditOrderDraft || item.quantity >= 999} aria-label={`Agregar una presentación de ${item.productName}`} onClick={() => changeOrderItemQuantity(item.presentationId, item.variantId, 1)}>+</button></div></article>)}</div> : <div className="emptyOrderItems"><Icon name="bag" size={16} /><span>Agregá al menos un producto del catálogo.</span></div>}
          <textarea className="orderNotes" rows={2} maxLength={500} value={orderDraft.orderNotes} disabled={!canEditOrderDraft} onChange={event => changeOrderDraft({ orderNotes: event.target.value })} placeholder="Aclaraciones del pedido (opcional)" />
        </div>
        <div className="plannerField">
          <label><Icon name="calendar" size={15} /> Fecha</label>
          <input className="plannerDate" type="date" min={localDateOffset(0)} value={orderDraft.orderDate} disabled={!canEditOrderDraft} onChange={event => changeOrderDraft({ orderDate: event.target.value })} />
          <div className="quickDateButtons">
            {[{ label: 'Hoy', days: 0 }, { label: 'Mañana', days: 1 }, { label: '+2 días', days: 2 }].map(option => { const value = localDateOffset(option.days); return <button type="button" key={option.label} className={orderDraft.orderDate === value ? 'selected' : ''} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderDate: value })}>{option.label}</button> })}
          </div>
        </div>
        <div className="plannerField">
          <label>Modalidad</label>
          <div className="fulfillmentButtons">
            <button type="button" className={orderDraft.orderFulfillment === 'DELIVERY' ? 'selected deliverySelected' : ''} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderFulfillment: 'DELIVERY', orderPickupLocationId: null, orderPickupLocationName: '' })}><Icon name="truck" size={20} /><span><strong>Envío</strong><small>Lo entregamos</small></span></button>
            <button type="button" className={orderDraft.orderFulfillment === 'PICKUP' ? 'selected pickupSelected' : ''} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderFulfillment: 'PICKUP', orderAddress: '' })}><Icon name="store" size={20} /><span><strong>Retiro</strong><small>Elige un local</small></span></button>
          </div>
        </div>
        {orderDraft.orderFulfillment === 'PICKUP' ? <div className="plannerField pickupLocationField">
          <label><Icon name="store" size={15} /> Local de retiro</label>
          <div className="pickupLocationButtons">
            {pickupLocationsLoading && <div className="pickupLocationNotice">Consultando locales del ERP…</div>}
            {!pickupLocationsLoading && pickupLocations.map(location => <button type="button" key={location.id} className={orderDraft.orderPickupLocationId === location.id ? 'selected' : ''} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderPickupLocationId: location.id, orderPickupLocationName: location.name })}><span className="pickupLocationIcon"><Icon name="store" size={17} /></span><span><strong>{location.name}</strong><small>Punto de retiro habilitado</small></span>{orderDraft.orderPickupLocationId === location.id && <b><Icon name="check" size={13} /></b>}</button>)}
            {!pickupLocationsLoading && orderDraft.orderPickupLocationId && !pickupLocations.some(location => location.id === orderDraft.orderPickupLocationId) && <button type="button" className="selected" disabled><span className="pickupLocationIcon"><Icon name="store" size={17} /></span><span><strong>{orderDraft.orderPickupLocationName || 'Local guardado'}</strong><small>Selección guardada anteriormente</small></span><b><Icon name="check" size={13} /></b></button>}
            {!pickupLocationsLoading && pickupLocations.length === 0 && <div className="pickupLocationNotice pickupLocationWarning"><span>{pickupLocationsError ? 'No pudimos consultar los locales del ERP.' : 'No hay ubicaciones activas de tipo LOCAL en el ERP.'}</span>{pickupLocationsError && <button type="button" onClick={() => void refreshPickupLocations()}>Reintentar</button>}</div>}
          </div>
        </div> : <div className="plannerField">
          <div className="plannerLabelRow"><label><Icon name="map" size={15} /> Dirección</label>{customerContext?.status === 'LINKED' && customerContext.customer.address && <button type="button" disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderAddress: customerContext.customer.address || '' })}>Usar la del cliente</button>}</div>
          <textarea rows={2} maxLength={300} value={orderDraft.orderAddress} disabled={!canEditOrderDraft} onChange={event => changeOrderDraft({ orderAddress: event.target.value })} placeholder="Calle, número y referencia" />
        </div>}
        <div className="plannerField">
          <label>Turno</label>
          <div className="shiftButtons">
            {[{ value: 'MORNING', label: 'Mañana', icon: '☀' }, { value: 'SIESTA', label: 'Siesta', icon: '◐' }, { value: 'AFTERNOON', label: 'Tarde', icon: '◒' }].map(option => <button type="button" key={option.value} className={orderDraft.orderShift === option.value ? 'selected' : ''} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderShift: option.value as OrderDraft['orderShift'] })}><i>{option.icon}</i><strong>{option.label}</strong></button>)}
          </div>
        </div>
        <div className="plannerField">
          <label><Icon name="money" size={15} /> Estado del pago</label>
          <button type="button" className={`paymentStatusButton ${orderDraft.orderPaid ? 'selected' : ''}`} aria-pressed={orderDraft.orderPaid} disabled={!canEditOrderDraft} onClick={() => changeOrderDraft({ orderPaid: !orderDraft.orderPaid })}><span className="paymentStatusIcon"><Icon name={orderDraft.orderPaid ? 'check' : 'money'} size={18} /></span><span><strong>{orderDraft.orderPaid ? 'Pedido pagado' : 'Marcar como pagado'}</strong><small>{orderDraft.orderPaid ? 'Transferencia confirmada' : 'Activá esta opción al recibir el pago'}</small></span><b>{orderDraft.orderPaid ? 'PAGADO' : 'SIN MARCAR'}</b></button>
        </div>
        <button type="button" className="scheduleOrderButton" disabled={!canEditOrderDraft || orderCompleted !== 5 || orderDraftDirty || orderSaveState === 'saving' || schedulingOrder} onClick={() => void scheduleOrder()}><span><Icon name="check" size={18} /></span><span><strong>{schedulingOrder ? 'Agendando…' : 'Agendado'}</strong><small>{orderCompleted !== 5 ? 'Agregá productos y completá los datos' : orderDraftDirty || orderSaveState === 'saving' ? 'Esperando el guardado automático…' : 'Marcar después de pasarlo al Excel'}</small></span></button>
        {scheduleFeedback && <div className="scheduleFeedback"><Icon name="check" size={14} /><span>{scheduleFeedback}</span></div>}
        <div className={`plannerSaveState state-${orderSaveState}`}><span>{orderSaveState === 'saving' ? '● Guardando…' : orderSaveState === 'error' ? '! No se pudo guardar' : orderSaveState === 'saved' ? '✓ Guardado automáticamente' : canEditOrderDraft ? 'Los cambios se guardan solos' : 'Sólo puede editar el agente que atiende'}</span>{orderCompleted === 5 && <b>Lista para agendar</b>}</div>
      </section>
      {detail && detail.scheduledOrders.length > 0 && <section className="scheduledHistory">
        <div className="sectionLabel"><span>Historial agendado</span><b>{detail.scheduledOrders.length}</b></div>
        <div className="scheduledOrderList">{detail.scheduledOrders.map(item => <article className="scheduledOrderCard scheduledOrderCardInteractive" key={item.id} role="button" tabIndex={0} aria-label={`Ver pedido agendado para el ${formatOrderDate(item.orderDate)}`} onClick={() => openScheduledOrder(item)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openScheduledOrder(item) } }}>
          <div className="scheduledOrderHeader"><span className="scheduledOrderCheck"><Icon name="check" size={14} /></span><div><small>Pedido para</small><strong>{formatOrderDate(item.orderDate)}</strong></div><div className="scheduledOrderBadges"><b className={item.orderFulfillment === 'PICKUP' ? 'pickupHistoryBadge' : ''}>{item.orderFulfillment === 'PICKUP' ? 'Retiro' : 'Envío'}</b><b className={item.orderPaid ? 'paidHistoryBadge' : 'unpaidHistoryBadge'}>{item.orderPaid ? 'Pagado' : 'Sin marcar'}</b></div></div>
          <dl><div><dt>Pedido</dt><dd className="scheduledProducts">{item.orderItems.length > 0 ? item.orderItems.map(orderItem => orderItem.variantCode ? `${orderItem.variantCode.toUpperCase()} · +${orderItem.quantity} de x8 = x${orderItem.quantity * 8}` : `${orderItem.quantity}× ${orderItem.productName} x${orderItem.unitsPerPackage}`).join(' · ') : 'Sin detalle registrado'}</dd></div><div><dt>Destino</dt><dd>{item.orderFulfillment === 'PICKUP' ? item.orderPickupLocationName || 'Local sin nombre' : item.orderAddress || 'Sin dirección'}</dd></div><div><dt>Turno</dt><dd>{shiftName(item.orderShift)}</dd></div><div><dt>Pago</dt><dd className={item.orderPaid ? 'paidOrderText' : ''}>{item.orderPaid ? 'Transferencia confirmada' : 'No marcado como pagado'}</dd></div>{item.orderNotes && <div><dt>Notas</dt><dd>{item.orderNotes}</dd></div>}</dl>
          <footer><Avatar name={item.scheduledByName} small /><div><span>Agendado por</span><strong>{item.scheduledByName}{item.scheduledById === user?.id ? ' (vos)' : ''}</strong></div><div className="scheduledOrderCardAction"><time>{formatScheduledAt(item.scheduledAt)}</time><span>Ver detalle ›</span></div></footer>
        </article>)}</div>
      </section>}
      <section className="detailSection">
        <div className="sectionLabel"><span>Contacto</span><button onClick={() => refreshCustomerContext(active.id)} disabled={contextLoading}>{contextLoading ? 'Buscando…' : 'Actualizar'}</button></div>
        {contextLoading && !customerContext ? <div className="contextSkeleton"><i /><i /><i /></div> : customerContext?.status === 'LINKED' ? <dl>
          <div><dt>WhatsApp</dt><dd>{active.contact.phoneE164}</dd></div>
          <div><dt>Dirección</dt><dd>{customerContext.customer.address || 'Sin informar'}</dd></div>
          <div><dt>Localidad</dt><dd>{customerContext.customer.locality || 'Sin informar'}</dd></div>
          <div><dt>Zona</dt><dd>{customerContext.customer.zone || 'Sin informar'}</dd></div>
          <div><dt>Segmento</dt><dd>{customerContext.customer.segment || 'General'}</dd></div>
        </dl> : <dl>
          <div><dt>WhatsApp</dt><dd>{active.contact.phoneE164}</dd></div>
          <div><dt>Asignación</dt><dd>{agentName(active.assignedToId) || 'Sin asignar'}</dd></div>
          <div><dt>Origen</dt><dd>WhatsApp</dd></div>
        </dl>}
        {customerContext?.status === 'CANDIDATES' && <div className="candidateBox"><strong>Encontramos más de un cliente</strong><p>Elegí el comercio correcto para evitar cruces.</p>{customerContext.candidates.map(candidate => <button key={candidate.id} onClick={() => linkCustomer(candidate)} disabled={contextBusy}><span>{candidate.commercialName}</span><small>{candidate.phone || candidate.address || 'Sin teléfono registrado'}</small></button>)}</div>}
        {customerContext?.status === 'NOT_FOUND' && <div className="contextNotice"><strong>Contacto nuevo</strong><span>No coincide con ningún cliente activo del ERP.</span></div>}
        {customerContext?.status === 'UNAVAILABLE' && <div className="contextNotice contextNoticeWarning"><strong>ERP temporalmente no disponible</strong><span>{customerContext.message}</span></div>}
      </section>
      <section className="detailSection">
        <div className="sectionLabel"><span>Pedidos recientes</span>{customerContext?.status === 'LINKED' && <b>{customerContext.customer.orderCount} históricos</b>}</div>
        {customerContext?.status === 'LINKED' && customerContext.customer.recentOrders.length > 0 ? <div className="orderList">{customerContext.customer.recentOrders.map(order => <button type="button" className="orderCard" key={order.id} onClick={() => void openHistoricalOrder(order.id)}><span className="orderIcon"><Icon name="bag" size={16} /></span><div><strong>{formatDate(order.deliveryAt)} · {orderStatus(order.status)}</strong><span>{order.totalPacks} packs · {order.totalUnits} unidades</span></div><div className="orderAmount"><strong>{formatMoney(order.totalAmount)}</strong><span>{order.paid ? 'Abonado' : 'Pendiente'} · Ver detalle</span></div></button>)}</div> : <div className="noOrder"><Icon name="bag" /><span>{customerContext?.status === 'LINKED' ? 'Todavía no tiene pedidos' : 'Vinculá el cliente para ver pedidos'}</span></div>}
      </section>
      <footer className="contextFooter">
        {active.status === 'RESOLVED'
          ? <button className="archiveButton" onClick={() => void archiveConversation()} disabled={!canArchiveActive || busy}><Icon name="archive" size={15} /> {busy ? 'Archivando…' : 'Archivar'}</button>
          : <button className={isSupervisor ? 'adminReleaseButton' : ''} onClick={isSupervisor ? unassignConversation : undefined} disabled={!isSupervisor || !active.assignedToId || busy}>{isSupervisor ? busy ? 'Liberando…' : 'Liberar chat' : 'Transferir'}</button>}
        <button className="resolveButton" onClick={() => void resolveConversation()} disabled={!canResolveActive || busy}><Icon name="check" size={16} /> {active.status === 'RESOLVED' ? 'Resuelta' : busy ? 'Resolviendo…' : 'Resolver'}</button>
      </footer>
    </aside>}
    {quickReplyManagerOpen && <div className="orderModalBackdrop" role="presentation" onMouseDown={() => setQuickReplyManagerOpen(false)}><section className="quickReplyAdminModal" role="dialog" aria-modal="true" aria-label="Administrar respuestas rápidas" onMouseDown={event => event.stopPropagation()}>
      <header><div><span>Administración</span><h3>Respuestas rápidas</h3><p>Todo lo que guardes estará disponible para el equipo al escribir <b>/</b>.</p></div><button type="button" aria-label="Cerrar respuestas rápidas" onClick={() => setQuickReplyManagerOpen(false)}>×</button></header>
      <div className="quickReplyAdminContent">
        <form className="quickReplyEditor" onSubmit={saveQuickReply}>
          <div className="quickReplyEditorHeading"><div><span>{quickReplyForm.id ? 'Editando respuesta' : 'Nueva respuesta'}</span><strong>{quickReplyForm.id ? `/${quickReplyForm.shortcut}` : 'Creá un atajo fácil de recordar'}</strong></div>{quickReplyForm.id && <button type="button" onClick={() => setQuickReplyForm(EMPTY_QUICK_REPLY_FORM)}>Cancelar edición</button>}</div>
          <label><span>Atajo</span><div className="shortcutInput"><b>/</b><input autoFocus={!quickReplyForm.id} maxLength={41} value={quickReplyForm.shortcut} onChange={event => setQuickReplyForm(current => ({ ...current, shortcut: event.target.value.replace(/^\/+/, '') }))} placeholder="ej: envio" /></div><small>Sin espacios. Podés usar letras, números, guiones y guion bajo.</small></label>
          <label><span>Nombre visible</span><input maxLength={80} value={quickReplyForm.title} onChange={event => setQuickReplyForm(current => ({ ...current, title: event.target.value }))} placeholder="Ej: Confirmación de envío" /></label>
          <label><span>Mensaje</span><textarea rows={5} maxLength={2000} value={quickReplyForm.body} onChange={event => setQuickReplyForm(current => ({ ...current, body: event.target.value }))} placeholder="Escribí el texto que se insertará en la conversación…" /></label>
          <label className="quickReplyActiveToggle"><input type="checkbox" checked={quickReplyForm.active} onChange={event => setQuickReplyForm(current => ({ ...current, active: event.target.checked }))} /><span>Disponible para los operadores</span></label>
          {quickReplyManagerError && <div className="quickReplyAdminError" role="alert">{quickReplyManagerError}</div>}
          <button className="quickReplySaveButton" type="submit" disabled={quickReplyManagerBusy || !quickReplyForm.shortcut.trim() || !quickReplyForm.title.trim() || !quickReplyForm.body.trim()}>{quickReplyManagerBusy ? 'Guardando…' : quickReplyForm.id ? 'Guardar cambios' : 'Crear respuesta rápida'}</button>
        </form>
        <section className="quickReplyAdminList">
          <header><div><span>Biblioteca compartida</span><strong>{managedQuickReplies.length} respuestas</strong></div></header>
          <div>
            {quickReplyManagerLoading && <p className="quickReplyAdminEmpty">Cargando respuestas…</p>}
            {!quickReplyManagerLoading && managedQuickReplies.length === 0 && <p className="quickReplyAdminEmpty">Todavía no hay respuestas guardadas.</p>}
            {managedQuickReplies.map(reply => <article key={reply.id} className={!reply.active ? 'quickReplyInactive' : ''}>
              <div><span><b>/{reply.shortcut}</b><i>{reply.active ? 'Activa' : 'Inactiva'}</i></span><strong>{reply.title}</strong><p>{reply.body}</p></div>
              <footer><button type="button" onClick={() => setQuickReplyForm({ ...reply })} disabled={quickReplyManagerBusy}>Editar</button><button type="button" onClick={() => void toggleQuickReply(reply)} disabled={quickReplyManagerBusy}>{reply.active ? 'Desactivar' : 'Activar'}</button><button type="button" className="quickReplyDeleteButton" onClick={() => void deleteQuickReply(reply)} disabled={quickReplyManagerBusy}>Eliminar</button></footer>
            </article>)}
          </div>
        </section>
      </div>
    </section></div>}
    {orderModal && <div className="orderModalBackdrop" role="presentation" onMouseDown={() => setOrderModal(null)}><section className="orderDetailModal" role="dialog" aria-modal="true" aria-label="Detalle del pedido histórico" onMouseDown={event => event.stopPropagation()}>
      <header><div><span>Pedido histórico del ERP</span><h3>{orderModal.detail ? `#${orderModal.detail.id.slice(0, 8)}` : 'Consultando pedido'}</h3></div><button type="button" aria-label="Cerrar detalle" onClick={() => setOrderModal(null)}>×</button></header>
      {orderModal.loading && <div className="orderModalState"><span className="claimSpinner" /><strong>Cargando toda la información…</strong></div>}
      {orderModal.error && <div className="orderModalState orderModalError"><Icon name="bag" size={24} /><strong>{orderModal.error}</strong><button type="button" onClick={() => setOrderModal(null)}>Cerrar</button></div>}
      {orderModal.detail && <div className="orderModalContent">
        <div className="orderModalSummary"><div><span>Entrega</span><strong>{formatLongDate(orderModal.detail.deliveryAt)}</strong><small>{orderModal.detail.fulfillment === 'PICKUP' ? `Retiro${orderModal.detail.pickupLocation ? ` en ${orderModal.detail.pickupLocation.name}` : ''}` : 'Envío a domicilio'} · {orderModal.detail.shift || 'Sin turno'}</small></div><b className={orderModal.detail.paid ? 'orderPaidStatus' : ''}>{orderModal.detail.paid ? 'Abonado' : 'Pendiente'}</b></div>
        <section><h4>Productos</h4><div className="orderModalItems">{orderModal.detail.items.map(item => <article key={`${item.presentationId}-${item.unitPrice}-${item.notes || ''}`}><span className="orderModalItemQuantity">{item.quantity}×</span><div><strong>{item.productName} · x{item.unitsPerPackage}</strong><small>{item.productCode} · {item.totalUnits} unidades{item.notes ? ` · ${item.notes}` : ''}</small></div><b>{formatMoney(item.totalAmount)}</b></article>)}</div></section>
        <section className="orderModalData"><h4>Información del pedido</h4><dl><div><dt>Cliente</dt><dd>{orderModal.detail.customer.commercialName}</dd></div><div><dt>Dirección actual</dt><dd>{orderModal.detail.customer.currentAddress || 'Sin informar'}</dd></div><div><dt>Zona</dt><dd>{[orderModal.detail.customer.locality, orderModal.detail.customer.zone].filter(Boolean).join(' · ') || 'Sin informar'}</dd></div><div><dt>Fecha de carga</dt><dd>{formatLongDate(orderModal.detail.orderedAt)}</dd></div><div><dt>Estado</dt><dd>{orderStatus(orderModal.detail.status)}</dd></div><div><dt>Medio de pago</dt><dd>{orderModal.detail.paymentMethod || 'Sin informar'}</dd></div></dl></section>
        <footer><div><span>{orderModal.detail.totalPacks} packs · {orderModal.detail.totalUnits} unidades</span><strong>Total {formatMoney(orderModal.detail.totalAmount)}</strong></div><button type="button" onClick={() => setOrderModal(null)}>Cerrar</button></footer>
      </div>}
    </section></div>}
    {scheduledOrderModal && <div className="orderModalBackdrop" role="presentation" onMouseDown={() => setScheduledOrderModal(null)}><section className="orderDetailModal scheduledOrderModal" role="dialog" aria-modal="true" aria-label="Detalle del pedido agendado" onMouseDown={event => event.stopPropagation()}>
      <header><div><span>Pedido agendado en Atención</span><h3>#{scheduledOrderModal.id.slice(0, 8)}</h3></div><button type="button" aria-label="Cerrar detalle" onClick={() => setScheduledOrderModal(null)}>×</button></header>
      <div className="orderModalContent">
        <div className="orderModalSummary"><div><span>Pedido para</span><strong>{formatOrderDate(scheduledOrderModal.orderDate)}</strong><small>{scheduledOrderModal.orderFulfillment === 'PICKUP' ? `Retiro en ${scheduledOrderModal.orderPickupLocationName || 'local sin nombre'}` : `Envío a ${scheduledOrderModal.orderAddress || 'dirección sin informar'}`} · {shiftName(scheduledOrderModal.orderShift)}</small></div><b className={scheduledOrderModal.orderPaid ? 'orderPaidStatus' : ''}>{scheduledOrderModal.orderPaid ? 'Pagado' : 'Sin marcar'}</b></div>
        <section><h4>Productos encargados</h4>{scheduledOrderModal.orderItems.length > 0 ? <div className="orderModalItems">{scheduledOrderModal.orderItems.map(item => <article key={`${item.presentationId}:${item.variantId || ''}`}><span className="orderModalItemQuantity">{item.quantity}×</span><div><strong>{item.variantCode ? `${item.productName} · x8 · ${item.variantCode.toUpperCase()}` : `${item.productName} · x${item.unitsPerPackage}`}</strong><small>{item.variantCode ? `Cantidad +${item.quantity} · total x${item.quantity * 8}` : `${item.productCode} · ${item.quantity * item.unitsPerPackage} unidades en total`}{item.variantName && item.variantName.toUpperCase() !== item.variantCode?.toUpperCase() ? ` · ${item.variantName}` : ''}</small></div><b>{item.quantity * item.unitsPerPackage} u.</b></article>)}</div> : <div className="orderModalEmpty"><Icon name="bag" size={20} /><span>Este pedido fue agendado antes de incorporar el detalle de productos.</span></div>}</section>
        <section className="orderModalData"><h4>Información guardada</h4><dl><div><dt>Cliente</dt><dd>{active?.contact.displayName || 'Sin informar'}</dd></div><div><dt>Modalidad</dt><dd>{scheduledOrderModal.orderFulfillment === 'PICKUP' ? 'Retiro' : 'Envío'}</dd></div><div><dt>Destino</dt><dd>{scheduledOrderModal.orderFulfillment === 'PICKUP' ? scheduledOrderModal.orderPickupLocationName || 'Local sin nombre' : scheduledOrderModal.orderAddress || 'Sin dirección'}</dd></div><div><dt>Turno</dt><dd>{shiftName(scheduledOrderModal.orderShift)}</dd></div><div><dt>Estado del pago</dt><dd>{scheduledOrderModal.orderPaid ? 'Transferencia confirmada' : 'No marcado como pagado'}</dd></div><div><dt>Agendado por</dt><dd>{scheduledOrderModal.scheduledByName}{scheduledOrderModal.scheduledById === user?.id ? ' (vos)' : ''}</dd></div><div><dt>Fecha de registro</dt><dd>{formatScheduledAt(scheduledOrderModal.scheduledAt)}</dd></div></dl></section>
        {scheduledOrderModal.orderNotes && <section className="orderModalNotes"><h4>Observaciones</h4><p>{scheduledOrderModal.orderNotes}</p></section>}
        <footer><div><span>{scheduledOrderModal.orderItems.length} líneas · {scheduledOrderUnits} unidades</span><strong>{scheduledOrderModal.orderPaid ? 'Pago confirmado' : 'Pago sin confirmar'}</strong></div><button type="button" onClick={() => setScheduledOrderModal(null)}>Cerrar</button></footer>
      </div>
    </section></div>}
  </main>
}
