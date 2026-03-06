async function testPay() {
    try {
        const res = await fetch('http://localhost:3000/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: '680a1ffb-61ba-42a2-91e3-30ccbc45b9ce',
                amount: 125,
                method: 'CASH',
                description: 'Test invoice item error',
                payment_type: 'TUITION'
            })
        });
        const data = await res.json();
        console.log('Success:', data);
    } catch (err: any) {
        console.error('Error:', err.message);
    }
}

testPay();
