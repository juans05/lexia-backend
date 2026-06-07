import express from 'express';
import cors from 'cors';

const app = express();

// Middleware básico
app.use(cors());
app.use(express.json());

// Health check - responde inmediatamente
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', service: 'lexai-backend', uptime: process.uptime() });
});

// Health check simple
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Iniciar servidor
const PORT = parseInt(process.env.PORT || '3000', 10);

let server: any = null;

export async function iniciarServidor(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] Iniciando servidor en puerto ${PORT}...`);

    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[${new Date().toISOString()}] ✅ Servidor operacional en puerto ${PORT}`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM recibido, cerrando servidor...');
      if (server) {
        server.close(() => {
          console.log('Servidor cerrado');
          process.exit(0);
        });
      }
    });

    process.on('SIGINT', () => {
      console.log('SIGINT recibido, cerrando servidor...');
      if (server) {
        server.close(() => {
          console.log('Servidor cerrado');
          process.exit(0);
        });
      }
    });
  } catch (error) {
    console.error('Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Ejecutar
iniciarServidor();

export default app;
