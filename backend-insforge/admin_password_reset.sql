CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS void AS $$
DECLARE
  has_encrypted BOOLEAN;
  has_hash BOOLEAN;
  has_pass BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='encrypted_password') INTO has_encrypted;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='password_hash') INTO has_hash;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' AND column_name='password') INTO has_pass;

  IF has_encrypted THEN
    EXECUTE 'UPDATE auth.users SET encrypted_password = crypt($1, gen_salt(''bf'')), updated_at = NOW() WHERE id = $2' USING new_password, target_user_id;
  ELSIF has_hash THEN
    EXECUTE 'UPDATE auth.users SET password_hash = crypt($1, gen_salt(''bf'')), updated_at = NOW() WHERE id = $2' USING new_password, target_user_id;
  ELSIF has_pass THEN
    EXECUTE 'UPDATE auth.users SET password = crypt($1, gen_salt(''bf'')), updated_at = NOW() WHERE id = $2' USING new_password, target_user_id;
  ELSE
    RAISE EXCEPTION 'No se encontró la columna de contraseña en auth.users';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
