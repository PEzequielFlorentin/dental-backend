const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendVerificationCode(email, code) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Código de Verificación - Sistema Dental',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #033f63; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; background-color: #f9f9f9; text-align: center; }
              .code { 
                font-size: 48px; 
                font-weight: bold; 
                color: #28a745; 
                letter-spacing: 10px;
                margin: 30px 0;
                padding: 20px;
                background-color: #e8f5e9;
                border-radius: 10px;
              }
              .warning { 
                background-color: #fff3cd; 
                border: 1px solid #ffeaa7; 
                color: #856404; 
                padding: 15px; 
                border-radius: 5px;
                margin: 20px 0;
                font-size: 14px;
              }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Sistema de Gestión Dental</h1>
              </div>
              <div class="content">
                <h2>Recuperación de Contraseña</h2>
                <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
                <p>Tu código de verificación es:</p>
                <div class="code">${code}</div>
                <p>Este código expirará en <strong>10 minutos</strong>.</p>
                <div class="warning">
                  <strong>⚠️ Importante:</strong> Si no solicitaste este cambio, ignora este mensaje.
                  Nunca compartas este código con nadie.
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Sistema de Gestión Dental</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error('Error Resend:', error);
        throw new Error('Error al enviar el email');
      }

      console.log(`✅ Email enviado a ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Error enviando email:', error);
      throw new Error('Error al enviar el email');
    }
  }

  async sendPasswordChangedEmail(email) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Contraseña Actualizada - Sistema Dental',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #033f63; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; background-color: #f9f9f9; }
              .success { 
                background-color: #d4edda; 
                border: 1px solid #c3e6cb; 
                color: #155724; 
                padding: 20px; 
                border-radius: 5px;
                margin: 20px 0;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Sistema de Gestión Dental</h1>
              </div>
              <div class="content">
                <h2>Contraseña Actualizada</h2>
                <div class="success">
                  <strong>✅ Tu contraseña ha sido cambiada exitosamente</strong>
                </div>
                <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Sistema de Gestión Dental</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error('Error Resend:', error);
        return { success: false };
      }

      return { success: true };
    } catch (error) {
      console.error('Error enviando email de confirmación:', error);
      return { success: false };
    }
  }
}

module.exports = new EmailService();