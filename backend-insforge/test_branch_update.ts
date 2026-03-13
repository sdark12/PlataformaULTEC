import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    baseUrl: process.env.INSFORGE_URL || '',
    anonKey: process.env.INSFORGE_API_KEY || ''
});

async function testUpdate() {
    console.log("Testing update...");
    const { data, error } = await client.database
        .from('branches')
        .update({ name: 'Sede Central Prueba Test', address: 'Dirección Test' })
        .eq('id', 1)
        .select()
        .single();
    
    if (error) {
        console.error("Error updating:", error);
    } else {
        console.log("Success:", data);
    }
}

testUpdate();
