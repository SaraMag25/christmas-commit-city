import {
  COMPANION_ACCESSORIES_CATALOG,
  COMPANION_SPECIES_CATALOG,
} from '../config/companions'
import { CREATOR_CAMPAIGN, CREATOR_CAMPAIGN_EN } from '../config/supportCampaign'
import type { TreeLevelId } from '../types/city'
import type {
  AccessorySlot,
  CompanionAccessoryId,
  CompanionSpeciesId,
} from '../types/companion'

export type AppLanguage = 'pt-BR' | 'en'

export interface LocalizedTreeStageCopy {
  name: string
  badgeLabel: string
  description: string
  visualFeatures: string[]
}

export interface LocalizedCompanionCopy {
  defaultName: string
  name: string
  subtitle: string
  description: string
  story: string
}

export interface LocalizedAccessoryCopy {
  name: string
  description: string
}

export interface LocalizedGiftCopy {
  name: string
  description: string
}

export const GIFT_CATALOG_COPY: Record<AppLanguage, Record<string, LocalizedGiftCopy>> = {
  'pt-BR': {
    'golden-star': {
      name: 'Estrela Dourada',
      description: 'Brilha no topo dos galhos como símbolo de apoio comunitário.',
    },
    'ornament-baubles': {
      name: 'Bolas Natalinas',
      description: 'Bolinhas clássicas vermelhas e douradas para celebrar commits.',
    },
    'colorful-lights': {
      name: 'Luzes Coloridas',
      description: 'Cordão cintilante que deixa qualquer pinheiro mais acolhedor.',
    },
    'festive-bell': {
      name: 'Sinos',
      description: 'Pequenos sinos dourados com laço natalino pendurados nos ramos.',
    },
    'crystal-snowflake': {
      name: 'Flocos de Neve',
      description: 'Cristais de gelo luminosos que enfeitam os galhos em 360° pela árvore.',
    },
    'gift-box': {
      name: 'Caixa de Presente',
      description: 'Uma caixinha embrulhada com laço vermelho ao pé da árvore.',
    },
    'cozy-teddy': {
      name: 'Ursinho de Inverno',
      description: 'Um ursinho com cachecol e gorro natalino colocado ao pé da árvore.',
    },
    'retro-pc': {
      name: 'PC Retrô',
      description:
        'Um computador clássico de tubo com teclado e mouse deixado debaixo da árvore para maratonas de código.',
    },
    'ufc-ornament': {
      name: 'PC Retrô',
      description:
        'Um computador clássico de tubo com teclado e mouse deixado debaixo da árvore para maratonas de código.',
    },
  },
  en: {
    'golden-star': {
      name: 'Golden Star',
      description: 'Shines above the crown as a symbol of community support.',
    },
    'ornament-baubles': {
      name: 'Holiday Baubles',
      description: 'Classic glossy red and gold baubles celebrating commits.',
    },
    'colorful-lights': {
      name: 'Colorful Lights',
      description: 'Twinkling rainbow fairy bulbs making any pine tree cozy.',
    },
    'festive-bell': {
      name: 'Festive Bells',
      description: 'Golden 3D holiday bells with crimson bows hung on branches.',
    },
    'crystal-snowflake': {
      name: 'Crystal Snowflakes',
      description: 'Glowing ice crystals mounted in 360° across boughs around the tree.',
    },
    'gift-box': {
      name: 'Gift Box',
      description: 'A wrapped present box with red ribbon placed by the base.',
    },
    'cozy-teddy': {
      name: 'Winter Teddy Bear',
      description: 'An adorable scarfed teddy bear with Santa cap at the tree base.',
    },
    'retro-pc': {
      name: 'Retro PC',
      description:
        'A classic CRT desktop computer with keyboard and mouse placed under the tree for coding marathons.',
    },
    'ufc-ornament': {
      name: 'Retro PC',
      description:
        'A classic CRT desktop computer with keyboard and mouse placed under the tree for coding marathons.',
    },
  },
}

export const TREE_STAGE_COPY: Record<AppLanguage, Record<TreeLevelId, LocalizedTreeStageCopy>> = {
  'pt-BR': {
    0: {
      name: 'Pequeno Pinheiro',
      badgeLabel: '0 commits',
      description: 'Um brotinho recém-plantado na neve, pronto para o primeiro commit.',
      visualFeatures: ['Pinheiro jovem', 'Toque de neve fresca'],
    },
    1: {
      name: 'Árvore Pequena',
      badgeLabel: '1–10 commits',
      description: 'Os primeiros commits deram forma aos galhos iniciais.',
      visualFeatures: ['2 camadas de galhos', 'Copa verde-pinheiro'],
    },
    2: {
      name: 'Árvore Média',
      badgeLabel: '11–50 commits',
      description: 'Ganha corpo, galhos simétricos e as primeiras bolas do GitHub.',
      visualFeatures: ['3 camadas de galhos', 'Primeiras bolas de commit'],
    },
    3: {
      name: 'Árvore Decorada',
      badgeLabel: '51–100 commits',
      description: 'Enfeitada com camadas nevadas e bolas nos tons oficiais do GitHub.',
      visualFeatures: ['4 camadas de galhos', 'Bolas verdes do GitHub'],
    },
    4: {
      name: 'Árvore Iluminada',
      badgeLabel: '101–300 commits',
      description: 'Commits médios e picos acendem a copa durante a noite polar.',
      visualFeatures: ['Bolas emissivas', 'Topo com ponta dourada'],
    },
    5: {
      name: 'Árvore Grande',
      badgeLabel: '301–500 commits',
      description: 'Imponente e luminosa, com estrela no topo e presentes ao pé do tronco.',
      visualFeatures: ['5 camadas densas', 'Estrela dourada', 'Presentes na base'],
    },
    6: {
      name: 'Árvore Especial',
      badgeLabel: '500+ commits',
      description: 'Marco lendário da comunidade, irradiando brilho intenso sobre o Polo Norte.',
      visualFeatures: ['Copa máxima', 'Estrela radiante', 'Presentes na base'],
    },
  },
  en: {
    0: {
      name: 'Tiny Pine',
      badgeLabel: '0 commits',
      description: 'A freshly planted sapling in the snow, ready for your very first commit.',
      visualFeatures: ['Young pine', 'Fresh snow dusting'],
    },
    1: {
      name: 'Small Tree',
      badgeLabel: '1–10 commits',
      description: 'Your first commits shaped the early snowy branches.',
      visualFeatures: ['2 branch tiers', 'Arctic spruce foliage'],
    },
    2: {
      name: 'Medium Tree',
      badgeLabel: '11–50 commits',
      description: 'Grows fuller with symmetrical boughs and initial GitHub commit baubles.',
      visualFeatures: ['3 branch tiers', 'First commit baubles'],
    },
    3: {
      name: 'Decorated Tree',
      badgeLabel: '51–100 commits',
      description: 'Trimmed with crisp snow shelves and official GitHub contribution greens.',
      visualFeatures: ['4 branch tiers', 'GitHub green baubles'],
    },
    4: {
      name: 'Illuminated Tree',
      badgeLabel: '101–300 commits',
      description: 'Active commit days glow warmly across the polar night sky.',
      visualFeatures: ['Glowing baubles', 'Golden crown tip'],
    },
    5: {
      name: 'Grand Tree',
      badgeLabel: '301–500 commits',
      description: 'Tall and luminous, crowned with a golden star and gifts at its roots.',
      visualFeatures: ['5 dense tiers', 'Golden star', 'Gifts under trunk'],
    },
    6: {
      name: 'Special Tree',
      badgeLabel: '500+ commits',
      description: 'A legendary community landmark sparkling brightly over the North Pole.',
      visualFeatures: ['Full crown', 'Radiant star', 'Gifts under trunk'],
    },
  },
}

export const SPECIES_COPY: Record<AppLanguage, Record<CompanionSpeciesId, LocalizedCompanionCopy>> = {
  'pt-BR': {
    frog: {
      defaultName: 'Bento',
      name: 'Sapo Verde',
      subtitle: 'Guardião do Brejo Nevado',
      description: 'Sapo compacto e simpático que adora acompanhar deploys noturnos.',
      story:
        'Um sapinho aprendiz de magia que trocou o brejo pela neve. Acredita firmemente que um bom feitiço e um git rebase bem feito resolvem qualquer bug de inverno.',
    },
    snake: {
      defaultName: 'Pip',
      name: 'Cobra Python',
      subtitle: 'Ambiente Virtual Quentinho',
      description: 'Cobrinha azul e amarela enrolada que adora indentação perfeita.',
      story:
        'Uma cobrinha enrolada que adora código limpo, indentação perfeita e ambientes virtuais quentinhos. Dizem que um único `import natal` dela já ilumina metade da floresta.',
    },
    mouse: {
      defaultName: 'Tico',
      name: 'Ratinho Polar',
      subtitle: 'Orelhas Grandes & Olhos Atentos',
      description: 'Ratinho azul-esverdeado super ágil para caçar bugs na neve.',
      story:
        'Um pequeno detetive polar de orelhas atentas e faro apurado para queijo e memory leaks. Guarda cada commit do ano como se fosse um tesouro escondido na neve.',
    },
    otter: {
      defaultName: 'Lola',
      name: 'Lontra Marrom',
      subtitle: 'Exploradora do Rio Gelado',
      description: 'Lontra marrom de barriga clarinha pronta para deslizar no gelo.',
      story:
        'A exploradora destemida do rio gelado. Atravessa a nevasca sob a aurora boreal para iluminar o caminho de devs perdidos em conflitos de merge.',
    },
    capybara: {
      defaultName: 'Cacau',
      name: 'Capivara Fofa',
      subtitle: 'Mestre da Calma em Produção',
      description: 'Capivara serena que mantém a paz mesmo nos merges de sexta-feira.',
      story:
        'A mestre suprema da serenidade em produção. Observa a neve cair com calma inabalável e lembra todo mundo de respirar fundo antes do deploy de sexta-feira.',
    },
    cat: {
      defaultName: 'Maria',
      name: 'Gata Cinza Rajada',
      subtitle: 'Pelagem Cinza Mesclada & Listras',
      description: 'Gatinha rajada cheia de nuances prateadas, cinza-chumbo e bigodes brancos.',
      story:
        'A guardiã felina mais curiosa do Polo Norte. Passa as noites caçando peixinhos no lago congelado e tirando cochilos em cima do teclado quente enquanto os commits sobem.',
    },
  },
  en: {
    frog: {
      defaultName: 'Bento',
      name: 'Green Frog',
      subtitle: 'Snowy Pond Guardian',
      description: 'A chubby, cheerful frog who loves keeping watch over late-night deploys.',
      story:
        'An apprentice magic frog who traded the swamp for the snow. Firmly believes that a good spell and a clean git rebase can fix any winter bug.',
    },
    snake: {
      defaultName: 'Pip',
      name: 'Python Snake',
      subtitle: 'Warm Virtualenv Guardian',
      description: 'A coiled blue-and-yellow snake who loves clean indentation and green builds.',
      story:
        'A cozy coiled snake who loves clean code, neat indentation, and warm virtual environments. Legend says a single `import christmas` from her lights up half the forest.',
    },
    mouse: {
      defaultName: 'Tico',
      name: 'Polar Mouse',
      subtitle: 'Big Ears & Sharp Eyes',
      description: 'A nimble teal-blue mouse built for spotting elusive bugs in the snow.',
      story:
        'A tiny polar detective with sharp ears and a keen nose for cheese and memory leaks. Treasures every commit of the year like a hidden gem in the snow.',
    },
    otter: {
      defaultName: 'Lola',
      name: 'Brown Otter',
      subtitle: 'Icy River Explorer',
      description: 'A cozy chestnut otter with a cream belly ready to slide across the ice.',
      story:
        'The fearless explorer of the icy river. Journeys through snowstorms under the aurora borealis to guide devs lost in merge conflicts.',
    },
    capybara: {
      defaultName: 'Cacau',
      name: 'Cozy Capybara',
      subtitle: 'Zen Master of Production',
      description: 'A serenely unbothered capybara keeping peace through Friday merges.',
      story:
        'The ultimate master of calm in production. Watches the snowfall with unshakable peace and reminds everyone to breathe before a Friday deploy.',
    },
    cat: {
      defaultName: 'Maria',
      name: 'Grey Tabby Cat',
      subtitle: 'Mottled Grey & Charcoal Stripes',
      description: 'A nuanced silver-grey tabby kitty with dark stripes and white whiskers.',
      story:
        'The most curious feline guardian of the North Pole. She spends her nights hunting little fish by the frozen lake and napping on warm keyboards while commits ship.',
    },
  },
}

export const ACCESSORY_COPY: Record<
  AppLanguage,
  Record<CompanionAccessoryId, LocalizedAccessoryCopy>
> = {
  'pt-BR': {
    'leaf-scarf': {
      name: 'Cachecol de Folhas Verdes',
      description: 'Golinha aconchegante entrelaçada com folhas pinho e broto dourado.',
    },
    'cheese-wedge': {
      name: 'Pedaço de Queijo',
      description: 'Fatia dourada cheia de furinhos para lanches de madrugada.',
    },
    'white-fish': {
      name: 'Peixinho Branco',
      description: 'Peixinho fresquinho pescado no lago congelado, o favorito da Maria.',
    },
    'santa-hat': {
      name: 'Gorro Natalino',
      description: 'Clássico gorro vermelho do Polo Norte com barra fofa e pompom branco.',
    },
    'round-glasses': {
      name: 'Óculos Redondos Grandes',
      description: 'Armação clássica de dev com lentes azul-gelo cintilantes.',
    },
    'strawberry-hat': {
      name: 'Touca de Morango',
      description: 'Gorrinho tricotado vermelho com sementinhas e folha verde no topo.',
    },
    'leaf-umbrella': {
      name: 'Folha Guarda-Chuva',
      description: 'Folha ampla verde que protege da neve caindo na floresta.',
    },
    'coffee-mug': {
      name: 'Caneca de Café Quente',
      description: 'Caneca quentinha soltando vapor contínuo enquanto compila.',
    },
    'wizard-cloak': {
      name: 'Capa Roxa de Mago',
      description: 'Manto roxo estrelado preso no pescoço com broche dourado.',
    },
    'wizard-hat': {
      name: 'Chapéu de Mago Roxo',
      description: 'Chapéu pontudo roxo com faixa e fivela dourada arcana.',
    },
    'golden-butterfly': {
      name: 'Borboleta Dourada',
      description: 'Borboleta dourada emissiva flutuando suavemente ao lado da orelha.',
    },
    'glow-lantern': {
      name: 'Lanterna Brilhante',
      description: 'Lanterna portátil com chama dourada emissiva para guiar no inverno.',
    },
    snow_globe: {
      name: 'Globo de Neve Natalino',
      description:
        'Mini globo de vidro com um bonequinho de neve de cachecol vermelho e flocos caindo lá dentro.',
    },
    dev_hoodie: {
      name: 'Moletom Dev >_',
      description:
        'Moletom grafite de madrugada de código com capuz fofo e estampa terminal em verde neon.',
    },
    dev_headset: {
      name: 'Headset Dev RGB',
      description:
        'Fones over-ear com microfone ajustável e LEDs neon para virar a madrugada em pair programming.',
    },
    rubber_duck: {
      name: 'Patinho de Debug',
      description:
        'Mini patinho de borracha amarelo equilibrado na cabeça. O melhor ouvinte para resolver qualquer bug.',
    },
    code_visor: {
      name: 'Visor de Código Neon',
      description:
        'Visor holográfico translúcido que projeta logs e linhas de código direto nos olhos do seu amigo.',
    },
    binary_sweater: {
      name: 'Suéter Binário 01 + Crachá',
      description:
        'Suéter natalino de programador estampado com `0` e `1` na barriga e crachá de evento tech pendurado.',
    },
    mechanical_keyboard: {
      name: 'Teclado Mecânico RGB',
      description:
        'Teclado mecânico 60% compacto com switches táteis e fileira RGB brilhando a cada commit.',
    },
    mini_laptop: {
      name: 'Notebook de Código',
      description:
        'Mini laptop aberto com tela brilhando em código verde neon para fazer deploy na neve.',
    },
  },
  en: {
    'leaf-scarf': {
      name: 'Green Leaf Scarf',
      description: 'Cozy collar woven from evergreen leaves with a festive clasp.',
    },
    'cheese-wedge': {
      name: 'Cheese Wedge',
      description: 'A golden Swiss cheese slice for midnight debugging snacks.',
    },
    'white-fish': {
      name: 'Little White Fish',
      description: 'Fresh silver-white fish caught by the frozen lake. Maria’s favorite snack.',
    },
    'santa-hat': {
      name: 'Santa Hat',
      description: 'Classic North Pole red cap with fluffy snow trim and white pompom.',
    },
    'round-glasses': {
      name: 'Big Round Glasses',
      description: 'Classic developer frames with crisp ice-blue lenses.',
    },
    'strawberry-hat': {
      name: 'Strawberry Beanie',
      description: 'Knitted crimson strawberry cap dotted with seeds and green leaf stem.',
    },
    'leaf-umbrella': {
      name: 'Leaf Umbrella',
      description: 'Wide emerald leaf held overhead to catch falling snowflakes.',
    },
    'coffee-mug': {
      name: 'Hot Coffee Mug',
      description: 'Steaming holiday mug with rising voxel puffs while code compiles.',
    },
    'wizard-cloak': {
      name: 'Purple Wizard Cloak',
      description: 'Star-speckled violet cloak fastened with a golden collar clasp.',
    },
    'wizard-hat': {
      name: 'Purple Wizard Hat',
      description: 'Pointed arcane violet hat trimmed with a bright golden band.',
    },
    'golden-butterfly': {
      name: 'Golden Butterfly',
      description: 'A softly glowing golden butterfly fluttering beside your pet’s ear.',
    },
    'glow-lantern': {
      name: 'Glowing Lantern',
      description: 'Warm emissive lantern lighting up snowy North Pole paths.',
    },
    snow_globe: {
      name: 'Christmas Snow Globe',
      description: 'Mini glass dome with a tiny red-scarf snowman and falling snowflakes inside.',
    },
    dev_hoodie: {
      name: 'Dev Hoodie >_',
      description:
        'Dark late-night coding hoodie with a cozy hood and glowing neon-green terminal emblem.',
    },
    dev_headset: {
      name: 'RGB Dev Headset',
      description: 'Over-ear headset with a boom mic and neon LEDs for late-night pair programming.',
    },
    rubber_duck: {
      name: 'Rubber Duck Debugger',
      description:
        'Tiny yellow rubber duck balanced on top. The ultimate listener for rubber duck debugging.',
    },
    code_visor: {
      name: 'Neon Code Visor',
      description:
        "Translucent holographic visor projecting live logs and lines of code right across your buddy's eyes.",
    },
    binary_sweater: {
      name: 'Binary 01 Sweater + Badge',
      description:
        "Cozy dev holiday sweater patterned with `0`s and `1`s on the belly, complete with a tech badge lanyard.",
    },
    mechanical_keyboard: {
      name: 'RGB Mechanical Keyboard',
      description:
        'Compact 60% mechanical keyboard with tactile switches and glowing RGB underglow per commit.',
    },
    mini_laptop: {
      name: 'Coding Laptop',
      description:
        'Tiny open laptop with a glowing neon-green code screen for snowy midnight deploys.',
    },
  },
}

export const SLOT_LABELS_BY_LANG: Record<AppLanguage, Record<AccessorySlot, string>> = {
  'pt-BR': {
    head: 'Cabeça',
    body: 'Rosto / Corpo',
    hand: 'Item',
  },
  en: {
    head: 'Head',
    body: 'Face / Body',
    hand: 'Item',
  },
}

export const CAMPAIGN_COPY = {
  'pt-BR': {
    title: CREATOR_CAMPAIGN.title,
    university: CREATOR_CAMPAIGN.university,
    course: CREATOR_CAMPAIGN.course,
    paragraphs: CREATOR_CAMPAIGN.paragraphs,
    message: CREATOR_CAMPAIGN.message,
  },
  en: {
    title: CREATOR_CAMPAIGN_EN.title,
    university: CREATOR_CAMPAIGN_EN.university,
    course: CREATOR_CAMPAIGN_EN.course,
    paragraphs: CREATOR_CAMPAIGN_EN.paragraphs,
    message: CREATOR_CAMPAIGN_EN.message,
  },
} as const

export const UI_TRANSLATIONS = {
  'pt-BR': {
    header: {
      subtitle: '// polo norte 3d',
      city: 'floresta',
      find: 'buscar colega',
      findTitle: 'Procurar árvore de um colega (/)',
      docs: 'docs',
      support: 'apoie',
      connect: 'conectar',
      connectShort: 'git',
      myTreeTitle: 'Ir para minha árvore',
      resyncTitle: 'Sincronizar contribuições do GitHub',
      signOutTitle: 'Sair da conta GitHub',
      syncing: 'sincronizando...',
      syncPending: 'sync pendente',
      retrySyncBtn: 'Sincronizar novamente',
      signOutBtn: 'Sair da conta',
    },
    explorer: {
      buttonLabel: 'Procurar colega',
      placeholder: 'buscar @username ou nome...',
      all: 'todas',
      illuminated: 'iluminadas',
      empty: 'Nenhum colega encontrado.',
      openProfile: 'Abrir página da árvore',
      closeHint: 'ESC para fechar',
    },
    welcome: {
      ariaLabel: 'Boas-vindas à Christmas Commit City',
      line1: 'Uma árvore para cada desenvolvedor no Polo Norte.',
      line2: 'Cada commit do GitHub vira uma bola verde luminosa na copa.',
      exploreBtn: '$ explorar --polo-norte',
      connectBtn: '$ conectar --github',
      myTreeBtn: '$ ir --minha-arvore',
      campaignLine: 'Feito por @SaraMag25 · Polo Norte 3D',
      viewCreatorBtn: 'ver árvore da criadora',
    },
    camera: {
      move: 'Mover',
      rotate: 'Girar',
      zoom: 'Zoom',
      inspect: 'Inspecionar',
      center: 'centro',
      centerTitle: 'Centralizar no Marco do Polo Norte',
      creatorBadge: '★ criadora',
    },
    home: {
      syncWarning: 'Aviso na sincronização GitHub',
      close: 'Fechar',
      paymentSuccessBanner: 'Pagamento confirmado! Seu item ou presente foi liberado.',
      paymentPendingBanner: 'Pagamento recebido, finalizando confirmação automática...',
      paymentCancelledBanner: 'Checkout cancelado. Nenhuma cobrança foi realizada.',
    },
    treePanel: {
      user: 'USER',
      commits: 'COMMITS',
      level: 'NÍVEL',
      type: 'ESPÉCIE',
      region: 'REGIÃO',
      status: 'STATUS',
      graph: 'CALENDÁRIO',
      viewGithub: '[ ver perfil no github ]',
      creatorBadge: '★ criadora',
      creatorStatus: 'CRIADORA',
      companionNone: 'sem companheiro',
      balance: 'saldo',
      commitsUnit: 'commits',
      gifts: 'presentes',
      visualOnly: 'somente visual',
      noGifts: 'Nenhum presente recebido ainda.',
      viewTree: 'ver árvore',
      giftBtn: 'presentear árvore',
      giftMyTreeBtn: 'presentear minha árvore',
      companionShopBtn: 'companheiro & loja',
      supportBtn: 'apoie o projeto',
      copyLink: 'copiar link da árvore',
      linkCopied: 'link copiado!',
    },
    howItWorks: {
      title: 'Como funciona o sistema',
      subtitle:
        'Cada commit no ano corrente faz sua árvore crescer e acende bolas verdes nas cores oficiais do GitHub.',
      step1Title: '1. conectar --github',
      step1Desc: 'OAuth somente leitura (read:user) via GitHub GraphQL API.',
      step2Title: '2. crescer --árvore',
      step2Desc: '7 estágios 3D com bolas nos 4 níveis do GitHub e companheiros personalizáveis.',
      step3Title: '3. personalizar --árvore',
      step3Desc: 'Adote companheiros com seu saldo de commits e envie presentes para decorar árvores.',
      levelsTitle: 'níveis_das_árvores',
    },
    connectModal: {
      title: 'Conectar com GitHub',
      oauthDesc: 'OAuth via Supabase Auth para sincronizar sua atividade na GitHub GraphQL API.',
      scopeDesc: 'Escopo estrito read:user: nenhum acesso de escrita aos repositórios.',
      periodLabel: 'ano_período',
      noEnvTitle: 'Credenciais do Supabase ainda não configuradas no .env',
      noEnvDesc:
        'Para ativar o login OAuth real, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env e publique a Edge Function sync-github-contributions seguindo docs/SUPABASE_GITHUB_SETUP.md.',
      back: 'Voltar',
      authorize: 'Autorizar com GitHub',
      redirecting: 'Redirecionando...',
    },
    giftModal: {
      title: 'Presentear',
      titleOwn: 'Presentear minha árvore',
      subtitle: 'Selecione um presente para visualizar em 3D antes de confirmar.',
      subtitleOwn: 'Visualize presentes em 3D antes de colocá-los na sua árvore!',
      special: 'Especial',
      free: 'Gratuito',
      rarity: 'Raridade',
      placeGiftBtn: 'Colocar na árvore',
      addToMyTreeBtn: 'Colocar na minha árvore',
      giftSpecialBtn: 'Presentear',
      livePreview: 'LIVE_PREVIEW',
      previewingLabel: 'Prévia:',
      currentTreeLabel: 'Árvore atual',
      compareWithPreview: 'Ver com prévia',
      compareCurrent: 'Ver atual',
      placedFeedback: 'Presente colocado na árvore em 3D!',
      onTreeCount: 'na árvore',
      selectHint: 'Clique em um item do catálogo ao lado para visualizar na árvore 3D.',
      note: 'Presentes gratuitos são adicionados na hora; presentes especiais aparecem assim que o pagamento é confirmado.',
      phase7Notice:
        'Selecione Pix (BRL) ou Cartão (USD). O presente aparece na árvore logo após a confirmação do pagamento.',
      loginRequiredFree:
        'Conecte sua conta GitHub para enviar presentes gratuitos.',
      loginRequiredPaid:
        'Conecte sua conta GitHub para enviar presentes especiais via Pix ou Cartão.',
      sendingBtn: 'Enviando...',
      back: 'Fechar',
    },
    giftsSection: {
      seeSenders: 'Ver quem enviou',
      hideSenders: 'Ocultar remetentes',
      youLabel: 'Você',
    },
    subpage: {
      backToCity: 'Voltar ao Polo Norte',
    },
    profile: {
      loadingTrees: 'Carregando árvore do Polo Norte...',
      notFoundTitle: 'Árvore não encontrada',
      notFoundDesc: 'Ainda não existe uma árvore plantada para',
      exploreCta: 'Explorar Polo Norte',
      locateInCity: 'Localizar no Mapa',
      specialBadge: '★ criadora',
      customizePet: 'Customizar Companheiro',
      adoptPet: 'Adotar Companheiro',
      giftTree: 'Presentear Árvore',
      giftMyTree: 'Presentear Minha Árvore',
      copyLink: 'Copiar link da árvore',
      linkCopied: 'Link copiado!',
      shareSocial: 'Compartilhar nas redes',
      noPet: 'Sem companheiro',
      equipped: 'Equipado',
      balance: 'Saldo',
      commitsLeftFor: 'commits para',
      maxStage: 'Estágio máximo',
      giftsTitle: 'Presentes recebidos',
      giftsNote: 'Decoram a árvore 3D sem alterar commits',
      noGifts: 'Nenhum presente recebido ainda. Escolha um presente no catálogo!',
      sentBy: 'Enviado por',
      actionsLabel: 'Personalizar & Presentear',
      companionActiveLabel: 'Companheiro ativo na árvore',
      supportCampaignBtn: 'Apoiar Projeto',
    },
    calendar: {
      title: 'Atividade no GitHub',
      graphqlSource: 'Dados via GitHub GraphQL API',
      demoSource: 'Dados de demonstração',
      commits: 'Commits',
      totalTitle: 'Total no ano',
      totalSubtitle: 'commits / contribuições',
      activeDays: 'dias ativos',
      less: 'Menos',
      more: 'Mais',
      recentTitle: 'Calendário recente de contribuições',
      weeks: 'semanas',
      emptyHint: 'Conecte sua conta GitHub para exibir o calendário completo de contribuições.',
    },
    shop: {
      title: 'Companheiro & Customização',
      realCommits: 'Commits Reais (Árvore)',
      availableBalance: 'Saldo Disponível',
      spentInShop: 'Gastos na Loja',
      ruleBanner: 'Gastar saldo não reduz o nível nem os commits da sua árvore.',
      livePreview: 'LIVE_PREVIEW',
      noPetHint: 'Adote um amigo ao lado para exibir ao lado da árvore!',
      headLabel: 'CABEÇA',
      bodyLabel: 'CORPO',
      handLabel: 'ITEM',
      noneLabel: 'Nenhum',
      removePet: 'Guardar companheiro',
      tabSpecies: 'Escolher Amigo',
      tabCustomize: 'Customizar',
      activeOnTree: 'Ativo na árvore',
      unlockedClickEquip: 'Desbloqueado · Clique p/ equipar',
      equippedClickRemove: 'Equipado (clique p/ tirar)',
      adoptFor: 'Adotar por',
      equipBtn: 'Equipar',
      missingCommits: 'Faltam',
      missingSuffix: 'commits no saldo para adotar por commits.',
      enoughBalance: 'Saldo suficiente! Restarão',
      enoughSuffix: 'commits para acessórios.',
      unlockPix: 'Desbloquear via Pix',
      unlockCard: 'Desbloquear via Cartão',
      unlockGlobal: 'Desbloquear Global',
      supporterTitle: 'Pacote Apoiador Completo (Combo Total)',
      supporterDesc:
        `Desbloqueie todos os ${COMPANION_SPECIES_CATALOG.length} bichinhos + todos os ${COMPANION_ACCESSORIES_CATALOG.length} acessórios de uma só vez.`,
      supporterUnlocked: 'Pacote Apoiador Ativo: Tudo Desbloqueado!',
      supporterBtn: 'Desbloquear Tudo',
      petNameLabel: 'Nome do seu amigo',
      petNamePlaceholder: 'Ex: Maria',
      saveNameBtn: 'Salvar',
      resetNameBtn: 'Padrão',
      nameSavedMsg: 'Nome atualizado!',
      storyLabel: 'História',
      checkoutPixTitle: 'Pagamento via Pix',
      checkoutUsdTitle: 'Pagamento via Cartão (USD)',
      pixKeyLabel: 'Chave Pix',
      copy: 'Copiar',
      copied: 'Copiado!',
      openCheckout: 'Abrir Checkout Internacional',
      noCheckoutEnv:
        'Checkout externo indisponível no modo local; use o botão ao lado para simular o desbloqueio.',
      previewNote:
        'Modo local: salvo apenas neste navegador.',
      phase7Notice:
        'Liberação automática na sua conta logo após a confirmação do pagamento.',
      generatePixBtn: 'Gerar QR Code Pix',
      payWithStripeBtn: 'Pagar com Cartão (Stripe)',
      generatingCheckout: 'Gerando pagamento...',
      pixWaitingTitle: 'Pix',
      pixExpiresAt: 'expira às',
      pixCopyCodeLabel: 'Código Pix Copia e Cola',
      pixAutoConfirmHint:
        'Pague no app do seu banco. A liberação acontece automaticamente em segundos após a confirmação.',
      checkStatusBtn: 'Verificar pagamento',
      pixConfirmed: 'Pagamento Pix confirmado! Atualizando sua árvore...',
      pixExpiredOrFailed: 'Este Pix expirou ou foi cancelado. Gere um novo código se desejar.',
      loginRequiredPaid:
        'Conecte sua conta GitHub para desbloquear via Pix ou Cartão com segurança.',
      paymentConfirmedUnlocked: 'Pagamento confirmado e desbloqueado na sua conta!',
      confirmPreview: 'Confirmar Desbloqueio (Prévia Local)',
      cancel: 'Cancelar',
      currencyBrlLabel: '🇧🇷 BRL (Pix)',
      currencyUsdLabel: '🌎 USD (Card / Global)',
      commitsWord: 'commits',
      orLabel: 'ou',
      selectHint: 'Selecione um amigo ou acessório ao lado para adotar ou equipar.',
    },
    supportModal: {
      title: 'Campanha da Criadora: Rumo à Formatura na UFC',
      goal: 'Meta da campanha',
      supporterTitle: 'Pacote Apoiador (Supporter Bundle)',
      supporterDesc:
        `Desbloqueia os ${COMPANION_SPECIES_CATALOG.length} companheiros e todos os ${COMPANION_ACCESSORIES_CATALOG.length} acessórios com um único apoio simbólico (ideal para pagamentos internacionais sem taxas repetidas).`,
      supporterCta: 'Desbloquear Tudo por',
      supporterDone: 'Pacote Apoiador já desbloqueado nesta árvore!',
      directTitle: 'Apoio Voluntário Direto para a Formatura',
      directPixFreeBadge: 'Valor livre · Banco Inter',
      directPixDesc:
        'Apoie meus estudos enviando qualquer valor pelo app do seu banco via QR Code ou Pix Copia e Cola (apoio voluntário, sem vínculo com desbloqueios automáticos).',
      directPixPhase7Note:
        'Para desbloquear o Pacote Apoiador (R$ 15,00) ou itens/presentes automaticamente na árvore, use o botão dourado acima ou a loja (checkout automático via Pix).',
      pixQrAlt: 'QR Code Pix do Banco Inter para apoio voluntário aos estudos',
      pixRecipientLabel: 'Recebedor',
      pixBrCodeLabel: 'Pix Copia e Cola (BR Code)',
      copyPixBrCodeBtn: 'Copiar Pix Copia e Cola',
      pixRandomKeyLabel: 'Chave Aleatória',
      copyRandomKeyBtn: 'Copiar Chave Aleatória',
      directUsdDesc:
        'Apoie de qualquer lugar do mundo via Cartão / Checkout Internacional em USD.',
      close: 'Fechar',
    },
  },
  en: {
    header: {
      subtitle: '// north pole 3d',
      city: 'forest',
      find: 'find dev',
      findTitle: 'Find a colleague tree (/)',
      docs: 'docs',
      support: 'support',
      connect: 'connect',
      connectShort: 'git',
      myTreeTitle: 'Jump to my tree',
      resyncTitle: 'Sync GitHub contributions',
      signOutTitle: 'Sign out of GitHub',
      syncing: 'syncing...',
      syncPending: 'sync pending',
      retrySyncBtn: 'Retry sync',
      signOutBtn: 'Sign out',
    },
    explorer: {
      buttonLabel: 'Find colleague',
      placeholder: 'search @username or name...',
      all: 'all',
      illuminated: 'lit',
      empty: 'No matching colleague found.',
      openProfile: 'Open tree profile page',
      closeHint: 'ESC to close',
    },
    welcome: {
      ariaLabel: 'Welcome to Christmas Commit City',
      line1: 'One voxel pine tree for every developer at the North Pole.',
      line2: 'Every GitHub commit lights up an official green bauble on your tree.',
      exploreBtn: '$ explore --north-pole',
      connectBtn: '$ connect --github',
      myTreeBtn: '$ go --my-tree',
      campaignLine: 'Built by @SaraMag25 · North Pole 3D',
      viewCreatorBtn: 'view creator tree',
    },
    camera: {
      move: 'Move',
      rotate: 'Rotate',
      zoom: 'Zoom',
      inspect: 'Inspect',
      center: 'center',
      centerTitle: 'Center on North Pole Landmark',
      creatorBadge: '★ creator',
    },
    home: {
      syncWarning: 'GitHub sync notice',
      close: 'Close',
      paymentSuccessBanner: 'Payment confirmed! Your item or gift has been unlocked.',
      paymentPendingBanner: 'Payment received, finalizing confirmation...',
      paymentCancelledBanner: 'Checkout cancelled. No charge was made.',
    },
    treePanel: {
      user: 'USER',
      commits: 'COMMITS',
      level: 'LEVEL',
      type: 'TREE_TYPE',
      region: 'REGION',
      status: 'STATUS',
      graph: 'CONTRIBUTION_GRAPH',
      viewGithub: '[ view github profile ]',
      creatorBadge: '★ creator',
      creatorStatus: 'CREATOR',
      companionNone: 'no companion yet',
      balance: 'balance',
      commitsUnit: 'commits',
      gifts: 'gifts',
      visualOnly: 'visual only',
      noGifts: 'No gifts received yet.',
      viewTree: 'view tree',
      giftBtn: 'gift tree',
      giftMyTreeBtn: 'gift my tree',
      companionShopBtn: 'companion & shop',
      supportBtn: 'support project',
      copyLink: 'copy tree link',
      linkCopied: 'link copied!',
    },
    howItWorks: {
      title: 'How Christmas Commit City Works',
      subtitle:
        'Each commit this year grows your 3D voxel tree and adds official GitHub-green baubles to its branches.',
      step1Title: '1. connect --github',
      step1Desc: 'Read-only OAuth (read:user) powered by the official GitHub GraphQL API.',
      step2Title: '2. grow --tree',
      step2Desc: '7 3D pine stages with GitHub commit baubles and customizable companions.',
      step3Title: '3. customize --tree',
      step3Desc: 'Adopt companions with commit balance and send gifts to decorate trees.',
      levelsTitle: 'tree_levels',
    },
    connectModal: {
      title: 'Connect with GitHub',
      oauthDesc: 'OAuth via Supabase Auth to sync your activity with the GitHub GraphQL API.',
      scopeDesc: 'Strict read:user scope: write access to repositories is never requested.',
      periodLabel: 'period_year',
      noEnvTitle: 'Supabase credentials are not configured in .env yet',
      noEnvDesc:
        'To enable live OAuth login, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and deploy the sync-github-contributions Edge Function per docs/SUPABASE_GITHUB_SETUP.md.',
      back: 'Back',
      authorize: 'Authorize with GitHub',
      redirecting: 'Redirecting...',
    },
    giftModal: {
      title: 'Gift Tree',
      titleOwn: 'Gift My Tree',
      subtitle: 'Select a gift to preview it in 3D on the tree before confirming.',
      subtitleOwn: 'Preview 3D holiday gifts on your own tree before adding them!',
      special: 'Special',
      free: 'Free',
      rarity: 'Rarity',
      placeGiftBtn: 'Place on tree',
      addToMyTreeBtn: 'Add to my tree',
      giftSpecialBtn: 'Gift',
      livePreview: 'LIVE_PREVIEW',
      previewingLabel: 'Preview:',
      currentTreeLabel: 'Current tree',
      compareWithPreview: 'Show with preview',
      compareCurrent: 'View current',
      placedFeedback: 'Gift placed on the 3D tree!',
      onTreeCount: 'on tree',
      selectHint: 'Click any item in the catalog to preview it on the 3D tree.',
      note: 'Free gifts appear on the tree right away; special gifts are delivered as soon as payment is confirmed.',
      phase7Notice:
        'Choose Pix (BRL) or Card (USD). Your gift appears on the tree as soon as payment is confirmed.',
      loginRequiredFree:
        'Connect your GitHub account to send free gifts.',
      loginRequiredPaid:
        'Connect your GitHub account first to send special gifts via Pix or Card.',
      sendingBtn: 'Sending...',
      back: 'Close',
    },
    giftsSection: {
      seeSenders: 'See who sent',
      hideSenders: 'Hide senders',
      youLabel: 'You',
    },
    subpage: {
      backToCity: 'Back to North Pole',
    },
    profile: {
      loadingTrees: 'Loading North Pole tree...',
      notFoundTitle: 'Tree not found',
      notFoundDesc: 'There is no tree planted yet for',
      exploreCta: 'Explore North Pole',
      locateInCity: 'Locate on Map',
      specialBadge: '★ creator',
      customizePet: 'Customize Companion',
      adoptPet: 'Adopt Companion',
      giftTree: 'Gift Tree',
      giftMyTree: 'Gift My Tree',
      copyLink: 'Copy tree link',
      linkCopied: 'Link copied!',
      shareSocial: 'Share on social',
      noPet: 'No companion yet',
      equipped: 'Equipped',
      balance: 'Balance',
      commitsLeftFor: 'commits until',
      maxStage: 'Max stage',
      giftsTitle: 'Gifts received',
      giftsNote: 'Decorate the 3D tree without altering commits',
      noGifts: 'No gifts yet. Pick a 3D gift from the catalog!',
      sentBy: 'Sent by',
      actionsLabel: 'Customize & Gift',
      companionActiveLabel: 'Active companion on tree',
      supportCampaignBtn: 'Support Project',
    },
    calendar: {
      title: 'GitHub Activity',
      graphqlSource: 'Via GitHub GraphQL API',
      demoSource: 'Demo dataset',
      commits: 'Commits',
      totalTitle: 'Year total',
      totalSubtitle: 'commits / contributions',
      activeDays: 'active days',
      less: 'Less',
      more: 'More',
      recentTitle: 'Recent contribution graph',
      weeks: 'weeks',
      emptyHint: 'Connect your GitHub account to display your full contribution calendar.',
    },
    shop: {
      title: 'Companion & Customization',
      realCommits: 'Real Commits (Tree)',
      availableBalance: 'Available Balance',
      spentInShop: 'Spent in Shop',
      ruleBanner: "Spending balance never reduces your tree's level or commits.",
      livePreview: 'LIVE_PREVIEW',
      noPetHint: 'Adopt a companion on the right to place beside your tree!',
      headLabel: 'HEAD',
      bodyLabel: 'BODY',
      handLabel: 'ITEM',
      noneLabel: 'None',
      removePet: 'Store companion away',
      tabSpecies: 'Choose Companion',
      tabCustomize: 'Customize',
      activeOnTree: 'Active on tree',
      unlockedClickEquip: 'Unlocked · Click to equip',
      equippedClickRemove: 'Equipped (click to unequip)',
      adoptFor: 'Adopt for',
      equipBtn: 'Equip',
      missingCommits: 'Need',
      missingSuffix: 'more commits in balance to adopt with commits.',
      enoughBalance: 'Enough balance! You will have',
      enoughSuffix: 'commits left for accessories.',
      unlockPix: 'Unlock via Pix',
      unlockCard: 'Unlock with Card',
      unlockGlobal: 'Unlock Global',
      supporterTitle: 'Full Supporter Pack (All-Access Bundle)',
      supporterDesc:
        `Unlock all ${COMPANION_SPECIES_CATALOG.length} pets + all ${COMPANION_ACCESSORIES_CATALOG.length} accessories at once.`,
      supporterUnlocked: 'Supporter Pack Active: Everything Unlocked!',
      supporterBtn: 'Unlock All',
      petNameLabel: "Your companion's name",
      petNamePlaceholder: 'e.g. Maria',
      saveNameBtn: 'Save',
      resetNameBtn: 'Default',
      nameSavedMsg: 'Name updated!',
      storyLabel: 'Story',
      checkoutPixTitle: 'Pix Payment',
      checkoutUsdTitle: 'Card Payment (USD)',
      pixKeyLabel: 'Pix Key',
      copy: 'Copy',
      copied: 'Copied!',
      openCheckout: 'Open International Checkout',
      noCheckoutEnv:
        'External checkout unavailable in local mode; use the button beside to simulate unlocking.',
      previewNote:
        'Local mode: saved in browser storage only.',
      phase7Notice:
        'Unlocked automatically on your account right after payment confirmation.',
      generatePixBtn: 'Generate Pix QR Code',
      payWithStripeBtn: 'Pay with Card (Stripe)',
      generatingCheckout: 'Creating checkout...',
      pixWaitingTitle: 'Pix',
      pixExpiresAt: 'expires at',
      pixCopyCodeLabel: 'Pix Copy & Paste Code',
      pixAutoConfirmHint:
        'Pay in your banking app. Your unlock activates automatically within seconds once confirmed.',
      checkStatusBtn: 'Check payment status',
      pixConfirmed: 'Pix payment confirmed! Updating your tree...',
      pixExpiredOrFailed: 'This Pix code expired or was cancelled. Generate a new one if needed.',
      loginRequiredPaid:
        'Connect your GitHub account to unlock securely via Pix or Card.',
      paymentConfirmedUnlocked: 'Payment confirmed and unlocked on your account!',
      confirmPreview: 'Confirm Unlock (Local Preview)',
      cancel: 'Cancel',
      currencyBrlLabel: '🇧🇷 BRL (Pix)',
      currencyUsdLabel: '🌎 USD (Card / Global)',
      commitsWord: 'commits',
      orLabel: 'or',
      selectHint: 'Select a companion or accessory on the right to adopt or equip.',
    },
    supportModal: {
      title: "Creator's Campaign: Road to Graduation at UFC",
      goal: 'Campaign goal',
      supporterTitle: 'Supporter Bundle (Best for Global Support)',
      supporterDesc:
        `Unlocks all ${COMPANION_SPECIES_CATALOG.length} companions and all ${COMPANION_ACCESSORIES_CATALOG.length} accessories with a single contribution (avoids repeated international micro-transaction fees).`,
      supporterCta: 'Unlock Everything for',
      supporterDone: 'Supporter Bundle already unlocked on this tree!',
      directTitle: 'Direct Voluntary Support for Graduation',
      directPixFreeBadge: 'Any amount · Banco Inter',
      directPixDesc:
        'Support her studies by sending any amount through your Brazilian bank app via QR Code or Pix Copy & Paste (voluntary gift without automatic unlock).',
      directPixPhase7Note:
        'To automatically unlock the Supporter Bundle or shop items/gifts on your tree, use the gold checkout button above (automatic Pix / Card checkout).',
      pixQrAlt: 'Banco Inter Pix QR Code for voluntary graduation support',
      pixRecipientLabel: 'Recipient',
      pixBrCodeLabel: 'Pix Copy & Paste (BR Code)',
      copyPixBrCodeBtn: 'Copy Pix BR Code',
      pixRandomKeyLabel: 'Random Pix Key',
      copyRandomKeyBtn: 'Copy Random Key',
      directUsdDesc: 'Contribute from anywhere worldwide using International Card / USD Checkout.',
      close: 'Close',
    },
  },
} as const
