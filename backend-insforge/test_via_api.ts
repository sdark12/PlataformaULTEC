import axios from 'axios';

async function testBackend() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:3000/auth/login', {
            email: 'admin@admin.com',
            password: 'password123'
        });
        const token = loginRes.data.token;
        console.log("Logged in, token received.");

        console.log("Fetching branches...");
        const branchesRes = await axios.get('http://localhost:3000/api/branches', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const branch = branchesRes.data[0];
        console.log("First branch ID:", branch.id);

        console.log("Updating branch...");
        const updateRes = await axios.put(`http://localhost:3000/api/branches/${branch.id}`, {
            name: 'Sede Central',
            address: 'Barrio La Bolsa, Aldea La Esmeralda, Jerez, Jutiapa',
            phone: '51125795',
            email: 'academiaultra@outlook.c'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log("Update Success:", updateRes.data);
    } catch (err: any) {
        console.error("Test failed!");
        if (err.response) {
            console.error("Status:", err.response.status);
            console.error("Data:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error(err.message);
        }
    }
}

testBackend();
