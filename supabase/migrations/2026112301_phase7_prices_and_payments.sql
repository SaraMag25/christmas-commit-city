-- ==============================================================================
-- Christmas Commit City — Phase 7 Prices Update & Secure Payment Fulfillment
-- ==============================================================================
-- 1. Synchronizes reduced BRL Pix prices across `public.shop_catalog`.
-- 2. Extends `public.payment_orders` for Mercado Pago Pix & Stripe Checkout tracking.
-- 3. Hardens `grant_paid_unlock_internal` with row locking (`FOR UPDATE`),
--    strict amount verification, and atomic idempotency under concurrent webhooks.
-- ==============================================================================

-- 1. Update BRL (Pix) prices in `public.shop_catalog` (commits & USD unchanged)
update public.shop_catalog as sc
   set price_brl_cents = v.price_brl_cents
  from (
    values
      -- Paid Gifts
      ('gift-star', 300),
      ('gift-retro-pc', 500),
      ('gift-teddy', 700),

      -- Companion Species
      ('frog', 300),
      ('snake', 300),
      ('mouse', 400),
      ('otter', 400),
      ('capybara', 500),
      ('cat', 500),

      -- Tier 1 Accessories (R$ 1,00)
      ('leaf-scarf', 100),
      ('cheese-wedge', 100),
      ('white-fish', 100),
      ('santa-hat', 100),

      -- Tier 2 Accessories (R$ 1,50)
      ('round-glasses', 150),
      ('strawberry-hat', 150),
      ('leaf-umbrella', 150),
      ('binary_sweater', 150),
      ('coffee-mug', 150),
      ('rubber_duck', 150),
      ('dev_hoodie', 150),
      ('mechanical_keyboard', 150),
      ('dev_headset', 150),

      -- Tier 3 Accessories (R$ 2,00)
      ('mini_laptop', 200),
      ('wizard-cloak', 200),
      ('wizard-hat', 200),
      ('golden-butterfly', 200),
      ('code_visor', 200),
      ('glow-lantern', 200),
      ('snow_globe', 200),

      -- Full Supporter Bundle (R$ 10,00)
      ('supporter-bundle', 1000)
  ) as v(id, price_brl_cents)
 where sc.id = v.id;

-- 2. Extend `public.payment_orders` with provider ID, expiration, and safe metadata
alter table public.payment_orders
  add column if not exists provider_payment_id text null,
  add column if not exists expires_at timestamptz null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists payment_orders_provider_payment_idx
  on public.payment_orders (provider_payment_id)
  where provider_payment_id is not null;

create index if not exists payment_orders_buyer_item_status_idx
  on public.payment_orders (buyer_user_id, item_id, status);

-- Ensure `service_role` retains full backend privileges on payment & unlock tables
grant all privileges on table public.shop_catalog to service_role;
grant all privileges on table public.trees to service_role;
grant all privileges on table public.user_unlocks to service_role;
grant all privileges on table public.tree_gifts to service_role;
grant all privileges on table public.payment_orders to service_role;
grant usage, select on sequence public.trees_plot_index_seq to service_role;

-- 3. Harden `grant_paid_unlock_internal` against concurrent duplicate webhooks
create or replace function public.grant_paid_unlock_internal(
  p_buyer_user_id uuid,
  p_target_tree_id uuid,
  p_item_id text,
  p_provider text,
  p_currency text,
  p_amount_cents integer,
  p_external_reference text,
  p_sender_username text default 'Apoiador da Comunidade'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.shop_catalog%rowtype;
  v_recipient public.trees%rowtype;
  v_existing_order public.payment_orders%rowtype;
  v_order_id uuid;
  v_expected_min_cents integer;
begin
  select *
    into v_item
    from public.shop_catalog
   where id = p_item_id
     and active = true;

  if not found then
    raise exception 'INVALID_CATALOG_ITEM';
  end if;

  if p_currency = 'BRL' then
    v_expected_min_cents := v_item.price_brl_cents;
  elsif p_currency = 'USD' then
    v_expected_min_cents := v_item.price_usd_cents;
  else
    raise exception 'INVALID_CURRENCY';
  end if;

  if v_expected_min_cents <= 0 or p_amount_cents < v_expected_min_cents then
    raise exception 'AMOUNT_BELOW_CATALOG_PRICE';
  end if;

  -- Lock any pre-existing order row so duplicate concurrent webhooks serialize cleanly
  select *
    into v_existing_order
    from public.payment_orders
   where external_reference = p_external_reference
   for update;

  if found then
    if v_existing_order.status = 'paid' then
      return jsonb_build_object(
        'already_processed', true,
        'order_id', v_existing_order.id,
        'external_reference', p_external_reference
      );
    end if;

    if v_existing_order.item_id is distinct from v_item.id
       or v_existing_order.currency is distinct from p_currency
       or p_amount_cents < v_existing_order.amount_cents then
      raise exception 'ORDER_MISMATCH';
    end if;

    update public.payment_orders
       set status = 'paid',
           paid_at = coalesce(paid_at, now())
     where id = v_existing_order.id
     returning id into v_order_id;
  else
    insert into public.payment_orders (
      buyer_user_id,
      target_tree_id,
      item_id,
      provider,
      currency,
      amount_cents,
      status,
      external_reference,
      paid_at
    )
    values (
      p_buyer_user_id,
      p_target_tree_id,
      v_item.id,
      p_provider,
      p_currency,
      p_amount_cents,
      'paid',
      p_external_reference,
      now()
    )
    returning id into v_order_id;
  end if;

  if v_item.item_type in ('companion', 'accessory', 'bundle') then
    if p_buyer_user_id is null then
      raise exception 'BUYER_REQUIRED_FOR_UNLOCK';
    end if;

    insert into public.user_unlocks (user_id, item_id, unlock_source)
    values (
      p_buyer_user_id,
      v_item.id,
      case
        when v_item.item_type = 'bundle' then 'bundle'
        when p_provider = 'pix' then 'pix'
        else 'international'
      end
    )
    on conflict (user_id, item_id) do nothing;
  elsif v_item.item_type = 'gift' then
    select *
      into v_recipient
      from public.trees
     where id = p_target_tree_id;

    if not found then
      raise exception 'RECIPIENT_TREE_NOT_FOUND';
    end if;

    insert into public.tree_gifts (
      recipient_tree_id,
      recipient_user_id,
      sender_user_id,
      sender_username,
      gift_id,
      source
    )
    values (
      v_recipient.id,
      v_recipient.user_id,
      p_buyer_user_id,
      coalesce(nullif(btrim(p_sender_username), ''), 'Apoiador da Comunidade'),
      v_item.id,
      case when p_provider = 'pix' then 'pix' else 'international' end
    );
  end if;

  return jsonb_build_object(
    'already_processed', false,
    'order_id', v_order_id,
    'item_id', v_item.id,
    'status', 'paid'
  );
end;
$$;

revoke all on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.grant_paid_unlock_internal(uuid, uuid, text, text, text, integer, text, text)
  to service_role;
