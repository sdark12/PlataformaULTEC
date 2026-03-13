import client from './src/config/insforge';

async function testUpdate() {
    console.log("Testing original update branch format with anon key...");
    
    // The ID from my verify query earlier
    const id = "739adc0f-7dd8-4509-9eed-0e1d3c2b2ba0";
    const name = "Sede Central (Test)";

    const { data, error } = await client.database
        .from('branches')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error("Error original update:", JSON.stringify(error, null, 2));
    } else {
        console.log("Success:", JSON.stringify(data, null, 2));
    }
}

testUpdate();
