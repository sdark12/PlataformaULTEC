
import client from './src/config/insforge';

async function debug() {
    console.log('--- DEBUG START ---');

    console.log('1. Checking Profiles Table existence directly...');
    const { count, error: countError } = await client.database
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('PROFILES TABLE MISSING OR ERROR:', countError.message);
        console.dir(countError, { depth: null });
    } else {
        console.log(`PROFILES HEAD OK. Count: ${count}`);
    }

    console.log('2. Trying SELECT from profiles...');
    const { data: selectData, error: selectError } = await client.database
        .from('profiles')
        .select('*')
        .limit(1);

    if (selectError) {
        console.error('PROFILES SELECT ERROR:', selectError.message);
        console.dir(selectError, { depth: null });
    } else {
        console.log('PROFILES SELECT OK. Data:', selectData);
    }

    console.log('3. Checking Branches...');
    const { data: branches, error: branchError } = await client.database
        .from('branches')
        .select('*');

    if (branchError) {
        console.error('BRANCHES ERROR:', branchError.message);
    } else {
        console.log('BRANCHES OK. Count:', branches?.length);
    }

    console.log('--- DEBUG END ---');
}

debug();
