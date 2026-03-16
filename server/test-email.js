// test-email.js - Run this separately to test EmailJS
require('dotenv').config({ path: '.env.local' });
const axios = require('axios');

async function testEmailJS() {
  console.log('🔍 Testing EmailJS with keys:');
  console.log('Service ID:', process.env.EMAILJS_SERVICE_ID);
  console.log('Template ID:', process.env.EMAILJS_TEMPLATE_ID);
  console.log('Public Key:', process.env.EMAILJS_PUBLIC_KEY);
  console.log('Private Key:', process.env.EMAILJS_PRIVATE_KEY ? '✅ Present' : '❌ Missing');

  const payload = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: 'jyothi1682004@gmail.com', // Change to your email
      to_name: 'Test User',
      otp: '123456',
      reply_to: 'noreply@test.com'
    }
  };

  console.log('\n📤 Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post('https://api.emailjs.com/api/v1.0/email/send', payload, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000'
      }
    });
    console.log('\n✅ SUCCESS! Email sent:', response.data);
  } catch (error) {
    console.error('\n❌ ERROR:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testEmailJS();