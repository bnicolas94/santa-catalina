'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ConversationStatus, CrmSessionUser, CustomerContextResponse, ErpCustomerCandidate } from '@santa-catalina/contracts'

type ApiTag = { id: string; name: string; color: string }
type ApiContact = { id: string; displayName: string; profileName: string | null; phoneE164: string }
type ApiMessage = { id: string; direction: 'INBOUND' | 'OUTBOUND' | 'INTERNAL'; body: string | null; status: 'RECEIVED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'; sentById: string | null; providerTimestamp: string | null; createdAt: string }
type ConversationSummary = { id: string; status: ConversationStatus; priority: number; assignedToId: string | null; activeById: string | null; lockExpiresAt: string | null; unreadCount: number; lastMessageAt: string; serviceWindowExpiresAt: string | null; contact: ApiContact; tags: ApiTag[]; lastMessage: ApiMessage | null }
type ConversationDetail = ConversationSummary & { messages: ApiMessage[] }
type Lock = { token: string; expiresAt: string; version: number; activeById: string; assignedToId: string }
type FilterId = 'all' | 'mine' | 'unassigned' | 'waiting' | 'resolved'

const DEMO_AGENT_NAMES: Record<string, string> = { 'agent-marina': 'Marina Soto', 'agent-lucia': 'Lucía Rojas', 'agent-admin': 'Administración' }
const FILTERS: Array<{ id: FilterId; label: string; short: string }> = [
  { id: 'all', label: 'Todas', short: 'Inicio' }, { id: 'mine', label: 'Mis conversaciones', short: 'Mías' },
  { id: 'unassigned', label: 'Sin asignar', short: 'Nuevas' }, { id: 'waiting', label: 'En espera', short: 'Espera' },
  { id: 'resolved', label: 'Resueltas', short: 'Cerradas' },
]

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    inbox: <><path d="M4 5h16v12H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>, chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, check: <path d="m5 12 4 4L19 6"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 15l2 2-4 4-2-2M9 21H5v-4l-2-2 2-3-2-3 3-3 3 2 3-2 3 2 3-1 2 3-2 3"/></>, more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    back: <path d="m15 18-6-6 6-6"/>, attach: <path d="m21 12-9 9a6 6 0 0 1-9-9l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 1 1-3-3l8-8"/>, smile: <><circle cx="12" cy="12" r="9"/><path d="M8 14s2 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>, lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>, bag: <><path d="M6 8h12l1 13H5z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    phone: <path d="M22 17v3a2 2 0 0 1-2 2 20 20 0 0 1-9-3 20 20 0 0 1-6-6A20 20 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2l1 3-2 3a16 16 0 0 0 6 6l3-2 3 1a2 2 0 0 1 2 2z"/>, note: <><path d="M4 3h16v18H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'SC' }
function agentName(id?: string | null) { return id ? DEMO_AGENT_NAMES[id] || 'Otro agente' : '' }
function formatTime(value: string) { return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value)) }
function formatMoney(value: number) { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value) }
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
  const [mobileChat, setMobileChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lockRef = useRef<Lock | null>(null)
  const activeIdRef = useRef<string | null>(null)

  const refreshList = useCallback(async () => {
    const items = await api<ConversationSummary[]>('/api/conversations')
    setConversations(items)
    setActiveId(current => current || items[0]?.id || null)
  }, [])
  useEffect(() => {
    Promise.all([api<CrmSessionUser>('/api/session'), refreshList()]).then(([session]) => setUser(session)).catch(cause => setError(cause instanceof Error ? cause.message : 'No se pudo iniciar Atención.')).finally(() => setLoading(false))
  }, [refreshList])
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
    setLock(result.lock); lockRef.current = result.lock; return result.lock
  }, [])
  useEffect(() => {
    if (!activeId || !user) return
    let cancelled = false
    setError(null); setDetail(null); setLock(null); lockRef.current = null; activeIdRef.current = activeId
    api<ConversationDetail>(`/api/conversations/${activeId}`).then(async conversation => {
      if (cancelled) return
      setDetail(conversation)
      if (conversation.assignedToId === user.id && conversation.status !== 'RESOLVED' && conversation.status !== 'ARCHIVED') await acquire(conversation.id)
    }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo abrir la conversación.') })
    return () => { cancelled = true }
  }, [activeId, user, acquire])
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
  const claimConversation = async () => {
    if (!detail) return
    setBusy(true); setError(null)
    try { await acquire(detail.id); setDetail({ ...detail, status: 'OPEN', assignedToId: user?.id || null }); await refreshList() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo tomar la conversación.'); await refreshList() }
    finally { setBusy(false) }
  }
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

  if (loading) return <main className="workspaceLoading"><span className="brandMark">SC</span><strong>Preparando tu bandeja…</strong></main>
  if (!active) return <main className="workspaceLoading"><span className="brandMark">SC</span><strong>{error || 'Todavía no hay conversaciones.'}</strong></main>
  return <main className="workspaceShell">
    <aside className="navigationRail" aria-label="Navegación principal"><div className="brandMark">SC</div><nav className="railNav"><button className="railButton railButtonActive" aria-label="Conversaciones"><Icon name="chat" /></button><button className="railButton" aria-label="Equipo"><Icon name="users" /></button><a className="railButton" aria-label="Configuración" href="/settings"><Icon name="settings" /></a></nav><div className="railAgent"><span className="onlineDot" /><Avatar name={currentName} small /></div></aside>
    <aside className="queueSidebar"><header className="queueBrand"><div><span className="brandEyebrow">Santa Catalina</span><strong>Atención</strong></div><button className="iconButton"><Icon name="more" /></button></header><div className="agentStatus"><Avatar name={currentName} /><div><strong>{currentName}</strong><span><i /> Disponible para atender</span></div></div><nav className="filterNav">{FILTERS.map((item, index) => <button key={item.id} className={filter === item.id ? 'filterActive' : ''} onClick={() => setFilter(item.id)}><span className="filterIcon"><Icon name={index === 0 ? 'inbox' : index === 1 ? 'chat' : index === 2 ? 'users' : index === 3 ? 'clock' : 'check'} size={18} /></span><span>{item.label}</span><b>{counts[item.id]}</b></button>)}</nav><div className="teamPulse"><div className="pulseHeader"><span>Estado operativo</span><b>API activa</b></div><div className="avatarStack"><Avatar name="Marina Soto" small /><Avatar name="Lucía Rojas" color="#5b6fc7" small /></div><p>Bloqueo renovado cada <strong>25 s</strong></p></div><footer className="queueFooter"><span className="whatsappDot">W</span><div><strong>WhatsApp protegido</strong><span>Modo simulado habilitado</span></div></footer></aside>
    <section className={`conversationList ${mobileChat ? 'mobileHidden' : ''}`}><header className="listHeader"><div className="listTitle"><div><span>Bandeja de entrada</span><h1>{FILTERS.find(item => item.id === filter)?.short}</h1></div><span className="liveBadge"><i /> En vivo</span></div><label className="searchBox"><Icon name="search" size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente o mensaje" /><kbd>/</kbd></label><div className="listMeta"><span>{visible.length} conversaciones</span><button>Ordenar: recientes <span>⌄</span></button></div></header><div className="conversationCards">{visible.length === 0 ? <div className="emptyList"><span><Icon name="chat" size={28} /></span><strong>No hay conversaciones aquí</strong><p>Probá con otra bandeja o búsqueda.</p></div> : visible.map(c => <button key={c.id} className={`conversationCard ${active.id === c.id ? 'conversationCardActive' : ''}`} onClick={() => selectConversation(c.id)}><div className="cardAvatarWrap"><Avatar name={c.contact.displayName} color={c.priority > 0 ? '#a3152f' : '#67717f'} />{c.unreadCount > 0 && <span className="unreadCount">{c.unreadCount}</span>}</div><div className="cardContent"><div className="cardTop"><strong>{c.contact.displayName}</strong><time>{formatTime(c.lastMessageAt)}</time></div><span className="companyName">{c.contact.profileName || c.contact.phoneE164}</span><p className={c.unreadCount ? 'previewUnread' : ''}>{c.lastMessage?.body || 'Sin mensajes'}</p><div className="cardBottom"><span className={`statusPill status-${c.status.toLowerCase()}`}>{c.status === 'UNASSIGNED' ? 'Sin asignar' : c.status === 'WAITING_CUSTOMER' ? 'En espera' : c.status === 'RESOLVED' ? 'Resuelta' : agentName(c.assignedToId)}</span>{c.priority > 0 && <span className="priorityPill">Prioridad</span>}</div></div></button>)}</div></section>
    <section className={`chatPanel ${mobileChat ? 'mobileVisible' : ''}`}><header className="chatHeader"><button className="mobileBack" onClick={() => setMobileChat(false)}><Icon name="back" /></button><Avatar name={active.contact.displayName} color={active.priority > 0 ? '#a3152f' : '#67717f'} /><div className="chatIdentity"><div><h2>{active.contact.displayName}</h2>{active.priority > 0 && <span className="priorityPill">Prioridad</span>}</div><span>{active.contact.profileName || active.contact.phoneE164} · WhatsApp</span></div><div className="chatActions"><button className="softButton"><Icon name="phone" size={17} /><span>Llamar</span></button><button className="iconButton" onClick={() => setShowContext(v => !v)}><Icon name="more" /></button></div></header>
      {error && <div className="errorBanner" role="alert">{error}<button onClick={() => setError(null)}>×</button></div>}
      {assignedToOther && <div className="lockBanner"><span className="lockIcon"><Icon name="lock" size={18} /></span><div><strong>{agentName(active.assignedToId)} tiene asignada esta conversación</strong><span>Podés seguirla en tiempo real. La respuesta está bloqueada para evitar mensajes cruzados.</span></div><span className="watchingBadge">Sólo lectura</span></div>}
      {!active.assignedToId && <div className="claimBanner"><div><span className="spark">+</span><div><strong>Esta consulta espera un agente</strong><span>Al tomarla quedará asignada a vos.</span></div></div><button onClick={claimConversation} disabled={busy}>{busy ? 'Tomando…' : 'Tomar conversación'}</button></div>}
      <div className="messageCanvas"><div className="dateDivider"><span>Conversación</span></div>{detail?.messages.map(m => m.direction === 'INTERNAL' ? <div className="systemNote" key={m.id}><span><Icon name="check" size={14} /></span>{m.body} · {formatTime(m.createdAt)}</div> : <div className={`messageRow ${m.direction === 'OUTBOUND' ? 'messageRowOut' : ''}`} key={m.id}><div className={`messageBubble ${m.direction === 'OUTBOUND' ? 'messageOut' : 'messageIn'}`}>{m.direction === 'OUTBOUND' && <span className="messageSender">{agentName(m.sentById) || 'Atención'}</span>}<p>{m.body || 'Mensaje sin texto'}</p><span className="messageTime">{formatTime(m.providerTimestamp || m.createdAt)}{m.direction === 'OUTBOUND' && <b className={m.status === 'READ' ? 'readChecks' : ''}>✓✓</b>}</span></div></div>)}</div>
      <div className="composerArea"><div className={`serviceWindow ${service.expired ? 'serviceWindowExpired' : ''}`}><Icon name="clock" size={14} /><span>{service.text}</span></div><form className={`composer ${!canReply ? 'composerDisabled' : ''}`} onSubmit={sendMessage}><button type="button" aria-label="Adjuntar archivo" disabled={!canReply}><Icon name="attach" /></button><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={assignedToOther ? `Respuesta bloqueada por ${agentName(active.assignedToId)}` : !active.assignedToId ? 'Tomá la conversación para responder' : active.status === 'RESOLVED' ? 'Conversación resuelta' : !lock ? 'Obteniendo control seguro…' : 'Escribí un mensaje…'} rows={1} disabled={!canReply || busy} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} /><button type="button" aria-label="Agregar emoji" disabled={!canReply}><Icon name="smile" /></button><button className="sendButton" type="submit" aria-label="Enviar mensaje" disabled={!canReply || !draft.trim() || busy}><Icon name="send" size={18} /></button></form><div className="composerHints"><button disabled={!canReply}>/ respuestas rápidas</button><span>Enter para enviar · Shift + Enter para salto</span></div></div>
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
      <section className="detailSection notesSection"><div className="sectionLabel"><span>Seguridad operativa</span></div><div className="internalNote"><Icon name="note" size={16} /><p>El editor se habilita solamente mientras este agente conserva el lease activo.</p><span>Renovación automática cada 25 segundos</span></div></section>
      <footer className="contextFooter"><button disabled>Transferir</button><button className="resolveButton" disabled><Icon name="check" size={16} /> Resolver</button></footer>
    </aside>}
  </main>
}
