-- ==============================================================================
-- Stripe USD Hardening: Idempotency Indexes + Voluntary Support Donations
-- ==============================================================================

alter table public.payment_orders
  add column if not exists payment_intent_id text null;

-- Drop legacy non-unique index on provider_payment_id before enforcing strict uniqueness
drop index if exists public.payment_orders_provider_payment_idx;

create unique index if not exists payment_orders_provider_payment_uidx
  on public.payment_orders (provider, provider_payment_id)
  where provider_payment_id is not null;

create unique index if not exists payment_orders_payment_intent_uidx
  on public.payment_orders (payment_intent_id)
  where payment_intent_id is not null;

-- Atomic & idempotent fulfillment RPC for voluntary USD support donations (`service_role` only)
create or replace function public.fulfill_stripe_support_donation_internal(
  p_buyer_user_id uuid,
  p_currency text,
  p_amount_cents integer,
  p_external_reference text,
  p_session_id text,
  p_payment_intent_id text default null,
  p_sender_username text default 'Apoiador Internacional'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.payment_orders%rowtype;
  v_order_id uuid;
  v_clean_session_id text := nullif(btrim(coalesce(p_session_id, '')), '');
  v_clean_pi text := nullif(btrim(coalesce(p_payment_intent_id, '')), '');
begin
  if upper(coalesce(p_currency, '')) <> 'USD' then
    raise exception 'INVALID_CURRENCY';
  end if;

  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 50000 then
    raise exception 'DONATION_AMOUNT_OUT_OF_RANGE';
  end if;

  -- Lock any matching order by external_reference, Stripe Checkout session id, or payment_intent id
  select *
    into v_existing
    from public.payment_orders
   where (p_external_reference is not null and external_reference = p_external_reference)
      or (v_clean_session_id is not null and provider = 'stripe' and provider_payment_id = v_clean_session_id)
      or (v_clean_pi is not null and payment_intent_id = v_clean_pi)
   order by created_at asc
   limit 1
   for update;

  if found then
    if v_existing.status = 'paid' then
      return jsonb_build_object(
        'already_processed', true,
        'order_id', v_existing.id,
        'type', 'support_donation',
        'external_reference', v_existing.external_reference
      );
    end if;

    if v_existing.currency is distinct from 'USD' or p_amount_cents < v_existing.amount_cents then
      raise exception 'ORDER_MISMATCH';
    end if;

    update public.payment_orders
       set status = 'paid',
           paid_at = coalesce(paid_at, now()),
           provider_payment_id = coalesce(provider_payment_id, v_clean_session_id),
           payment_intent_id = coalesce(payment_intent_id, v_clean_pi),
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'type', 'support_donation',
             'verified_session_id', v_clean_session_id,
             'payment_intent_id', v_clean_pi
           )
     where id = v_existing.id
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
      provider_payment_id,
      payment_intent_id,
      paid_at,
      metadata
    )
    values (
      p_buyer_user_id,
      null,
      null,
      'stripe',
      'USD',
      p_amount_cents,
      'paid',
      p_external_reference,
      v_clean_session_id,
      v_clean_pi,
      now(),
      jsonb_build_object(
        'type', 'support_donation',
        'sender_username', coalesce(nullif(btrim(p_sender_username), ''), 'Apoiador Internacional'),
        'verified_session_id', v_clean_session_id,
        'payment_intent_id', v_clean_pi
      )
    )
    returning id into v_order_id;
  end if;

  return jsonb_build_object(
    'already_processed', false,
    'order_id', v_order_id,
    'type', 'support_donation',
    'status', 'paid',
    'amount_cents', p_amount_cents
  );
end;
$$;

revoke all on function public.fulfill_stripe_support_donation_internal(uuid, text, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.fulfill_stripe_support_donation_internal(uuid, text, integer, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
