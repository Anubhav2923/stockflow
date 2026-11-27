import "dotenv/config";
const BASE_URL = 'http://localhost:5000/api/v1/auth';

async function testAuth() {
  console.log('Testing auth endpoints...\n');
  
  // Test health (at root level)
  try {
    const health = await fetch(`${BASE_URL}/../health`);
    const healthData = await health.json();
    console.log('✓ Health check:', JSON.stringify(healthData, null, 2));
  } catch (err) {
    console.log('✗ Health check failed:', err.message);
  }

  // Test login
  try {
    const loginResp = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.SEED_USERNAME, password: process.env.SEED_PASSWORD })
    });
    const text = await loginResp.text();
    console.log('✓ Login status:', loginResp.status);
    console.log("Login request completed");
    try {
      const loginData = JSON.parse(text);
      console.log('✓ Login parsed user:', loginData.user);
      console.log('✓ Login has token:', !!loginData.accessToken);
      
      if (loginData.accessToken) {
        const token = loginData.accessToken;
        
        // Test getCurrentUser
        try {
          const meResp = await fetch(`${BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const meData = await meResp.json();
          console.log('✓ Get current user:', JSON.stringify(meData, null, 2));
        } catch (err) {
          console.log('✗ Get current user failed:', err.message);
        }
        
        // Test logout
        try {
          const logoutResp = await fetch(`${BASE_URL}/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const logoutData = await logoutResp.json();
          console.log('✓ Logout response:', JSON.stringify(logoutData, null, 2));
        } catch (err) {
          console.log('✗ Logout failed:', err.message);
        }
      }
    } catch (e) {
      console.log('✗ Login not valid JSON');
    }
  } catch (err) {
    console.log('✗ Login failed:', err.message);
  }
}

testAuth();
