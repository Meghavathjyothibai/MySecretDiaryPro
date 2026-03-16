const { Resend } = require('resend');

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async (email, otp) => {
  try {
    console.log(`📧 Attempting to send OTP email to ${email} via Resend...`);
    
    const { data, error } = await resend.emails.send({
      from: 'My Secret Diary <onboarding@resend.dev>',
      to: [email],
      subject: '🔐 Password Reset OTP - My Secret Diary',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #6b46c1, #db2777); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">My Secret Diary</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Password Reset Request</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="background: #f3f4f6; border-radius: 12px; padding: 30px; display: inline-block;">
                  <h2 style="color: #6b46c1; margin: 0 0 10px;">Your OTP Code</h2>
                  <div style="font-size: 48px; font-weight: bold; letter-spacing: 8px; color: #1f2937; background: white; padding: 20px; border-radius: 12px; border: 2px dashed #6b46c1;">
                    ${otp}
                  </div>
                  <p style="color: #6b46c1; margin: 15px 0 0; font-weight: bold;">Valid for 10 minutes</p>
                </div>
              </div>
              
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-top: 20px;">
                <p style="color: #4b5563; margin: 0 0 10px; font-size: 14px;">
                  <strong>📝 Note:</strong> If you didn't request this password reset, please ignore this email or contact support if you have concerns.
                </p>
                <p style="color: #9ca3af; margin: 0; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} My Secret Diary. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Resend error:', error);
      throw error;
    }

    console.log('✅ Email sent successfully via Resend:', data);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email via Resend:', error);
    throw error;
  }
};

module.exports = { sendPasswordResetEmail };