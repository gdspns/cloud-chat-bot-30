CREATE OR REPLACE FUNCTION public.decrement_stock_quantity(p_product_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_quantity integer;
BEGIN
  UPDATE shop_products
  SET stock_quantity = stock_quantity - 1,
      updated_at = now()
  WHERE id = p_product_id
    AND stock_quantity IS NOT NULL
    AND stock_quantity > 0
  RETURNING stock_quantity INTO v_new_quantity;
  
  RETURN COALESCE(v_new_quantity, -1);
END;
$$;