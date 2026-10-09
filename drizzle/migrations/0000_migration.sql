create type public.app_role as enum ('admin','user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  cpf text default '',
  phone text default '',
  birth_date date,
  cep text default '',
  street text default '',
  number text default '',
  complement text default '',
  neighborhood text default '',
  city text default '',
  state text default '',
  delivery_notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profile own read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profile own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile own update" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, cpf, phone, cep, street, number, complement, neighborhood, city, state, delivery_notes)
  values (new.id, coalesce(m->>'full_name', m->>'name', ''), coalesce(m->>'cpf',''), coalesce(m->>'phone',''),
    coalesce(m->>'cep',''), coalesce(m->>'street',''), coalesce(m->>'number',''), coalesce(m->>'complement',''),
    coalesce(m->>'neighborhood',''), coalesce(m->>'city',''), coalesce(m->>'state',''), coalesce(m->>'delivery_notes',''));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null,
  price numeric(10,2) not null,
  image_key text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select to anon, authenticated using (active or public.has_role(auth.uid(),'admin'));
create policy "products admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  color_hex text not null default '#000000',
  stock int not null default 0,
  unique (product_id, size, color)
);
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create policy "variants public read" on public.product_variants for select to anon, authenticated using (true);
create policy "variants admin write" on public.product_variants for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pendente',
  payment_method text not null,
  payment_status text not null default 'pendente',
  payment_reference text default '',
  subtotal numeric(10,2) not null,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  shipping_address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders own read" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "orders admin update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  size text not null,
  color text not null,
  quantity int not null,
  unit_price numeric(10,2) not null
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "items read" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

-- items: [{variant_id, quantity}]
create or replace function public.place_order(p_items jsonb, p_shipping_address jsonb, p_payment_method text, p_payment_status text, p_payment_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_order uuid; v_sub numeric := 0; v_ship numeric; it jsonb; v record; q int;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if p_payment_status not in ('aprovado_teste','pendente','recusado_teste') then raise exception 'Status inválido'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  insert into orders (user_id, payment_method, payment_status, payment_reference, subtotal, total, shipping_address, status)
  values (auth.uid(), p_payment_method, p_payment_status, coalesce(p_payment_reference,''), 0, 0, p_shipping_address,
    case when p_payment_status = 'aprovado_teste' then 'pago' else 'pendente' end)
  returning id into v_order;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'quantity')::int;
    if q is null or q < 1 then raise exception 'Quantidade inválida'; end if;
    select pv.id, pv.size, pv.color, pv.stock, p.name, p.price into v
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid and p.active for update of pv;
    if not found then raise exception 'Produto indisponível'; end if;
    if v.stock < q then raise exception 'Estoque insuficiente para % (% / %)', v.name, v.size, v.color; end if;
    update product_variants set stock = stock - q where id = v.id;
    insert into order_items (order_id, variant_id, product_name, size, color, quantity, unit_price)
      values (v_order, v.id, v.name, v.size, v.color, q, v.price);
    v_sub := v_sub + v.price * q;
  end loop;
  v_ship := case when v_sub >= 299 then 0 else 19.90 end;
  update orders set subtotal = v_sub, shipping = v_ship, total = v_sub + v_ship where id = v_order;
  return v_order;
end $$;
grant execute on function public.place_order(jsonb, jsonb, text, text, text) to authenticated;

-- seed
with p as (
  insert into public.products (name, description, category, price, image_key) values
  ('Conjunto Rendado Aurora', 'Sutiã com bojo e calcinha em renda francesa delicada.', 'lingerie', 189.90, 'lingerie'),
  ('Body Rendado Noir', 'Body em renda com alças finas e acabamento acetinado.', 'lingerie', 229.90, 'lingerie'),
  ('Calcinha Algodão Essencial', 'Kit com 3 calcinhas em algodão macio para o dia a dia.', 'intimas-femininas', 69.90, 'intimas'),
  ('Sutiã Sem Bojo Conforto', 'Sutiã em microfibra sem aro, toque suave.', 'intimas-femininas', 89.90, 'intimas'),
  ('Pijama Cetim Lua', 'Camisa e calça em cetim com debrum contrastante.', 'pijamas-femininos', 249.90, 'pijamas'),
  ('Camisola Viscose Flor', 'Camisola leve em viscose com estampa floral.', 'pijamas-femininos', 139.90, 'pijamas'),
  ('Pijama Infantil Estrelinhas', 'Pijama de algodão com estampa de estrelas.', 'pijamas-infantis', 99.90, 'pijamas-infantis'),
  ('Kit Calcinha Infantil Arco-íris', 'Kit com 5 calcinhas infantis em algodão.', 'intimas-infantis', 59.90, 'intimas-infantis')
  returning id, category
)
insert into public.product_variants (product_id, size, color, color_hex, stock)
select p.id, s.size, c.color, c.hex, 12
from p
cross join lateral (select unnest(case when p.category like '%infantis' then array['4','6','8','10'] else array['P','M','G','GG'] end) as size) s
cross join lateral (select * from (values ('Rosé','#D9A5A0'),('Preto','#1E1A1A'),('Marfim','#F1E9DC')) as t(color,hex)) c;