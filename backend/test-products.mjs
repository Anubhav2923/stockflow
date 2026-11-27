const BASE_URL = 'http://localhost:5000/api/v1';

async function testProducts() {
  console.log('Testing products module...\n');
  
  // Test get products
  try {
    const productsResp = await fetch(`${BASE_URL}/products`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test-token' }
    });
    const productsText = await productsResp.text();
    console.log('✓ Get products status:', productsResp.status);
    console.log('✓ Get products response:', productsText.substring(0, 500));
  } catch (err) {
    console.log('✗ Get products failed:', err.message);
  }
  
  // Test create product
  try {
    const createResp = await fetch(`${BASE_URL}/products`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({ 
        sku: 'TEST001',
        name: 'Test Product',
        category: 'Electronics'
      })
    });
    const createText = await createResp.text();
    console.log('✓ Create product status:', createResp.status);
    console.log('✓ Create product response:', createText.substring(0, 500));
  } catch (err) {
    console.log('✗ Create product failed:', err.message);
  }
  
  // Test get product by id
  try {
    const productIdResp = await fetch(`${BASE_URL}/products/uuid-test`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer test-token' }
    });
    const productIdText = await productIdResp.text();
    console.log('✓ Get product by id status:', productIdResp.status);
    console.log('✓ Get product by id response:', productIdText.substring(0, 500));
  } catch (err) {
    console.log('✗ Get product by id failed:', err.message);
  }
}

testProducts();