import "dotenv/config";


const BASE_URL = 'http://localhost:5000/api/v1';

async function testAuth() {
  console.log('Testing auth endpoints...\n');
  
  // Test health
  try {
    const health = await fetch(`${BASE_URL}/health`);
    const healthData = await health.json();
    console.log('✓ Health check:', healthData);
  } catch (err) {
    console.log('✗ Health check failed:', err.message);
  }

  // Test login
  try {
    const loginResp = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.SEED_USERNAME, password: process.env.SEED_PASSWORD })
    });
    const loginData = await loginResp.json();
    console.log("Login request completed");
    
    if (loginData.accessToken) {
      const token = loginData.accessToken;
      
      // Test getCurrentUser
      try {
        const meResp = await fetch(`${BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meResp.json();
        console.log('✓ Get current user:', JSON.stringify(meData, null, 2));
      } catch (err) {
        console.log('✗ Get current user failed:', err.message);
      }
      
      // Test logout
      try {
        const logoutResp = await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const logoutData = await logoutResp.json();
        console.log('✓ Logout response:', JSON.stringify(logoutData, null, 2));
      } catch (err) {
        console.log('✗ Logout failed:', err.message);
      }
    }
  } catch (err) {
    console.log('✗ Login failed:', err.message);
  }
}

testAuth();
