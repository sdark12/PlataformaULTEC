
import client from './src/config/insforge';

async function recreate() {
    console.log('--- RECREATING ADMIN USER ---');

    // Cambiamos levemente el correo para asegurar que sea un registro "fresco"
    // dado que el anterior puede estar bloqueado por el estado "unverified"
    const email = 'admin@ultec.edu';
    const password = 'password123';

    console.log(`Intentando registrar: ${email}`);

    const { data: auth, error: signUpError } = await client.auth.signUp({
        email,
        password
    });

    if (signUpError) {
        console.error('Error al registrar:', signUpError.message);
        if (signUpError.message.includes('already registered')) {
            console.log('El usuario ya existe. Intentando actualizar perfil...');
        } else {
            return;
        }
    }

    // Si el registro fue exitoso o ya existía, intentamos login para obtener el ID
    const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (signInError || !signIn?.user) {
        console.error('Error al iniciar sesión:', signInError?.message || 'Sin datos de usuario');
        return;
    }

    const userId = signIn.user.id;
    console.log(`Usuario ID: ${userId} verificado/logeado correctamente.`);

    // 1. Obtener ID de Rol Admin
    const { data: roleData } = await client.database
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .maybeSingle();

    const roleId = roleData?.id;

    // 2. Obtener ID de Sede Principal
    const { data: branchData } = await client.database
        .from('branches')
        .select('id')
        .maybeSingle();

    const branchId = branchData?.id;

    // 3. Upsert en Profiles
    const { error: profileError } = await client.database
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            full_name: 'Administrador General',
            role: 'admin',
            role_id: roleId,
            branch_id: branchId,
            is_active: true
        });

    if (profileError) {
        console.error('Error al configurar perfil:', profileError.message);
    } else {
        console.log('--- ÉXITO: Administrador creado y configurado ---');
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    }
}

recreate();
