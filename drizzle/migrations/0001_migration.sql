alter table public.orders add column if not exists shipping_service text default '';

create or replace function public.place_order_v2(p_items jsonb, p_shipping_address jsonb, p_payment_method text, p_payment_status text, p_payment_reference text, p_shipping numeric, p_shipping_service text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_order uuid;
begin
  if p_shipping is null or p_shipping < 0 or p_shipping > 500 then raise exception 'Frete inválido'; end if;
  v_order := public.place_order(p_items, p_shipping_address, p_payment_method, p_payment_status, p_payment_reference);
  update orders set shipping = p_shipping, shipping_service = coalesce(p_shipping_service,''), total = subtotal + p_shipping where id = v_order;
  return v_order;
end $$;
grant execute on function public.place_order_v2(jsonb, jsonb, text, text, text, numeric, text) to authenticated;