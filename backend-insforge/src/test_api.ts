import axios from 'axios';

async function testApi() {
    try {
        const res = await axios.get('http://localhost:3000/api/users');
        console.log("Users from API:", res.data);
    } catch (e: any) {
        console.error("API error:", e.response?.data || e.message);
    }
}

testApi();
