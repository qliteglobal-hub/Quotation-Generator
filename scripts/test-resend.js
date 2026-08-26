require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

async function testResend() {
  console.log("Testing Resend API with Key:", process.env.RESEND_API_KEY ? "Found" : "Missing");
  
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  const response = await resend.emails.send({
    from: 'Qlite <support@quotation.qrpixeldesign.com>',
    to: 'delivered@resend.dev', // Resend's testing email
    subject: 'Test Email',
    html: '<p>This is a test.</p>'
  });

  console.log("Response:", JSON.stringify(response, null, 2));
}

testResend();
