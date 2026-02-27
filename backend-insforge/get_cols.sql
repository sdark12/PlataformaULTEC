CREATE OR REPLACE FUNCTION get_auth_users_columns()
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(column_name) INTO result
    FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users';

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
