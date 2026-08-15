'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './settings.module.css'

type Channel = {
  id: string
  name: string
  active: boolean
  phoneNumberId: string
  displayPhoneNumber: string | null
  wabaId: string
  businessPortfolioId: string | null
  graphApiVersion: string
  connectionStatus: string
  lastValidatedAt: string | null
  hasAccessToken: boolean
  hasAppSecret: boolean
  hasVerifyToken: boolean
  updatedAt: string
}
type Configuration = {
  encryptionStatus: 'READY' | 'MISSING' | 'INVALID'
  mockMode: boolean
  webhookUrl: string
}
type ValidationResult = {
  channel: Channel
  validation: { verifiedName: string | null; qualityRating: string | null; platformType: string | null }
}
type Draft = {
  name: string
  phoneNumberId: string
  displayPhoneNumber: string
  wabaId: string
  businessPortfolioId: string
  graphApiVersion: string
  accessToken: string
  appSecret: string
  webhookVerifyToken: string
  active: boolean
}

const EMPTY_DRAFT: Draft = {
  name: 'WhatsApp Santa Catalina', phoneNumberId: '', displayPhoneNumber: '', wabaId: '',
  businessPortfolioId: '', graphApiVersion: 'v23.0', accessToken: '', appSecret: '',
  webhookVerifyToken: '', active: false,
}

async function adminApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store', ...init,
    headers: { 'Content-Type': 'application/json', 'x-crm-demo-agent': 'admin', ...init?.headers },
  })
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.')
  return body as T
}

function draftFromChannel(channel: Channel): Draft {
  return {
    name: channel.name, phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber || '', wabaId: channel.wabaId,
    businessPortfolioId: channel.businessPortfolioId || '', graphApiVersion: channel.graphApiVersion,
    accessToken: '', appSecret: '', webhookVerifyToken: '', active: channel.active,
  }
}

function SecretField({ label, value, configured, disabled, placeholder, onChange }: {
  label: string; value: string; configured: boolean; disabled: boolean; placeholder: string; onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  return <label className={styles.field}>
    <span>{label}{configured && <b className={styles.savedBadge}>Guardado</b>}</span>
    <div className={styles.secretInput}>
      <input type={visible ? 'text' : 'password'} value={value} disabled={disabled} autoComplete="new-password" spellCheck={false} placeholder={configured ? '••••••••  Reemplazar valor' : placeholder} onChange={event => onChange(event.target.value)} />
      <button type="button" onClick={() => setVisible(current => !current)} disabled={disabled}>{visible ? 'Ocultar' : 'Mostrar'}</button>
    </div>
  </label>
}

export default function ChannelSettingsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [configuration, setConfiguration] = useState<Configuration | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const selected = channels.find(channel => channel.id === selectedId) || null
  const secretsReady = Boolean(
    (selected?.hasAccessToken || draft.accessToken)
    && (selected?.hasAppSecret || draft.appSecret)
    && (selected?.hasVerifyToken || draft.webhookVerifyToken),
  )
  const encryptionReady = configuration?.encryptionStatus === 'READY'
  const hasUnsavedValidationChanges = Boolean(selected && (
    draft.phoneNumberId !== selected.phoneNumberId
    || draft.wabaId !== selected.wabaId
    || draft.graphApiVersion !== selected.graphApiVersion
    || draft.accessToken || draft.appSecret || draft.webhookVerifyToken
  ))
  const metaValidated = Boolean(selected?.connectionStatus === 'CONNECTED' && !hasUnsavedValidationChanges)
  const canActivate = Boolean(selected && secretsReady && metaValidated)
  const completed = useMemo(() => [
    Boolean(draft.phoneNumberId && draft.wabaId),
    secretsReady,
    metaValidated,
    Boolean(selected?.active),
  ], [draft.phoneNumberId, draft.wabaId, secretsReady, metaValidated, selected?.active])

  const load = async () => {
    try {
      const [items, config] = await Promise.all([
        adminApi<Channel[]>('/api/admin/channels'),
        adminApi<Configuration>('/api/admin/configuration'),
      ])
      setChannels(items)
      setConfiguration(config)
      const next = items.find(item => item.id === selectedId) || items[0] || null
      setSelectedId(next?.id || null)
      setDraft(next ? draftFromChannel(next) : EMPTY_DRAFT)
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const selectChannel = (channel: Channel) => {
    setSelectedId(channel.id)
    setDraft(draftFromChannel(channel))
    setMessage(null)
  }
  const newChannel = () => {
    setSelectedId(null)
    setDraft(EMPTY_DRAFT)
    setMessage(null)
  }
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }))

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        name: draft.name, phoneNumberId: draft.phoneNumberId, displayPhoneNumber: draft.displayPhoneNumber,
        wabaId: draft.wabaId, businessPortfolioId: draft.businessPortfolioId,
        graphApiVersion: draft.graphApiVersion, active: draft.active,
        ...(draft.accessToken && { accessToken: draft.accessToken }),
        ...(draft.appSecret && { appSecret: draft.appSecret }),
        ...(draft.webhookVerifyToken && { webhookVerifyToken: draft.webhookVerifyToken }),
      }
      const channel = await adminApi<Channel>(selectedId ? `/api/admin/channels/${selectedId}` : '/api/admin/channels', {
        method: selectedId ? 'PUT' : 'POST', body: JSON.stringify(payload),
      })
      setChannels(current => selectedId ? current.map(item => item.id === channel.id ? channel : item) : [...current, channel])
      setSelectedId(channel.id)
      setDraft(draftFromChannel(channel))
      setMessage({ type: 'ok', text: 'Configuración guardada. Los secretos permanecen cifrados y no vuelven al navegador.' })
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'No se pudo guardar la configuración.' })
    } finally {
      setSaving(false)
    }
  }

  const copyWebhook = async () => {
    if (!configuration?.webhookUrl) return
    await navigator.clipboard.writeText(configuration.webhookUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const validateConnection = async () => {
    if (!selected) return
    setValidating(true)
    setMessage(null)
    try {
      const result = await adminApi<ValidationResult>(`/api/admin/channels/${selected.id}/validate`, { method: 'POST', body: '{}' })
      setChannels(current => current.map(item => item.id === result.channel.id ? result.channel : item))
      setDraft(draftFromChannel(result.channel))
      const detail = [result.validation.verifiedName, result.validation.qualityRating].filter(Boolean).join(' · ')
      setMessage({ type: 'ok', text: `Meta validó el token, el WABA y el número${detail ? `: ${detail}` : '.'}` })
    } catch (cause) {
      setMessage({ type: 'error', text: cause instanceof Error ? cause.message : 'No se pudo validar la conexión con Meta.' })
      await load()
    } finally {
      setValidating(false)
    }
  }

  if (loading) return <main className={styles.loading}><span>SC</span><strong>Preparando configuración segura…</strong></main>

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/" aria-label="Volver a conversaciones">SC</Link>
      <div className={styles.sideHeading}><span>Administración</span><h1>Canales</h1></div>
      <button className={styles.newButton} onClick={newChannel}><span>+</span> Nuevo canal</button>
      <div className={styles.channelList}>
        {channels.map(channel => <button key={channel.id} className={selectedId === channel.id ? styles.channelActive : ''} onClick={() => selectChannel(channel)}>
          <span className={styles.channelIcon}>W</span><span><strong>{channel.name}</strong><small>{channel.displayPhoneNumber || 'Sin número visible'}</small></span><i className={channel.active ? styles.dotOnline : styles.dotPending} />
        </button>)}
      </div>
      <div className={styles.securityNote}><span>◇</span><div><strong>Secretos protegidos</strong><p>AES-256-GCM en reposo. Nunca se muestran después de guardar.</p></div></div>
      <Link className={styles.backLink} href="/">← Volver a conversaciones</Link>
    </aside>

    <section className={styles.content}>
      <header className={styles.header}><div><span>Centro de conexiones</span><h2>WhatsApp Business</h2><p>Configurá Meta Cloud API sin exponer credenciales al equipo de atención.</p></div><div className={styles.headerStatus}><i className={configuration?.mockMode ? styles.dotPending : styles.dotOnline} /><span><b>{configuration?.mockMode ? 'Modo simulado' : 'Proveedor real'}</b><small>{configuration?.mockMode ? 'No se enviarán mensajes a Meta' : 'Los mensajes se enviarán a Meta'}</small></span></div></header>

      {configuration?.encryptionStatus !== 'READY' && <div className={styles.warning}><span>!</span><div><strong>{configuration?.encryptionStatus === 'INVALID' ? 'La clave maestra no es válida' : 'Falta configurar la clave maestra'}</strong><p>Definí `WHATSAPP_CONFIG_ENCRYPTION_KEY` con 32 bytes en base64 antes de guardar Access Token, App Secret o Verify Token.</p></div></div>}
      {message && <div className={message.type === 'ok' ? styles.success : styles.error} role="status"><span>{message.type === 'ok' ? '✓' : '!'}</span>{message.text}<button onClick={() => setMessage(null)}>×</button></div>}

      <div className={styles.grid}>
        <form className={styles.formCard} onSubmit={save}>
          <div className={styles.cardHeader}><div><span className={styles.step}>01</span><div><h3>Identidad del canal</h3><p>Datos visibles e identificadores entregados por Meta.</p></div></div><label className={styles.switch}><input type="checkbox" checked={draft.active} disabled={!selected?.active && !canActivate} onChange={event => update('active', event.target.checked)} /><span /><b>{draft.active ? 'Activo' : 'Inactivo'}</b></label></div>
          <div className={styles.fieldsGrid}>
            <label className={styles.field}><span>Nombre interno</span><input required maxLength={100} value={draft.name} onChange={event => update('name', event.target.value)} placeholder="WhatsApp Santa Catalina" /></label>
            <label className={styles.field}><span>Número visible</span><input maxLength={50} value={draft.displayPhoneNumber} onChange={event => update('displayPhoneNumber', event.target.value)} placeholder="+54 9 11…" /></label>
            <label className={styles.field}><span>Phone Number ID</span><input required maxLength={100} value={draft.phoneNumberId} onChange={event => update('phoneNumberId', event.target.value)} placeholder="Ej. 1029384756" /></label>
            <label className={styles.field}><span>WhatsApp Business Account ID</span><input required maxLength={100} value={draft.wabaId} onChange={event => update('wabaId', event.target.value)} placeholder="WABA ID" /></label>
            <label className={styles.field}><span>Business Portfolio ID <em>Opcional</em></span><input maxLength={100} value={draft.businessPortfolioId} onChange={event => update('businessPortfolioId', event.target.value)} placeholder="Portfolio ID" /></label>
            <label className={styles.field}><span>Versión Graph API</span><input required maxLength={30} value={draft.graphApiVersion} onChange={event => update('graphApiVersion', event.target.value)} placeholder="v23.0" /></label>
          </div>

          <div className={styles.divider} />
          <div className={styles.cardHeader}><div><span className={styles.step}>02</span><div><h3>Credenciales cifradas</h3><p>Dejá un campo vacío para conservar el valor guardado.</p></div></div></div>
          <div className={styles.secretGrid}>
            <SecretField label="Access Token permanente" value={draft.accessToken} configured={Boolean(selected?.hasAccessToken)} disabled={!encryptionReady} placeholder="EAAB…" onChange={value => update('accessToken', value)} />
            <SecretField label="App Secret" value={draft.appSecret} configured={Boolean(selected?.hasAppSecret)} disabled={!encryptionReady} placeholder="App Secret de Meta" onChange={value => update('appSecret', value)} />
            <SecretField label="Webhook Verify Token" value={draft.webhookVerifyToken} configured={Boolean(selected?.hasVerifyToken)} disabled={!encryptionReady} placeholder="Token elegido por Santa Catalina" onChange={value => update('webhookVerifyToken', value)} />
          </div>
          <footer className={styles.formFooter}><div><span>●</span><p>{selected ? `Última actualización: ${new Date(selected.updatedAt).toLocaleString('es-AR')}` : 'El canal se creará inicialmente inactivo.'}</p></div><button type="submit" disabled={saving}>{saving ? 'Guardando…' : selected ? 'Guardar cambios' : 'Crear canal'}</button></footer>
        </form>

        <aside className={styles.helpColumn}>
          <section className={styles.webhookCard}><div className={styles.cardHeader}><div><span className={styles.step}>03</span><div><h3>Webhook de Meta</h3><p>Usá esta URL en WhatsApp → Configuración.</p></div></div></div><label><span>Callback URL</span><div><code>{configuration?.webhookUrl}</code><button onClick={copyWebhook}>{copied ? 'Copiado' : 'Copiar'}</button></div></label><p className={styles.webhookHint}>Meta validará esta URL usando el Verify Token guardado. Los eventos entrantes también requieren una firma válida del App Secret.</p><button className={styles.validateButton} type="button" disabled={!selected || !selected.hasAccessToken || !selected.hasAppSecret || !selected.hasVerifyToken || hasUnsavedValidationChanges || validating} onClick={validateConnection}>{validating ? 'Consultando Meta…' : metaValidated ? '✓ Conexión validada' : 'Validar conexión con Meta'}</button>{selected?.lastValidatedAt && <p className={styles.validationMeta}>Último intento: {new Date(selected.lastValidatedAt).toLocaleString('es-AR')}</p>}</section>
          <section className={styles.progressCard}><span className={styles.eyebrow}>Preparación</span><h3>{completed.filter(Boolean).length} de 4 pasos listos</h3><div className={styles.progress}><i style={{ width: `${completed.filter(Boolean).length / 4 * 100}%` }} /></div><ol><li className={completed[0] ? styles.done : ''}><span>{completed[0] ? '✓' : '1'}</span><div><strong>Identidad del canal</strong><small>Phone Number ID y WABA ID</small></div></li><li className={completed[1] ? styles.done : ''}><span>{completed[1] ? '✓' : '2'}</span><div><strong>Credenciales seguras</strong><small>Los tres secretos cifrados</small></div></li><li className={completed[2] ? styles.done : ''}><span>{completed[2] ? '✓' : '3'}</span><div><strong>Validación con Meta</strong><small>Token y número confirmados</small></div></li><li className={completed[3] ? styles.done : ''}><span>{completed[3] ? '✓' : '4'}</span><div><strong>Canal activo</strong><small>Listo para recibir eventos</small></div></li></ol></section>
          <section className={styles.tipCard}><span>✦</span><div><strong>Activación segura</strong><p>El servidor no permite activar un canal hasta que los tres secretos estén configurados.</p></div></section>
        </aside>
      </div>
    </section>
  </main>
}
