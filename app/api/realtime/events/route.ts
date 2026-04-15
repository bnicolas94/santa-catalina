import { eventBus } from '@/lib/events';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Mensaje de conexión inicial
            controller.enqueue(encoder.encode('data: { "type": "CONNECTED" }\n\n'));

            const onOrderUpdate = (data: any) => {
                const message = `data: ${JSON.stringify({ type: 'ORDER_UPDATED', ...data })}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            eventBus.on('order-updated', onOrderUpdate);

            // Mantener la conexión viva con un heartbeat cada 30 segundos
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode('data: { "type": "HEARTBEAT" }\n\n'));
                } catch (e) {
                    clearInterval(heartbeat);
                }
            }, 30000);

            req.signal.addEventListener('abort', () => {
                eventBus.off('order-updated', onOrderUpdate);
                clearInterval(heartbeat);
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
