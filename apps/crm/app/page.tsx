'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationStatus, CrmSessionUser, CustomerContextResponse, ErpCustomerCandidate, ErpPickupLocation } from '@santa-catalina/contracts'

type ApiTag = { id: string; name: string; color: string }
type ApiContact = { id: string; displayName: string; profileName: string | null; phoneE164: string }
type ApiMessage = { id: string; direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL'; body: string | null; status: 'RECEIVED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'; sentById: string | null; providerTimestamp: string | null; createdAt: string }
type ConversationSummary = { id: string; status: ConversationStatus; priority: number; assignedToId: string | null; activeById: string | null; lockExpiresAt: string | null; unreadCount: number; lastMessageAt: string; serviceWindowExpiresAt: string | null; contact: ApiContact; tags: ApiTag[]; lastMessage: ApiMessage | null }
type OrderDraft = { orderDate: string; orderAddress: string; orderFulfillment: 'DELIVERY' | 'PICKUP' | null; orderPickupLocationId: string | null; orderPickupLocationName: string; orderShift: 'MORNING' | 'SIESTA' | 'AFTERNOON' | null; orderPaid: boolean; orderDraftUpdatedAt?: string | null }
type ScheduledOrder = { id: string; orderDate: string; orderAddress: string | null; orderFulfillment: 'DELIVERY' | 'PICKUP'; orderPickupLocationId: string | null; orderPickupLocationName: string | null; orderShift: 'MORNING' | 'SIESTA' | 'AFTERNOON'; orderPaid: boolean; scheduledById: string; scheduledByName: string; scheduledAt: string }
type ConversationDetail = ConversationSummary & { messages: ApiMessage[]; scheduledOrders: ScheduledOrder[]; orderDate: string | null; orderAddress: string | null; orderFulfillment: OrderDraft['orderFulfillment']; orderPickupLocationId: string | null; orderPickupLocationName: string | null; orderShift: OrderDraft['orderShift']; orderPaid: boolean; orderDraftUpdatedAt: string | null }
type Lock = { token: string; expiresAt: string; version: number; activeById: string; assignedToId: string }
type FilterId = 'all' | 'mine' | 'unassigned' | 'waiting' | 'resolved'

const DEMO_AGENT_NAMES: Record<string, string> = { 'agent-marina': 'Marina Soto', 'agent-lucia': 'Lucía Rojas', 'agent-admin': 'Administración' }
const FILTERS: Array<{ id: FilterId; label: string; short: string }> = [
  { id: 'all', label: 'Todas', short: 'Inicio' }, { id: 'mine', label: 'Mis conversaciones', short: 'Mías' },
  { id: 'unassigned', label: 'Sin asignar', short: 'Nuevas' }, { id: 'waiting', label: 'En espera', short: 'Espera' },
  { id: 'resolved', label: 'Resueltas', short: 'Cerradas' },
]
const EMPTY_ORDER_DRAFT: OrderDraft = { orderDate: '', orderAddress: '', orderFulfillment: null, orderPickupLocationId: null, orderPickupLocationName: '', orderShift: null, orderPaid: false, orderDraftUpdatedAt: null }

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    inbox: <><path d="M4 5h16v12H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>, chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, check: <path d="m5 12 4 4L19 6"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2M9 21H5v-4l-2-2 2-3-2-3 3-3 3 2 3-2 3 2 3-1 2 3-2 3"/></>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    back: <path d="m15 18-6-6 6-6"/>, attach: <path d="m21 12-9 9a6 6 0 0 1-9-9l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 1 1-3-3l8-8"/>, smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s2 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>, lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, bag: <><path d="M6 8h12l1 13H5z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    phone: <path d="M22 17v3a2 2 0 0 1-2 2 20 20 0 0 1-9-3 20 20 0 0 1-6-6A20 20 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2l1 3-2 3a16 16 0 0 0 6 6l3-2 3 1a2 2 0 0 1 2 2z"/>, note: <><path d="M4 3h16v18H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>, map: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></>, truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>, store: <><path d="M4 10v11h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 21v-6h6v6"/></>, money: <><circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.5-1.7-.8-2.8-.8-1.5 0-2.7.7-2.7 1.9 0 3.2 5.5 1.3 5.5 4.5 0 1.2-1.2 2.1-3 2.1-1.2 0-2.4-.4-3.2-1.1M12 6v12"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'SC' }
function agentName(id?: string | null) { return id ? DEMO_AGENT_NAMES[id] || 'Otro agente' : '' }
function formatTime(value: string) { return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value)) }
function formatOrderDate(value: string) { const [year, month, day] = value.split('-').map(Number); return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day)) }
function formatScheduledAt(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
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

export default function AttentionWorkspace() {
  const [user, setUser] = useState<CrmSessionUser | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [lock, setLock] = useState<Lock | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [showContext, setShowContext] = useState(true)
  const [customerContext, setCustomerContext] = useState<CustomerContextResponse | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [contextBusy, setContextBusy] = useState(false)
  const [orderDraft, setOrderDraft] = useState<OrderDraft>(EMPTY_ORDER_DRAFT)
  const [pickupLocations, setPickupLocations] = useState<ErpPickupLocation[]>([])
  const [pickupLocationsLoading, setPickupLocationsLoading] = useState(true)
  const [pickupLocationsError, setPickupLocationsError] = useState(false)
  const [orderDraftDirty, setOrderDraftDirty] = useState(false)
  const [orderSaveState, setOrderSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [schedulingOrder, setSchedulingOrder] = useState(false)
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null)
  const [mobileChat, setMobileChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef<Lock | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const orderDraftVersionRef = useRef(0)
  const scheduleActionIdRef = useRef<string | null>(null)

  const refreshList = useCallback(async () => {
    const items = await api<ConversationSummary[]>('/api/conversations')
    setConversations(items)
    setActiveId(current => current && items.some(item => item.id === current) ? current : items[0]?.id || null)
  }, [])
  useEffect(() => {
    Promise.all([api<CrmSessionUser>('/api/session'), refreshList()]).then(([session]) => setUser(session)).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo iniciar Atención.')).finally(() => setLoading(false))
  }, [refreshList])
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
  useEffect(() => { void refreshPickupLocations() }, [refreshPickupLocations])
  useEffect(() => { const timer = window.setInterval(() => refreshList().catch(() => undefined), 10_000); return () => window.clearInterval(timer) }, [refreshList])

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
  useEffect(() => {
    if (!activeId || !user) return
    let cancelled = false
    orderDraftVersionRef.current += 1
    setError(null); setDetail(null); setLock(null); setOrderDraft(EMPTY_ORDER_DRAFT); setOrderDraftDirty(false); setOrderSaveState('idle'); setSchedulingOrder(false); setScheduleFeedback(null); scheduleActionIdRef.current = null; lockRef.current = null; activeIdRef.current = activeId
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
  }, [activeId, user, acquire, refreshList])
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
      setDraft(''); setDetail(await api<ConversationDetail>(`/api/conversations/${detail.id}`)); await refreshList()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo enviar el mensaje.') }
    finally { setBusy(false) }
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

  const canEditOrderDraft = Boolean(detail && lock && !schedulingOrder && detail.assignedToId === user?.id && detail.status !== 'RESOLVED' && detail.status !== 'ARCHIVED')
  const changeOrderDraft = (patch: Partial<OrderDraft>) => {
    if (!canEditOrderDraft) return
    orderDraftVersionRef.current += 1
    setOrderDraft(current => ({ ...current, ...patch }))
    setOrderDraftDirty(true)
    setOrderSaveState('idle')
    setScheduleFeedback(null)
  }
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

  const counts = useMemo(() => ({ all: conversations.filter(c => c.status !== 'RESOLVED').length, mine: conversations.filter(c => c.assignedToId === user?.id && c.status !== 'RESOLVED').length, unassigned: conversations.filter(c => c.status === 'UNASSIGNED').length, waiting: conversations.filter(c => c.status === 'WAITING_CUSTOMER').length, resolved: conversations.filter(c => c.status === 'RESOLVED').length }), [conversations, user])
  const visible = useMemo(() => conversations.filter(c => {
    const matchesFilter = filter === 'all' ? c.status !== 'RESOLVED' : filter === 'mine' ? c.assignedToId === user?.id && c.status !== 'RESOLVED' : filter === 'unassigned' ? c.status === 'UNASSIGNED' : filter === 'waiting' ? c.status === 'WAITING_CUSTOMER' : c.status === 'RESOLVED'
    const term = search.trim().toLowerCase(); const haystack = `${c.contact.displayName} ${c.contact.profileName || ''} ${c.contact.phoneE164} ${c.lastMessage?.body || ''}`.toLowerCase()
    return matchesFilter && (!term || haystack.includes(term))
  }), [conversations, filter, search, user])
  const active = detail || conversations.find(item => item.id === activeId) || null
  const assignedToOther = Boolean(active?.assignedToId && active.assignedToId !== user?.id)
  const canReply = Boolean(active && lock && active.assignedToId === user?.id && active.status !== 'RESOLVED' && active.status !== 'ARCHIVED')
  const service = serviceWindow(active?.serviceWindowExpiresAt || null)
  const currentName = user?.name || 'Agente de Atención'
  const isSupervisor = user?.rol === 'ADMIN' || user?.permisos.permisoAtencionAdmin === true
  const orderCompleted = [
    Boolean(orderDraft.orderDate),
    Boolean(orderDraft.orderFulfillment),
    Boolean(orderDraft.orderShift),
    orderDraft.orderFulfillment === 'PICKUP'
      ? Boolean(orderDraft.orderPickupLocationId)
      : orderDraft.orderFulfillment === 'DELIVERY' && Boolean(orderDraft.orderAddress.trim()),
  ].filter(Boolean).length
  const scheduleOrder = async () => {
    const currentLock = lockRef.current
    if (!detail || !currentLock || orderCompleted !== 4 || orderDraftDirty || orderSaveState === 'saving') return
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
  if (!active) return <main className="workspaceLoading"><span className="brandMark">SC</span><strong>{error || 'Todavía no hay conversaciones.'}</strong></main>
  return <main className={`workspaceShell ${showContext ? 'contextOpen' : ''}`}>
    <aside className="navigationRail" aria-label="Navegación principal">
      <div className="brandMark" title="Santa Catalina Atención">SC</div>
      <nav className="railNav" aria-label="Bandejas">
        {FILTERS.map((item, index) => <button key={item.id} className={`railButton ${filter === item.id ? 'railButtonActive' : ''}`} aria-label={item.label} title={item.label} onClick={() => setFilter(item.id)}><Icon name={index === 0 ? 'inbox' : index === 1 ? 'chat' : index === 2 ? 'users' : index === 3 ? 'clock' : 'check'} /><span>{counts[item.id]}</span></button>)}
      </nav>
      <a className="railButton railSettings" aria-label="Configuración" title="Configuración" href="/settings"><Icon name="settings" /></a>
      <div className="railAgent" title={`${currentName} · Disponible`}><span className="onlineDot" /><Avatar name={currentName} small /></div>
    </aside>
    <section className={`conversationList ${mobileChat ? 'mobileHidden' : ''}`}>
      <header className="listHeader">
        <div className="listToolbar"><div><span className="brandEyebrow">Santa Catalina</span><h1>Chats</h1></div><div className="listActions"><span className="liveBadge"><i /> Conectado</span><a className="iconButton" aria-label="Configuración" href="/settings"><Icon name="settings" /></a></div></div>
        <label className="searchBox"><Icon name="search" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar un chat" /><kbd>/</kbd></label>
        <nav className="filterChips" aria-label="Filtrar conversaciones">{FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'filterActive' : ''} onClick={() => setFilter(item.id)}>{item.short}<span>{counts[item.id]}</span></button>)}</nav>
        <div className="listMeta"><span>{visible.length} conversaciones</span><span>{currentName}</span></div>
      </header>
      <div className="conversationCards">{visible.length === 0 ? <div className="emptyList"><span><Icon name="chat" size={28} /></span><strong>No hay conversaciones aquí</strong><p>Probá con otro filtro o búsqueda.</p></div> : visible.map(c => <button key={c.id} className={`conversationCard ${active.id === c.id ? 'conversationCardActive' : ''}`} onClick={() => selectConversation(c.id)}><div className="cardAvatarWrap"><Avatar name={c.contact.displayName} color={c.priority > 0 ? '#a3152f' : '#687782'} />{c.unreadCount > 0 && <span className="unreadCount">{c.unreadCount}</span>}</div><div className="cardContent"><div className="cardTop"><strong>{c.contact.displayName}</strong><time className={c.unreadCount ? 'timeUnread' : ''}>{formatTime(c.lastMessageAt)}</time></div><p className={c.unreadCount ? 'previewUnread' : ''}>{c.lastMessage?.direction === 'OUTBOUND' && <span className="previewChecks">✓✓</span>}{c.lastMessage?.body || 'Sin mensajes'}</p><div className="cardBottom"><span className="companyName">{c.contact.profileName || c.contact.phoneE164}</span><span className={`statusPill status-${c.status.toLowerCase()}`}>{c.status === 'UNASSIGNED' ? 'Sin asignar' : c.status === 'WAITING_CUSTOMER' ? 'En espera' : c.status === 'RESOLVED' ? 'Resuelta' : agentName(c.assignedToId)}</span>{c.priority > 0 && <span className="priorityPill">Prioridad</span>}</div></div></button>)}</div>
    </section>
    <section className={`chatPanel ${mobileChat ? 'mobileVisible' : ''}`}><header className="chatHeader"><button className="mobileBack" onClick={() => setMobileChat(false)} aria-label="Volver a los chats"><Icon name="back" /></button><button className="avatarButton" onClick={() => setShowContext(true)} aria-label="Ver información del cliente"><Avatar name={active.contact.displayName} color={active.priority > 0 ? '#a3152f' : '#687782'} /></button><div className="chatIdentity"><div><h2>{active.contact.displayName}</h2>{active.priority > 0 && <span className="priorityPill">Prioridad</span>}</div><span><i className="channelDot" />{assignedToOther ? `Atiende ${agentName(active.assignedToId)}` : active.assignedToId ? 'Conversación asignada a vos' : 'WhatsApp Business · sin asignar'}</span></div><div className="chatActions"><button className="iconButton" aria-label="Buscar en la conversación" title="Buscar"><Icon name="search" size={19} /></button><button className="iconButton" aria-label="Llamar al contacto" title="Llamar"><Icon name="phone" size={18} /></button>{isSupervisor && active.assignedToId && <button className="iconButton adminHeaderAction" onClick={unassignConversation} aria-label="Liberar chat" title="Liberar chat"><Icon name="lock" size={17} /></button>}<button className={`iconButton ${showContext ? 'iconButtonActive' : ''}`} onClick={() => setShowContext(v => !v)} aria-label="Información del cliente" title="Información del cliente"><Icon name="more" /></button></div></header>
      {error && <div className="errorBanner" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
      {assignedToOther && <div className="lockBanner"><span className="lockIcon"><Icon name="lock" size={18} /></span><div><strong>{agentName(active.assignedToId)} tiene asignada esta conversación</strong><span>Podés seguirla en tiempo real. La respuesta está bloqueada para evitar mensajes cruzados.</span></div><span className="watchingBadge">Sólo lectura</span></div>}
      {!active.assignedToId && <div className="claimBanner"><div><span className="claimSpinner" /><div><strong>{claiming ? 'Asignando conversación…' : 'Preparando la conversación…'}</strong><span>Quedará reservada automáticamente para vos.</span></div></div></div>}
      <div className="messageCanvas"><div className="dateDivider"><span>Hoy</span></div>{detail?.messages.map(m => m.direction === 'INTERNAL' ? <div className="systemNote" key={m.id}><span><Icon name="check" size={14} /></span>{m.body} · {formatTime(m.createdAt)}</div> : <div className={`messageRow ${m.direction === 'OUTBOUND' ? 'messageRowOut' : ''}`} key={m.id}><div className={`messageBubble ${m.direction === 'OUTBOUND' ? 'messageOut' : 'messageIn'}`}>{m.direction === 'OUTBOUND' && <span className="messageSender">{agentName(m.sentById) || 'Atención'}</span>}<p>{m.body || 'Mensaje sin texto'}</p><span className="messageTime">{formatTime(m.providerTimestamp || m.createdAt)}{m.direction === 'OUTBOUND' && <b className={m.status === 'READ' ? 'readChecks' : ''}>✓✓</b>}</span></div></div>)}</div>
      <div className="composerArea"><div className={`serviceWindow ${service.expired ? 'serviceWindowExpired' : ''}`}><Icon name="clock" size={14} /><span>{service.text}</span></div><form className={`composer ${!canReply ? 'composerDisabled' : ''}`} onSubmit={sendMessage}><button type="button" aria-label="Agregar emoji" disabled={!canReply}><Icon name="smile" /></button><button type="button" aria-label="Adjuntar archivo" disabled={!canReply}><Icon name="attach" /></button><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={assignedToOther ? `Respuesta bloqueada por ${agentName(active.assignedToId)}` : !active.assignedToId ? 'Tomá la conversación para responder' : active.status === 'RESOLVED' ? 'Conversación resuelta' : !lock ? 'Obteniendo control seguro…' : 'Escribe un mensaje'} rows={1} disabled={!canReply || busy} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} /><button className="sendButton" type="submit" aria-label="Enviar mensaje" disabled={!canReply || !draft.trim() || busy}><Icon name="send" size={18} /></button></form><div className="composerHints"><button disabled={!canReply}>/ respuestas rápidas</button><span>Enter para enviar · Shift + Enter para salto</span></div></div>
    </section>
    {showContext && <aside className="contextPanel">
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
        <div className="plannerHeading"><div><span>Ficha rápida</span><h4>Datos del pedido</h4></div><b className={orderCompleted === 4 ? 'plannerComplete' : ''}>{orderCompleted}/4</b></div>
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
        <button type="button" className="scheduleOrderButton" disabled={!canEditOrderDraft || orderCompleted !== 4 || orderDraftDirty || orderSaveState === 'saving' || schedulingOrder} onClick={() => void scheduleOrder()}><span><Icon name="check" size={18} /></span><span><strong>{schedulingOrder ? 'Agendando…' : 'Agendado'}</strong><small>{orderCompleted !== 4 ? 'Completá los 4 datos primero' : orderDraftDirty || orderSaveState === 'saving' ? 'Esperando el guardado automático…' : 'Marcar después de pasarlo al Excel'}</small></span></button>
        {scheduleFeedback && <div className="scheduleFeedback"><Icon name="check" size={14} /><span>{scheduleFeedback}</span></div>}
        <div className={`plannerSaveState state-${orderSaveState}`}><span>{orderSaveState === 'saving' ? '● Guardando…' : orderSaveState === 'error' ? '! No se pudo guardar' : orderSaveState === 'saved' ? '✓ Guardado automáticamente' : canEditOrderDraft ? 'Los cambios se guardan solos' : 'Sólo puede editar el agente que atiende'}</span>{orderCompleted === 4 && <b>Lista para agendar</b>}</div>
      </section>
      {detail && detail.scheduledOrders.length > 0 && <section className="scheduledHistory">
        <div className="sectionLabel"><span>Historial agendado</span><b>{detail.scheduledOrders.length}</b></div>
        <div className="scheduledOrderList">{detail.scheduledOrders.map(item => <article className="scheduledOrderCard" key={item.id}>
          <div className="scheduledOrderHeader"><span className="scheduledOrderCheck"><Icon name="check" size={14} /></span><div><small>Pedido para</small><strong>{formatOrderDate(item.orderDate)}</strong></div><div className="scheduledOrderBadges"><b className={item.orderFulfillment === 'PICKUP' ? 'pickupHistoryBadge' : ''}>{item.orderFulfillment === 'PICKUP' ? 'Retiro' : 'Envío'}</b><b className={item.orderPaid ? 'paidHistoryBadge' : 'unpaidHistoryBadge'}>{item.orderPaid ? 'Pagado' : 'Sin marcar'}</b></div></div>
          <dl><div><dt>Destino</dt><dd>{item.orderFulfillment === 'PICKUP' ? item.orderPickupLocationName || 'Local sin nombre' : item.orderAddress || 'Sin dirección'}</dd></div><div><dt>Turno</dt><dd>{shiftName(item.orderShift)}</dd></div><div><dt>Pago</dt><dd className={item.orderPaid ? 'paidOrderText' : ''}>{item.orderPaid ? 'Transferencia confirmada' : 'No marcado como pagado'}</dd></div></dl>
          <footer><Avatar name={item.scheduledByName} small /><div><span>Agendado por</span><strong>{item.scheduledByName}{item.scheduledById === user?.id ? ' (vos)' : ''}</strong></div><time>{formatScheduledAt(item.scheduledAt)}</time></footer>
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
        {customerContext?.status === 'LINKED' && customerContext.customer.recentOrders.length > 0 ? <div className="orderList">{customerContext.customer.recentOrders.map(order => <div className="orderCard" key={order.id}><span className="orderIcon"><Icon name="bag" size={16} /></span><div><strong>{formatDate(order.deliveryAt)} · {orderStatus(order.status)}</strong><span>{order.totalPacks} packs · {order.totalUnits} unidades</span></div><div className="orderAmount"><strong>{formatMoney(order.totalAmount)}</strong><span>{order.paid ? 'Abonado' : 'Pendiente'}</span></div></div>)}</div> : <div className="noOrder"><Icon name="bag" /><span>{customerContext?.status === 'LINKED' ? 'Todavía no tiene pedidos' : 'Vinculá el cliente para ver pedidos'}</span></div>}
      </section>
      <footer className="contextFooter"><button className={isSupervisor ? 'adminReleaseButton' : ''} onClick={isSupervisor ? unassignConversation : undefined} disabled={!isSupervisor || !active.assignedToId || busy}>{isSupervisor ? busy ? 'Liberando…' : 'Liberar chat' : 'Transferir'}</button><button className="resolveButton" disabled><Icon name="check" size={16} /> Resolver</button></footer>
    </aside>}
  </main>
}
