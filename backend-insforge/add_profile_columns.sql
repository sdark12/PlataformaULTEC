-- Agregar las columnas de 'phone' y 'active' a la tabla 'profiles'
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
