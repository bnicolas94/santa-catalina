import { PrismaClient, type ConversationStatus, type MessageStatus } from '../generated/prisma'

const prisma = new PrismaClient()
const HOUR = 60 * 60 * 1000

const conversations = [
  {
    id: 'demo-conv-carolina',
    contact: { id: 'demo-contact-carolina', waId: '5491100001001', phoneE164: '+5491100001001', displayName: 'Carolina Méndez', profileName: 'Almacén La Esquina' },
    status: 'OPEN' as ConversationStatus,
    priority: 10,
    assignedToId: 'agent-marina',
    unreadCount: 2,
    serviceHours: 18,
    messages: [
      ['demo-msg-carolina-1', 'INBOUND', 'RECEIVED', 'Hola Marina, buen día. Te consulto por el pedido de mañana.', -12],
      ['demo-msg-carolina-2', 'OUTBOUND', 'READ', 'Buen día, Caro. Ya lo tengo abierto, decime tranquila.', -9],
      ['demo-msg-carolina-3', 'INBOUND', 'RECEIVED', '¿Podemos sumar dos bandejas de triples clásicos al pedido?', -3],
    ],
  },
  {
    id: 'demo-conv-nicolas',
    contact: { id: 'demo-contact-nicolas', waId: '5491100001002', phoneE164: '+5491100001002', displayName: 'Nicolás Ferreyra', profileName: 'Café Belgrano' },
    status: 'UNASSIGNED' as ConversationStatus,
    priority: 0,
    assignedToId: null,
    unreadCount: 1,
    serviceHours: 23,
    messages: [
      ['demo-msg-nicolas-1', 'INBOUND', 'RECEIVED', 'Hola, quisiera conocer los precios mayoristas y los días de entrega por Belgrano.', -18],
    ],
  },
  {
    id: 'demo-conv-daniela',
    contact: { id: 'demo-contact-daniela', waId: '5491100001003', phoneE164: '+5491100001003', displayName: 'Daniela Pereyra', profileName: 'Kiosco Los Amigos' },
    status: 'OPEN' as ConversationStatus,
    priority: 0,
    assignedToId: 'agent-lucia',
    unreadCount: 0,
    serviceHours: 21,
    messages: [
      ['demo-msg-daniela-1', 'INBOUND', 'RECEIVED', 'El chofer me avisó que llega cerca del mediodía.', -54],
      ['demo-msg-daniela-2', 'OUTBOUND', 'READ', 'Sí, confirmamos que tu pedido ya está en reparto.', -48],
      ['demo-msg-daniela-3', 'INBOUND', 'RECEIVED', 'Perfecto, muchas gracias por resolverlo.', -43],
    ],
  },
  {
    id: 'demo-conv-martin',
    contact: { id: 'demo-contact-martin', waId: '5491100001004', phoneE164: '+5491100001004', displayName: 'Martín Acosta', profileName: 'Eventos Magnolia' },
    status: 'WAITING_CUSTOMER' as ConversationStatus,
    priority: 0,
    assignedToId: 'agent-marina',
    unreadCount: 0,
    serviceHours: -2,
    messages: [
      ['demo-msg-martin-1', 'OUTBOUND', 'DELIVERED', 'Te envié las opciones para 80 personas. Cuando definas la variedad, te confirmo disponibilidad.', -190],
      ['demo-msg-martin-2', 'INBOUND', 'RECEIVED', 'Quedo atento a la confirmación para el sábado.', -180],
    ],
  },
  {
    id: 'demo-conv-silvia',
    contact: { id: 'demo-contact-silvia', waId: '5491100001005', phoneE164: '+5491100001005', displayName: 'Silvia Duarte', profileName: 'Estación Central' },
    status: 'RESOLVED' as ConversationStatus,
    priority: 0,
    assignedToId: 'agent-marina',
    unreadCount: 0,
    serviceHours: -48,
    messages: [
      ['demo-msg-silvia-1', 'INBOUND', 'RECEIVED', 'Gracias por la atención, quedó todo perfecto.', -2880],
    ],
  },
] as const

async function main() {
  const now = new Date()
  const channel = await prisma.whatsAppChannel.upsert({
    where: { phoneNumberId: 'demo-phone-number-id' },
    update: { name: 'WhatsApp demostración', connectionStatus: 'DEMO', updatedById: 'seed' },
    create: {
      id: 'demo-channel',
      name: 'WhatsApp demostración',
      active: false,
      phoneNumberId: 'demo-phone-number-id',
      displayPhoneNumber: '+54 9 11 0000-0000',
      wabaId: 'demo-waba-id',
      graphApiVersion: 'v23.0',
      connectionStatus: 'DEMO',
      createdById: 'seed',
      updatedById: 'seed',
    },
  })

  const tag = await prisma.tag.upsert({
    where: { name: 'Demostración' },
    update: { color: '#A3152F', active: true },
    create: { id: 'demo-tag', name: 'Demostración', color: '#A3152F' },
  })

  for (const item of conversations) {
    const contact = await prisma.contact.upsert({
      where: { waId: item.contact.waId },
      update: item.contact,
      create: item.contact,
    })
    const lastOffset = item.messages[item.messages.length - 1][4]
    const lastMessageAt = new Date(now.getTime() + lastOffset * 60_000)
    const conversation = await prisma.conversation.upsert({
      where: { id: item.id },
      update: {
        channelId: channel.id,
        contactId: contact.id,
        status: item.status,
        priority: item.priority,
        assignedToId: item.assignedToId,
        activeById: null,
        lockToken: null,
        lockExpiresAt: null,
        unreadCount: item.unreadCount,
        lastMessageAt,
        lastInboundAt: lastMessageAt,
        serviceWindowExpiresAt: new Date(now.getTime() + item.serviceHours * HOUR),
        resolvedAt: item.status === 'RESOLVED' ? lastMessageAt : null,
      },
      create: {
        id: item.id,
        channelId: channel.id,
        contactId: contact.id,
        status: item.status,
        priority: item.priority,
        assignedToId: item.assignedToId,
        unreadCount: item.unreadCount,
        lastMessageAt,
        lastInboundAt: lastMessageAt,
        serviceWindowExpiresAt: new Date(now.getTime() + item.serviceHours * HOUR),
        resolvedAt: item.status === 'RESOLVED' ? lastMessageAt : null,
      },
    })

    await prisma.conversationTag.upsert({
      where: { conversationId_tagId: { conversationId: conversation.id, tagId: tag.id } },
      update: {},
      create: { conversationId: conversation.id, tagId: tag.id, addedById: 'seed' },
    })

    await prisma.message.deleteMany({
      where: {
        conversationId: conversation.id,
        id: { notIn: item.messages.map(message => message[0]) },
      },
    })

    for (const [id, direction, status, body, minuteOffset] of item.messages) {
      const timestamp = new Date(now.getTime() + minuteOffset * 60_000)
      await prisma.message.upsert({
        where: { id },
        update: { direction, status: status as MessageStatus, body, providerTimestamp: timestamp },
        create: {
          id,
          conversationId: conversation.id,
          waMessageId: `demo-wa-${id}`,
          direction,
          type: 'TEXT',
          status: status as MessageStatus,
          body,
          sentById: direction === 'OUTBOUND' ? item.assignedToId : null,
          providerTimestamp: timestamp,
        },
      })
    }
  }

  console.log(`CRM demo listo: ${conversations.length} conversaciones, canal ${channel.id}`)
}

main()
  .finally(() => prisma.$disconnect())
