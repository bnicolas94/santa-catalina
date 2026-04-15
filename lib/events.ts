import { EventEmitter } from 'events';

// Usamos el mismo patrón que con Prisma para evitar problemas con Hot Module Replacement en desarrollo
const globalForEvents = globalThis as unknown as {
  eventBus: EventEmitter | undefined
}

export const eventBus =
  globalForEvents.eventBus ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') globalForEvents.eventBus = eventBus;
