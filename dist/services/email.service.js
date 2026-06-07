import { Resend } from 'resend';
import logger from '../config/logger.js';
import config from '../config/env.js';
const resend = new Resend(config.services.resend.apiKey);
export async function enviarCodigoVerificacion(email, nombre, codigo) {
    try {
        const { error } = await resend.emails.send({
            from: config.services.resend.fromEmail,
            to: [email],
            subject: 'Código de verificación - LexAI Perú',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1d4ed8; margin-bottom: 8px;">LexAI Perú</h2>
          <p style="color: #374151;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #374151;">Tu código de verificación es:</p>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8;">${codigo}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Este código expira en 15 minutos.</p>
          <p style="color: #6b7280; font-size: 14px;">Si no solicitaste este código, ignora este correo.</p>
        </div>
      `,
        });
        if (error) {
            throw new Error(`Resend error: ${error.message}`);
        }
        logger.info(`✓ Código de verificación enviado a ${email}`);
    }
    catch (error) {
        logger.error('Error al enviar código de verificación:', error);
        throw error;
    }
}
//# sourceMappingURL=email.service.js.map