-- ==============================================================================
-- Christmas Commit City — Adjust BRL Shop Prices in `public.shop_catalog`
-- ==============================================================================
update public.shop_catalog as sc
   set price_brl_cents = v.price_brl_cents
  from (
    values
      -- Paid Gifts
      ('gift-star', 400),
      ('gift-retro-pc', 700),
      ('gift-teddy', 900),

      -- Companion Species
      ('frog', 400),
      ('snake', 400),
      ('mouse', 500),
      ('otter', 500),
      ('capybara', 600),
      ('cat', 600),

      -- Tier 1 Accessories (R$ 1,50)
      ('leaf-scarf', 150),
      ('cheese-wedge', 150),
      ('white-fish', 150),
      ('santa-hat', 150),

      -- Tier 2 Accessories (R$ 2,00)
      ('round-glasses', 200),
      ('strawberry-hat', 200),
      ('leaf-umbrella', 200),
      ('binary_sweater', 200),
      ('coffee-mug', 200),
      ('rubber_duck', 200),
      ('dev_hoodie', 200),
      ('mechanical_keyboard', 200),
      ('dev_headset', 200),

      -- Tier 3 Accessories (R$ 3,00)
      ('mini_laptop', 300),
      ('wizard-cloak', 300),
      ('wizard-hat', 300),
      ('golden-butterfly', 300),
      ('code_visor', 300),
      ('glow-lantern', 300),
      ('snow_globe', 300),

      -- Full Supporter Bundle (R$ 15,00)
      ('supporter-bundle', 1500)
  ) as v(id, price_brl_cents)
 where sc.id = v.id;
