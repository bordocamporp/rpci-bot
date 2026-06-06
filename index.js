require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');

const { createClient } = require('@supabase/supabase-js');

/*
  RPCI BOT - FASI 1-4
  FASE 1: Iscrizione player singoli + ruoli Discord
  FASE 2: Draft/sorteggio squadre + gestione capitani
  FASE 3: Competizioni + generazione calendari
  FASE 4: Referti doppi capitani + statistiche automatiche + risultati/ricorsi/classifiche base

  FASE 5: Fasce/Budget/Contratti -> da fare dopo
  FASE 6: Mercato/Free Agent/Trasferimenti -> da fare dopo
*/

// ====== CANALI/RUOLI ======
const PLAYER_ROLE_ID = '1507740330299228161';
const CAPTAIN_ROLE_ID = '1507736309282635817';
const STAFF_ROLE_IDS = ['1398225204404289669', '1507735305279635610'];

const PLAYER_REGISTRATION_CHANNEL_ID = process.env.PLAYER_REGISTRATION_CHANNEL_ID || '1507746191528562778';
const MATCH_REPORTS_CHANNEL_ID = '1507742878313746443';
const MATCH_RESULTS_CHANNEL_ID = '1507742819920379974';
const APPEALS_CHANNEL_ID = '1507742936618500116';
const BOT_LOG_CHANNEL_ID = '1507744280733683724';
const FREE_AGENT_CHANNEL_ID = '1507741035999264779';
const FREE_AGENT_ARCHIVE_CHANNEL_ID = '1512529993308311736';
const CONTRACT_DEPOSIT_CHANNEL_ID = '1508454065535979591';
const CAPTAIN_ELECTION_PANEL_CHANNEL_ID = '1508166026460663918';
const CAPTAIN_ELECTION_CANDIDATES_CHANNEL_ID = '1512434324043993209';
const TRANSFER_REQUESTS_CHANNEL_ID = '1507741180212023509';
const STANDINGS_CHANNEL_ID = '1507739495431409665';
const STATS_CHANNEL_ID = '1507739549353119854';
const BALANCE_CHANNEL_ID = '1512544549141086238';
const ROSTERS_CHANNEL_ID = '1512544285705244852';
const CALENDAR_CHANNEL_ID = '1507739436648108272';
const SEASON_AWARDS_CHANNEL_ID = '1507743000145690794';
const ECONOMY_BASE_CLUB_BUDGET = 500;



const FREE_AGENT_ROLE_ID = '1507736959009820813';
const BASE_CLUB_BUDGET = 500;
const TIER_SALARIES = {
  ROOKIE: 5,
  BASSA: 10,
  MEDIA: 20,
  ALTA: 35,
  TOP: 50,
  LEGGENDA: 100
};


// ====== COSTANTI ======
const GAME_ROLES = ['POR', 'TD', 'DC', 'TS', 'CDC', 'CC', 'COC', 'ED', 'ES', 'AD', 'AS', 'ATT', 'SP'];
const ROLE_LABELS = {
  POR: 'Portiere',
  TD: 'Terzino Destro',
  DC: 'Difensore Centrale',
  TS: 'Terzino Sinistro',
  CDC: 'Centrocampista Difensivo',
  CC: 'Centrocampista Centrale',
  COC: 'Centrocampista Offensivo',
  ED: 'Esterno Destro',
  ES: 'Esterno Sinistro',
  AD: 'Ala Destra',
  AS: 'Ala Sinistra',
  ATT: 'Attaccante',
  SP: 'Seconda Punta'
};

const FC_ROLE_IDS = {
  POR: '1512389203244089435',
  TD: '1512389357091164242',
  DC: '1512389493892845679',
  TS: '1512389357288423554',
  CDC: '1512389636654104638',
  CC: '1512389703918157825',
  COC: '1512389760599986378',
  ED: '1512389895333609603',
  ES: '1512389835476701285',
  AD: '1512389965017911347',
  AS: '1512390020873584670',
  ATT: '1512390105233363106',
  SP: '1512390105233363106'
};

const ROLE_ENV_KEYS = {
  POR: 'ROLE_POR_ID',
  TD: 'ROLE_TD_ID',
  DC: 'ROLE_DC_ID',
  TS: 'ROLE_TS_ID',
  CDC: 'ROLE_CDC_ID',
  CC: 'ROLE_CC_ID',
  COC: 'ROLE_COC_ID',
  ES: 'ROLE_ES_ID',
  ED: 'ROLE_ED_ID',
  AS: 'ROLE_AS_ID',
  AD: 'ROLE_AD_ID',
  ATT: 'ROLE_ATT_ID'
};

const PER_PAGE = 25;

// ====== DRAFTS IN MEMORIA ======
const playerRegistrationDrafts = new Map();
const competitionDrafts = new Map();
const calendarDrafts = new Map();
const reportDrafts = new Map();
const captainAssignDrafts = new Map();
const freeAgentDrafts = new Map();
const freeAgentAgreementDrafts = new Map();
const captainElectionDrafts = new Map();
const transferDrafts = new Map();
const advancedCalendarDrafts = new Map();
const disciplineDrafts = new Map();
const renewalDrafts = new Map();
const liveDraftSessions = new Map();

// ====== DISCORD/SUPABASE ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

const supabase = createClient(
  process.env.SUPABASE_URL.trim(),
  process.env.SUPABASE_KEY.trim()
);

// ====== SLASH COMMANDS ======
const commands = [
  new SlashCommandBuilder()
    .setName('avvia_iscrizioni_player')
    .setDescription('Staff: pubblica il pannello per iscrizione player singoli'),

  new SlashCommandBuilder()
    .setName('chiudi_iscrizioni_player')
    .setDescription('Staff: chiude le iscrizioni player'),

  new SlashCommandBuilder()
    .setName('sorteggia_squadre')
    .setDescription('Staff: sorteggia squadre bilanciate per ruolo')
    .addIntegerOption(o =>
      o.setName('numero_squadre')
        .setDescription('Numero squadre da creare')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(40)
    )
    .addStringOption(o =>
      o.setName('nomi_squadre')
        .setDescription('Nomi separati da virgola. Es: Milan,Inter,Roma,Juve')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('max_player')
        .setDescription('Massimo player per squadra')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(30)
    ),

  new SlashCommandBuilder()
    .setName('staff_assegna_capitano')
    .setDescription('Staff: assegna/cambia capitano di una squadra draft')
    .addUserOption(o =>
      o.setName('utente')
        .setDescription('Utente da rendere capitano')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('squadra')
        .setDescription('Nome esatto squadra draft')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('staff_rimuovi_capitano')
    .setDescription('Staff: rimuove il ruolo capitano da un utente')
    .addUserOption(o =>
      o.setName('utente')
        .setDescription('Utente da cui rimuovere capitano')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('crea_competizione')
    .setDescription('Staff: crea una competizione e seleziona le squadre'),

  new SlashCommandBuilder()
    .setName('genera_calendario')
    .setDescription('Staff: genera calendario/gironi/tabellone'),

  new SlashCommandBuilder()
    .setName('referto')
    .setDescription('Capitani: compila il referto partita'),

  new SlashCommandBuilder()
    .setName('classifica')
    .setDescription('Mostra la classifica di una competizione')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome competizione')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('assegna_premio_competizione')
    .setDescription('Staff: assegna bonus overall per vittoria/coppe/capocannoniere')
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player da premiare')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('premio')
        .setDescription('Tipo premio')
        .setRequired(true)
        .addChoices(
          { name: 'Vittoria campionato +15', value: 'league_win' },
          { name: 'Vittoria coppa nazionale +10', value: 'national_cup_win' },
          { name: 'Vittoria coppa europea +20', value: 'european_cup_win' },
          { name: 'Vittoria mondiale/europeo +25', value: 'national_tournament_win' },
          { name: 'Capocannoniere competizione +10', value: 'top_scorer' }
        )
    ),


  new SlashCommandBuilder()
    .setName('avvia_stagione_club')
    .setDescription('Staff: attiva la modalità club'),

  new SlashCommandBuilder()
    .setName('chiudi_stagione_club')
    .setDescription('Staff: chiude la modalità club'),

  new SlashCommandBuilder()
    .setName('avvia_stagione_nazionale')
    .setDescription('Staff: attiva la modalità nazionali'),

  new SlashCommandBuilder()
    .setName('chiudi_stagione_nazionale')
    .setDescription('Staff: chiude la modalità nazionali'),

  new SlashCommandBuilder()
    .setName('prepara_draft_club')
    .setDescription('Staff: prepara il sorteggio live club')
    .addIntegerOption(o =>
      o.setName('numero_squadre')
        .setDescription('Numero squadre club')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(40)
    )
    .addStringOption(o =>
      o.setName('nomi_squadre')
        .setDescription('Nomi squadre separati da virgola')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('max_player')
        .setDescription('Massimo player per squadra')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(30)
    ),

  new SlashCommandBuilder()
    .setName('prepara_draft_nazionale')
    .setDescription('Staff: prepara il sorteggio live nazionali')
    .addIntegerOption(o =>
      o.setName('numero_nazionali')
        .setDescription('Numero nazionali')
        .setRequired(true)
        .setMinValue(2)
        .setMaxValue(40)
    )
    .addStringOption(o =>
      o.setName('nomi_nazionali')
        .setDescription('Nomi nazionali separati da virgola')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('max_player')
        .setDescription('Massimo player per nazionale')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(30)
    ),

  new SlashCommandBuilder()
    .setName('pesca_draft_live')
    .setDescription('Staff: pesca il prossimo player del draft live attivo'),

  new SlashCommandBuilder()
    .setName('chiudi_draft_live')
    .setDescription('Staff: chiude il draft live attivo'),

  new SlashCommandBuilder()
    .setName('reset_nazionali')
    .setDescription('Staff: resetta squadre nazionali e convocazioni dopo una competizione'),


  new SlashCommandBuilder()
    .setName('chiudi_competizione')
    .setDescription('Staff: chiude una competizione e assegna i bonus vittoria')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome esatto competizione')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('vincitore')
        .setDescription('Nome esatto squadra/nazionale vincitrice')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('capocannoniere')
    .setDescription('Mostra il capocannoniere di una competizione')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome competizione')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('assegna_capocannoniere')
    .setDescription('Staff: assegna bonus capocannoniere a un player')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome competizione')
        .setRequired(true)
    )
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player capocannoniere')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('applica_promozioni_retrocessioni')
    .setDescription('Staff: calcola promosse/retrocesse di un campionato')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome campionato')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('prossime_partite')
    .setDescription('Mostra le prossime partite di una competizione')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome competizione')
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('assegna_capitano_club')
    .setDescription('Staff: assegna un capitano a un club tramite menu'),

  new SlashCommandBuilder()
    .setName('assegna_capitano_nazionale')
    .setDescription('Staff: assegna un capitano a una nazionale tramite menu'),


  new SlashCommandBuilder()
    .setName('apri_mercato')
    .setDescription('Staff: apre il mercato club'),

  new SlashCommandBuilder()
    .setName('chiudi_mercato')
    .setDescription('Staff: chiude il mercato club'),

  new SlashCommandBuilder()
    .setName('pubblica_free_agent')
    .setDescription('Staff: pubblica il pannello candidature free agent'),

  new SlashCommandBuilder()
    .setName('stagione_terminata')
    .setDescription('Staff: termina la stagione club e scala i contratti'),

  new SlashCommandBuilder()
    .setName('budget_club')
    .setDescription('Capitano: mostra budget e stipendi del club'),


  new SlashCommandBuilder()
    .setName('avvia_elezioni_capitani')
    .setDescription('Staff: pubblica il pannello candidature capitano/CT'),

  new SlashCommandBuilder()
    .setName('chiudi_elezioni_capitani')
    .setDescription('Staff: chiude le elezioni capitani/CT e assegna vincitori'),

  new SlashCommandBuilder()
    .setName('richiedi_trattativa')
    .setDescription('Capitano: richiedi trattativa per un player di un altro club'),

  new SlashCommandBuilder()
    .setName('proponi_rinnovo')
    .setDescription('Capitano: proponi rinnovo contratto a un player del tuo club'),

  new SlashCommandBuilder()
    .setName('ranking_rpci')
    .setDescription('Mostra la classifica globale Overall RPCI'),

  new SlashCommandBuilder()
    .setName('hall_of_fame')
    .setDescription('Mostra la Hall of Fame RPCI'),

  new SlashCommandBuilder()
    .setName('assegna_premio')
    .setDescription('Staff: assegna un premio RPCI a un player')
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player da premiare')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('premio')
        .setDescription('Tipo premio')
        .setRequired(true)
        .addChoices(
          { name: 'MVP Stagione +15', value: 'season_mvp' },
          { name: 'Miglior Portiere +10', value: 'best_gk' },
          { name: 'Miglior Difensore +10', value: 'best_defender' },
          { name: 'Miglior Assistman +10', value: 'best_assistman' },
          { name: 'Fair Play +5', value: 'fair_play' }
        )
    ),


  new SlashCommandBuilder()
    .setName('pannello_staff')
    .setDescription('Staff: apre pannello centrale gestione RPCI'),

  new SlashCommandBuilder()
    .setName('backup_stagione')
    .setDescription('Staff: crea backup manuale stagione'),

  new SlashCommandBuilder()
    .setName('squalifiche')
    .setDescription('Mostra player squalificati'),


  new SlashCommandBuilder()
    .setName('pubblica_pannelli_canali')
    .setDescription('Staff: pubblica pannelli bilancio, rose, calendario e referti'),

  new SlashCommandBuilder()
    .setName('bilancio_club')
    .setDescription('Mostra il bilancio del tuo club'),

  new SlashCommandBuilder()
    .setName('rosa_club')
    .setDescription('Mostra la rosa del tuo club'),

  new SlashCommandBuilder()
    .setName('calendario_mia_squadra')
    .setDescription('Mostra il calendario della tua squadra'),


  new SlashCommandBuilder()
    .setName('genera_fase_finale')
    .setDescription('Staff: genera fase finale automatica da gironi')
    .addStringOption(o =>
      o.setName('competizione')
        .setDescription('Nome competizione')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('staff_dashboard')
    .setDescription('Staff: mostra dashboard avanzata RPCI'),

  new SlashCommandBuilder()
    .setName('carriera_player')
    .setDescription('Mostra storico carriera RPCI di un player')
    .addUserOption(o =>
      o.setName('player')
        .setDescription('Player')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('controlli_sistema')
    .setDescription('Staff: controlli anti-errore database e mercato'),

  new SlashCommandBuilder()
    .setName('statistiche_player')
    .setDescription('Mostra statistiche di un player')
    .addUserOption(o =>
      o.setName('utente')
        .setDescription('Player')
        .setRequired(true)
    )
].map(c => c.toJSON());






// Alias slash command sicuri per comandi dashboard/budget/rosa/pannelli.
// Questi nomi sono corti e senza underscore lunghi, così Discord li accetta sempre.
const forcedAliasCommands = [
  { name: 'dashboard', description: 'Staff: dashboard RPCI', type: 1 },
  { name: 'staff', description: 'Staff: pannello rapido RPCI', type: 1 },
  { name: 'budget', description: 'Mostra budget del tuo club', type: 1 },
  { name: 'bilancio', description: 'Mostra bilancio del tuo club', type: 1 },
  { name: 'rosa', description: 'Mostra rosa del tuo club', type: 1 },
  { name: 'calendario', description: 'Mostra calendario della tua squadra', type: 1 },
  { name: 'pannelli', description: 'Staff: pubblica pannelli canali RPCI', type: 1 }
];

for (const forcedCommand of forcedAliasCommands) {
  const exists = commands.some(command => {
    const json = typeof command.toJSON === 'function' ? command.toJSON() : command;
    return json?.name === forcedCommand.name;
  });
  if (!exists) commands.push(forcedCommand);
}



const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

function normalizeSlashName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);
}

function prepareSlashCommand(command) {
  if (!command || typeof command !== 'object') return null;

  const raw = typeof command.toJSON === 'function' ? command.toJSON() : command;
  const clone = JSON.parse(JSON.stringify(raw));

  clone.type = 1;
  clone.name = normalizeSlashName(clone.name);
  if (!clone.name) return null;

  clone.description = String(clone.description || 'Comando RPCI').slice(0, 100);
  if (!clone.description) clone.description = 'Comando RPCI';

  function cleanChoices(choices) {
    if (!Array.isArray(choices)) return undefined;

    const cleaned = choices
      .filter(choice => choice && typeof choice === 'object')
      .filter(choice => typeof choice.name === 'string' && choice.name.trim().length > 0)
      .filter(choice => Object.prototype.hasOwnProperty.call(choice, 'value'))
      .map(choice => ({
        name: String(choice.name).slice(0, 100),
        value: typeof choice.value === 'string' ? choice.value.slice(0, 100) : choice.value
      }))
      .slice(0, 25);

    return cleaned.length ? cleaned : undefined;
  }

  function cleanOptions(options) {
    if (!Array.isArray(options)) return undefined;

    const cleaned = [];

    for (const option of options) {
      if (!option || typeof option !== 'object') continue;
      if (!option.type) continue;

      const clean = { ...option };

      clean.name = normalizeSlashName(clean.name);
      if (!clean.name) continue;

      clean.description = String(clean.description || clean.name).slice(0, 100);
      if (!clean.description) clean.description = clean.name;

      if (clean.choices) {
        const choices = cleanChoices(clean.choices);
        if (choices) clean.choices = choices;
        else delete clean.choices;
      }

      if (clean.options) {
        const sub = cleanOptions(clean.options);
        if (sub) clean.options = sub;
        else delete clean.options;
      }

      cleaned.push(clean);
    }

    return cleaned.length ? cleaned.slice(0, 25) : undefined;
  }

  const options = cleanOptions(clone.options || []);
  if (options) clone.options = options;
  else delete clone.options;

  return clone;
}

function getDiscordError(error) {
  try {
    return JSON.stringify(error?.rawError || error?.data || error?.message || error, null, 2);
  } catch {
    return String(error?.message || error);
  }
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout dopo ${ms}ms`)), ms))
  ]);
}

(async () => {
  try {
    console.log('🔄 Registrazione slash commands in blocco...');

    const prepared = [];
    const seen = new Set();

    for (const commandBuilder of commands.filter(Boolean)) {
      const preparedCommand = prepareSlashCommand(commandBuilder);
      if (!preparedCommand) continue;

      if (seen.has(preparedCommand.name)) {
        console.warn('⚠️ Comando duplicato scartato:', preparedCommand.name);
        continue;
      }

      seen.add(preparedCommand.name);
      prepared.push(preparedCommand);
    }

    console.log(`Comandi da registrare: ${prepared.length}`);
    console.log('Comandi:', prepared.map(c => c.name).join(', '));

    await withTimeout(
      rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: prepared }
      ),
      45000,
      'Registrazione slash commands'
    );

    console.log(`✅ Slash commands registrati correttamente: ${prepared.length}`);
  } catch (error) {
    console.error('❌ Errore registrazione slash commands:', getDiscordError(error));
  }
})();


client.once('ready', () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
});

// =======================================================
// UTILS
// =======================================================
function isStaff(member) {
  return member?.permissions?.has(PermissionFlagsBits.Administrator) ||
         member?.permissions?.has(PermissionFlagsBits.ManageGuild);
}

async function logCommand(interaction) {
  try {
    if (!interaction.isChatInputCommand()) return;
    const ch = await client.channels.fetch(BOT_LOG_CHANNEL_ID).catch(() => null);
    if (!ch) return;

    const opts = interaction.options?.data?.map(o => `${o.name}: ${o.value ?? ''}`).join('\n') || 'Nessuna opzione';

    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🧾 Comando usato')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Utente', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
            { name: 'Comando', value: `/${interaction.commandName}` },
            { name: 'Canale', value: `<#${interaction.channelId}>` },
            { name: 'Opzioni', value: opts.slice(0, 1024) || 'Nessuna' }
          )
          .setTimestamp()
      ]
    });
  } catch (e) {
    console.error('logCommand:', e);
  }
}

function parseCommaList(value) {
  return String(value || '')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function findDiscordRoleForGameRole(guild, roleCode) {
  const envKey = ROLE_ENV_KEYS[roleCode];
  const configuredId = process.env[envKey];

  if (configuredId) {
    const role = await guild.roles.fetch(configuredId).catch(() => null);
    if (role) return role;
  }

  const names = [roleCode, ROLE_LABELS[roleCode]].filter(Boolean).map(x => x.toLowerCase());
  return guild.roles.cache.find(r => names.includes(r.name.toLowerCase())) || null;
}

async function getDraftTeamByCaptain(discordId) {
  const { data } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('captain_discord_id', discordId)
    .maybeSingle();

  return data || null;
}

async function getRosterByDraftTeamId(teamId) {
  const { data } = await supabase
    .from('draft_assignments')
    .select('*, player_registrations(*)')
    .eq('draft_team_id', teamId)
    .order('pick_number', { ascending: true });

  return data || [];
}

// =======================================================
// FASE 1 - ISCRIZIONE PLAYER
// =======================================================
function buildPlayerRegistrationPanel() {
  const embed = new EmbedBuilder()
    .setTitle('📝 ISCRIZIONI PLAYER RPCI')
    .setColor(0xd4af37)
    .setDescription(
      'Iscriviti come player alla competizione RPCI.\n\n' +
      'Dovrai scegliere il ruolo e compilare:\n' +
      '• Nome\n• Età\n• Console\n• ID Console\n• Overall\n\n' +
      'Dopo l’iscrizione, lo staff potrà sorteggiare le squadre.'
    )
    .setFooter({ text: 'RPCI • Iscrizione player singoli' })
    .setTimestamp();

  const btn = new ButtonBuilder()
    .setCustomId('player_signup_start')
    .setLabel('ISCRIVITI COME PLAYER')
    .setStyle(ButtonStyle.Primary);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] };
}

function buildPlayerRoleSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('player_signup_role_select')
      .setPlaceholder('Scegli il tuo ruolo principale')
      .addOptions(GAME_ROLES.map(code => ({
        label: `${code} - ${ROLE_LABELS[code]}`,
        value: code,
        description: ROLE_LABELS[code].slice(0, 100)
      })))
  );
}

function buildPlayerDataModal() {
  const modal = new ModalBuilder()
    .setCustomId('player_signup_data_modal')
    .setTitle('Dati iscrizione player');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('name')
        .setLabel('NOME')
        .setPlaceholder('Nome player')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('age')
        .setLabel('ETÀ')
        .setPlaceholder('Esempio: 18')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('platform')
        .setLabel('CONSOLE')
        .setPlaceholder('PS5, XBOX oppure PC')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('platform_id')
        .setLabel('ID CONSOLE')
        .setPlaceholder('Esempio: alexfortu')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

async function getRegistrationOpen() {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'player_registration_open')
    .maybeSingle();

  return data?.value?.open === true;
}

async function setRegistrationOpen(open) {
  await supabase
    .from('bot_settings')
    .upsert({
      key: 'player_registration_open',
      value: { open },
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
}


async function setModeActive(mode, active) {
  await supabase
    .from('bot_settings')
    .upsert({
      key: `${mode}_mode_active`,
      value: { active },
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
}

async function getModeActive(mode) {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', `${mode}_mode_active`)
    .maybeSingle();

  return data?.value?.active === true;
}

async function createLiveDraftSession({ mode, teamNames, maxPlayers, createdBy }) {
  const { data: session, error } = await supabase
    .from('draft_sessions')
    .insert({
      mode,
      status: 'active',
      team_names: teamNames,
      max_players: maxPlayers,
      created_by_discord_id: createdBy
    })
    .select()
    .single();

  if (error) throw error;

  const insertedTeams = [];

  for (let i = 0; i < teamNames.length; i++) {
    const { data: team, error: teamError } = await supabase
      .from('draft_teams')
      .insert({
        name: teamNames[i],
        seed_number: i + 1,
        team_type: mode,
        draft_session_id: session.id,
        status: 'drafted',
        created_by_discord_id: createdBy
      })
      .select()
      .single();

    if (teamError) throw teamError;
    insertedTeams.push(team);
  }

  return { session, teams: insertedTeams };
}

async function getActiveLiveDraftSession() {
  const { data: session } = await supabase
    .from('draft_sessions')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return null;

  const { data: teams } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('draft_session_id', session.id)
    .order('seed_number', { ascending: true });

  return { session, teams: teams || [] };
}

async function getAvailablePlayersForLiveDraft(mode) {
  const { data: usedAssignments } = await supabase
    .from('draft_assignments')
    .select('discord_id, draft_teams!inner(team_type)')
    .eq('draft_teams.team_type', mode);

  const usedIds = new Set((usedAssignments || []).map(row => row.discord_id));

  const { data: players } = await supabase
    .from('player_registrations')
    .select('*')
    .in('status', mode === 'national' ? ['assigned'] : ['registered'])
    .order('created_at', { ascending: true });

  return (players || []).filter(player => !usedIds.has(player.discord_id));
}

async function pickNextLiveDraftPlayer(sessionPack) {
  const { session, teams } = sessionPack;
  const available = await getAvailablePlayersForLiveDraft(session.mode);

  if (!available.length) {
    return { done: true, reason: 'Nessun player disponibile da pescare.' };
  }

  const teamsWithCounts = [];

  for (const team of teams) {
    const { count } = await supabase
      .from('draft_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('draft_team_id', team.id);

    teamsWithCounts.push({ ...team, count: count || 0 });
  }

  const openTeams = teamsWithCounts.filter(team => Number(team.count || 0) < Number(session.max_players || 30));

  if (!openTeams.length) {
    return { done: true, reason: 'Tutte le squadre/nazionali sono piene.' };
  }

  openTeams.sort((a, b) => Number(a.count || 0) - Number(b.count || 0));
  const lowestCount = Number(openTeams[0].count || 0);
  const candidateTeams = openTeams.filter(team => Number(team.count || 0) === lowestCount);
  const chosenTeam = shuffle(candidateTeams)[0];

  const { data: currentRoster } = await supabase
    .from('draft_assignments')
    .select('*')
    .eq('draft_team_id', chosenTeam.id);

  const roleCounts = {};
  for (const role of GAME_ROLES) roleCounts[role] = 0;

  for (const player of currentRoster || []) {
    if (player.primary_role) {
      roleCounts[player.primary_role] = Number(roleCounts[player.primary_role] || 0) + 1;
    }
  }

  const availableByRole = {};
  for (const player of available) {
    if (!availableByRole[player.primary_role]) availableByRole[player.primary_role] = [];
    availableByRole[player.primary_role].push(player);
  }

  const availableRoles = Object.keys(availableByRole);
  availableRoles.sort((a, b) => Number(roleCounts[a] || 0) - Number(roleCounts[b] || 0));

  const chosenRole = availableRoles[0];
  const player = shuffle(availableByRole[chosenRole])[0];

  const { count: totalPicks } = await supabase
    .from('draft_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('draft_team_id', chosenTeam.id);

  const { data: assignment, error } = await supabase
    .from('draft_assignments')
    .insert({
      draft_team_id: chosenTeam.id,
      player_registration_id: player.id,
      discord_id: player.discord_id,
      discord_tag: player.discord_tag,
      primary_role: player.primary_role,
      platform_id: player.platform_id,
      pick_number: Number(totalPicks || 0) + 1
    })
    .select()
    .single();

  if (error) throw error;

  if (session.mode === 'club') {
    await supabase
      .from('player_registrations')
      .update({
        status: 'assigned',
        assigned_team_name: chosenTeam.name,
        updated_at: new Date().toISOString()
      })
      .eq('id', player.id);
  }

  return { done: false, player, team: chosenTeam, assignment };
}

function buildLiveDraftPickEmbed({ player, team, session }) {
  return new EmbedBuilder()
    .setTitle(session.mode === 'national' ? '🌍 DRAFT NAZIONALI LIVE' : '🎲 DRAFT CLUB LIVE')
    .setColor(0xd4af37)
    .setDescription(
      `È stato sorteggiato **${player.name}** per:\n\n` +
      `🏟️ **${team.name}**`
    )
    .addFields(
      { name: 'Player', value: `<@${player.discord_id}>`, inline: true },
      { name: 'ID Console', value: player.platform_id || 'N/D', inline: true },
      { name: 'Ruolo', value: `${player.primary_role} - ${ROLE_LABELS[player.primary_role] || ''}`, inline: true },
      { name: 'Overall RPCI', value: String(player.rpci_overall || player.overall || 0), inline: true },
      { name: 'Modalità', value: session.mode === 'national' ? 'Nazionale' : 'Club', inline: true }
    )
    .setFooter({ text: 'RPCI • Sorteggio live' })
    .setTimestamp();
}

async function closeActiveLiveDraftSession() {
  const active = await getActiveLiveDraftSession();
  if (!active) return null;

  await supabase
    .from('draft_sessions')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString()
    })
    .eq('id', active.session.id);

  return active.session;
}

async function resetNationalDraftData() {
  const { data: nationalTeams } = await supabase
    .from('draft_teams')
    .select('id')
    .eq('team_type', 'national');

  const ids = (nationalTeams || []).map(team => team.id);

  if (ids.length) {
    await supabase
      .from('draft_assignments')
      .delete()
      .in('draft_team_id', ids);

    await supabase
      .from('draft_teams')
      .delete()
      .in('id', ids);
  }

  await supabase
    .from('draft_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('mode', 'national')
    .eq('status', 'active');

  return ids.length;
}


// =======================================================
// FASE 2 - DRAFT SQUADRE / CAPITANI
// =======================================================
async function getRegisteredPlayersForDraft() {
  const { data, error } = await supabase
    .from('player_registrations')
    .select('*')
    .eq('status', 'registered')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

function balancedDraft(players, teamNames, maxPlayers) {
  const teams = teamNames.map((name, idx) => ({
    name,
    seed: idx + 1,
    players: []
  }));

  const byRole = {};
  for (const role of GAME_ROLES) byRole[role] = [];
  for (const p of players) {
    if (!byRole[p.primary_role]) byRole[p.primary_role] = [];
    byRole[p.primary_role].push(p);
  }

  let pickNumber = 1;
  const assignments = [];

  for (const role of GAME_ROLES) {
    const pool = shuffle(byRole[role] || []);
    let teamIndex = 0;

    for (const player of pool) {
      const available = teams
        .map((t, i) => ({ t, i }))
        .filter(x => x.t.players.length < maxPlayers);

      if (!available.length) break;

      // scegli la squadra con meno player; a parità ruota
      available.sort((a, b) => a.t.players.length - b.t.players.length);
      const chosen = available[teamIndex % available.length].t;
      chosen.players.push(player);
      assignments.push({ teamName: chosen.name, player, pickNumber: pickNumber++ });
      teamIndex++;
    }
  }

  return { teams, assignments };
}

function buildDraftResultEmbed(teams) {
  const embed = new EmbedBuilder()
    .setTitle('🎲 SORTEGGIO SQUADRE COMPLETATO')
    .setColor(0xd4af37)
    .setDescription('Le squadre sono state create bilanciando i player per ruolo.')
    .setFooter({ text: 'RPCI • Player Draft' })
    .setTimestamp();

  for (const team of teams.slice(0, 20)) {
    const roleSummary = {};
    for (const p of team.players) roleSummary[p.primary_role] = (roleSummary[p.primary_role] || 0) + 1;
    const text = Object.entries(roleSummary).map(([r, n]) => `${r}: ${n}`).join(' • ') || 'Nessun player';
    embed.addFields({ name: `${team.name} (${team.players.length})`, value: text.slice(0, 1024), inline: false });
  }

  return embed;
}

// =======================================================
// FASE 3 - COMPETIZIONI / CALENDARI
// =======================================================
function competitionTypeLabel(type) {
  if (type === 'league') return 'Campionato';
  if (type === 'national_cup') return 'Coppa Nazionale';
  if (type === 'european_cup') return 'Coppa Europea';
  if (type === 'world_cup') return 'Coppa del Mondo';
  if (type === 'euro') return 'Europeo';
  return 'Competizione';
}

function competitionModeLabel(mode) {
  if (mode === 'club') return 'Modalità Club';
  if (mode === 'national') return 'Modalità Nazionale';
  return 'Modalità non specificata';
}

function buildCompetitionModeSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_mode_select')
      .setPlaceholder('Scegli modalità competizione')
      .addOptions([
        {
          label: 'Modalità Club',
          value: 'club',
          description: 'Campionati, coppe nazionali, coppe europee per club'
        },
        {
          label: 'Modalità Nazionale',
          value: 'national',
          description: 'Coppa del Mondo o Europeo per nazionali'
        }
      ])
  );
}

function buildNationalCompetitionTypeSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('national_competition_type_select')
      .setPlaceholder('Scegli tipo competizione nazionali')
      .addOptions([
        {
          label: 'Coppa del Mondo',
          value: 'world_cup',
          description: 'Competizione nazionali stile mondiale'
        },
        {
          label: 'Europeo',
          value: 'euro',
          description: 'Competizione nazionali stile europeo'
        }
      ])
  );
}

function buildCompetitionTypeSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_type_select')
      .setPlaceholder('Scegli tipo competizione')
      .addOptions([
        { label: 'Campionato', value: 'league', description: 'Serie A, Serie B, campionato a gironi' },
        { label: 'Coppa Nazionale', value: 'national_cup', description: 'Tabellone nazionale, A/R, finale secca' },
        { label: 'Coppa Europea', value: 'european_cup', description: 'Gironi europei + fase finale' }
      ])
  );
}

function parseSettings(type, raw) {
  const settings = {};
  if (raw) {
    for (const part of raw.split(';')) {
      const [k, v] = part.split('=').map(x => String(x || '').trim());
      if (!k || !v) continue;
      settings[k.toLowerCase()] = /^\d+$/.test(v) ? Number(v) : v;
    }
  }
  if (type === 'league') {
    settings.gironi = Number(settings.gironi || 1);
    settings.livello = Number(settings.livello || 1);
    settings.promosse = Number(settings.promosse || 0);
    settings.retrocesse = Number(settings.retrocesse || 0);
  }
  if (type === 'national_cup') {
    settings.andata_ritorno = settings.andata_ritorno || 'SI';
    settings.finale = settings.finale || 'secca';
  }
  if (type === 'european_cup' || type === 'world_cup' || type === 'euro') {
    settings.gironi = Number(settings.gironi || (type === 'world_cup' ? 8 : 4));
    settings.squadre_per_girone = Number(settings.squadre || settings.squadre_per_girone || 4);
    settings.qualificate_per_girone = Number(settings.qualificate || settings.qualificate_per_girone || 2);
  }
  return settings;
}

async function openCompetitionModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`competition_modal_${type}`)
    .setTitle(`Crea ${competitionTypeLabel(type)}`);

  let settingsPlaceholder = 'opzionale';
  if (type === 'league') settingsPlaceholder = 'gironi=1;livello=1;promosse=0;retrocesse=3';
  if (type === 'national_cup') settingsPlaceholder = 'andata_ritorno=SI;finale=secca;nazione=Italia';
  if (type === 'european_cup') settingsPlaceholder = 'gironi=4;squadre=4;qualificate=2';
  if (type === 'world_cup') settingsPlaceholder = 'gironi=8;squadre=4;qualificate=2';
  if (type === 'euro') settingsPlaceholder = 'gironi=4;squadre=4;qualificate=2';

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('NOME COMPETIZIONE').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('season').setLabel('STAGIONE').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('2026/27')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('logo_url').setLabel('LOGO URL').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('URL logo oppure NO')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('nation').setLabel('NAZIONE / AREA').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Italia, Inghilterra, Europa...')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('settings').setLabel('IMPOSTAZIONI').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder(settingsPlaceholder)
    )
  );

  return interaction.showModal(modal);
}

async function getDraftTeams() {
  const { data, error } = await supabase
    .from('draft_teams')
    .select('*')
    .order('seed_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getDraftTeamsByMode(mode) {
  const { data, error } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('team_type', mode)
    .order('seed_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

function buildCompetitionEmbed(draft) {
  const selected = draft.selectedTeamIds?.length || 0;
  const settingsText = Object.keys(draft.settings || {}).length
    ? Object.entries(draft.settings).map(([k, v]) => `• ${k}: ${v}`).join('\n')
    : 'Nessuna';

  return new EmbedBuilder()
    .setTitle('🏆 Crea Competizione')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Modalità', value: competitionModeLabel(draft.mode), inline: true },
      { name: 'Tipo', value: competitionTypeLabel(draft.type), inline: true },
      { name: 'Nome', value: draft.name || 'N/D', inline: true },
      { name: 'Stagione', value: draft.season || 'N/D', inline: true },
      { name: 'Nazione / Area', value: draft.nation || 'N/D', inline: true },
      { name: 'Squadre selezionate', value: String(selected), inline: true },
      { name: 'Impostazioni', value: settingsText.slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'RPCI • Competizioni' })
    .setTimestamp();
}

function buildCompetitionTeamSelect(draft) {
  const teams = draft.teams || [];
  const page = draft.page || 0;
  const pageItems = teams.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_team_select')
      .setPlaceholder('Seleziona squadre partecipanti')
      .setMinValues(1)
      .setMaxValues(Math.max(1, pageItems.length))
      .addOptions(pageItems.map(t => ({
        label: t.name.slice(0, 100),
        description: t.captain_discord_tag ? `Capitano: ${t.captain_discord_tag}` : 'Squadra draft',
        value: t.id
      })))
  );
}

function buildCompetitionButtons(draft) {
  const totalPages = Math.max(1, Math.ceil((draft.teams || []).length / PER_PAGE));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('competition_prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled((draft.page || 0) <= 0),
    new ButtonBuilder().setCustomId('competition_next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled((draft.page || 0) >= totalPages - 1),
    new ButtonBuilder().setCustomId('competition_confirm').setLabel('CREA COMPETIZIONE').setStyle(ButtonStyle.Success).setDisabled(!draft.selectedTeamIds || draft.selectedTeamIds.length < 2),
    new ButtonBuilder().setCustomId('competition_cancel').setLabel('ANNULLA').setStyle(ButtonStyle.Danger)
  );
}

async function updateCompetitionDraft(interaction, draft) {
  return interaction.update({
    embeds: [buildCompetitionEmbed(draft)],
    components: [buildCompetitionTeamSelect(draft), buildCompetitionButtons(draft)]
  });
}

async function saveCompetition(draft, createdBy) {
  const { data: comp, error } = await supabase
    .from('competitions')
    .insert({
      name: draft.name,
      mode: draft.mode || 'club',
      type: draft.type,
      season: draft.season,
      logo_url: draft.logoUrl,
      nation: draft.nation,
      settings: draft.settings || {},
      status: 'setup',
      created_by_discord_id: createdBy
    })
    .select()
    .single();

  if (error) throw error;

  const selected = draft.teams.filter(t => draft.selectedTeamIds.includes(t.id));
  const rows = selected.map((team, index) => ({
    competition_id: comp.id,
    draft_team_id: team.id,
    team_name: team.name,
    seed_number: index + 1,
    group_name: null
  }));

  if (rows.length) {
    const { error: pErr } = await supabase.from('competition_participants').insert(rows);
    if (pErr) throw pErr;
  }

  return comp;
}

// Calendario
async function getCalendarCompetitions() {
  const { data } = await supabase
    .from('competitions')
    .select('*')
    .in('status', ['setup', 'calendar_generated'])
    .order('created_at', { ascending: false });
  return data || [];
}

function buildCalendarSelect(draft) {
  const items = (draft.competitions || []).slice((draft.page || 0) * PER_PAGE, (draft.page || 0) * PER_PAGE + PER_PAGE);
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('calendar_comp_select')
      .setPlaceholder('Seleziona competizione')
      .addOptions(items.map(c => ({
        label: `${c.name} • ${competitionTypeLabel(c.type)}`.slice(0, 100),
        description: `Stagione ${c.season} • ${c.status}`.slice(0, 100),
        value: c.id
      })))
  );
}

function buildCalendarButtons(draft) {
  const total = Math.max(1, Math.ceil((draft.competitions || []).length / PER_PAGE));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('calendar_prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled((draft.page || 0) <= 0),
    new ButtonBuilder().setCustomId('calendar_next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled((draft.page || 0) >= total - 1),
    new ButtonBuilder().setCustomId('calendar_generate').setLabel('GENERA').setStyle(ButtonStyle.Success).setDisabled(!draft.competitionId),
    new ButtonBuilder().setCustomId('calendar_cancel').setLabel('ANNULLA').setStyle(ButtonStyle.Danger)
  );
}

function buildCalendarEmbed(draft) {
  return new EmbedBuilder()
    .setTitle('📅 Genera Calendario')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Competizione', value: draft.selectedCompetition ? draft.selectedCompetition.name : 'Nessuna', inline: false },
      { name: 'Tipo', value: draft.selectedCompetition ? competitionTypeLabel(draft.selectedCompetition.type) : 'N/D', inline: true },
      { name: 'Stagione', value: draft.selectedCompetition?.season || 'N/D', inline: true }
    )
    .setTimestamp();
}

async function updateCalendarDraft(interaction, draft) {
  return interaction.update({
    embeds: [buildCalendarEmbed(draft)],
    components: [buildCalendarSelect(draft), buildCalendarButtons(draft)]
  });
}

function roundRobin(participants) {
  const teams = [...participants];
  if (teams.length % 2 === 1) teams.push(null);
  const rounds = [];
  const n = teams.length;
  let arr = [...teams];

  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        const swap = r % 2 === 1;
        matches.push({ home: swap ? b : a, away: swap ? a : b });
      }
    }
    rounds.push(matches);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return rounds;
}

function koRoundName(n) {
  if (n <= 2) return 'Finale';
  if (n <= 4) return 'Semifinale';
  if (n <= 8) return 'Quarti';
  if (n <= 16) return 'Ottavi';
  if (n <= 32) return 'Sedicesimi';
  return `Turno ${n}`;
}

function matchRow(comp, home, away, roundName, matchday, leg = 1, groupName = null) {
  return {
    competition_id: comp.id,
    group_name: groupName,
    round_name: roundName,
    leg_number: leg,
    matchday,
    home_draft_team_id: home.draft_team_id,
    away_draft_team_id: away.draft_team_id,
    home_team_name: home.team_name,
    away_team_name: away.team_name,
    status: 'scheduled'
  };
}

async function generateCalendar(competitionId) {
  const { data: comp, error: compErr } = await supabase.from('competitions').select('*').eq('id', competitionId).single();
  if (compErr || !comp) throw new Error('Competizione non trovata');

  const { data: parts, error: pErr } = await supabase
    .from('competition_participants')
    .select('*')
    .eq('competition_id', competitionId)
    .order('seed_number', { ascending: true });

  if (pErr) throw pErr;
  if (!parts || parts.length < 2) throw new Error('Servono almeno 2 squadre');

  await supabase.from('matches').delete().eq('competition_id', competitionId).in('status', ['scheduled', 'pending_reports', 'disputed']);

  let rows = [];

  if (comp.type === 'league') {
    const groupsCount = Math.max(1, Number(comp.settings?.gironi || 1));
    const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: groupsCount > 1 ? `Girone ${String.fromCharCode(65 + i)}` : 'Girone Unico', teams: [] }));
    shuffle(parts).forEach((p, i) => groups[i % groupsCount].teams.push(p));

    for (const group of groups) {
      for (const p of group.teams) {
        await supabase.from('competition_participants').update({ group_name: group.name }).eq('id', p.id);
      }
      const rounds = roundRobin(group.teams);
      rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.home, m.away, `Andata • ${group.name}`, idx + 1, 1, group.name))));
      rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.away, m.home, `Ritorno • ${group.name}`, rounds.length + idx + 1, 2, group.name))));
    }
  }

  if (comp.type === 'national_cup') {
    const teams = shuffle(parts);
    const roundName = koRoundName(teams.length);
    let md = 1;
    for (let i = 0; i < teams.length; i += 2) {
      const home = teams[i];
      const away = teams[i + 1];
      if (!home || !away) continue;
      const final = teams.length <= 2;
      rows.push(matchRow(comp, home, away, roundName, md, 1, null));
      if (!final) rows.push(matchRow(comp, away, home, `${roundName} • Ritorno`, md + 1, 2, null));
      md += final ? 1 : 2;
    }
  }

  if (comp.type === 'european_cup' || comp.type === 'world_cup' || comp.type === 'euro') {
    const groupsCount = Math.max(1, Number(comp.settings?.gironi || 4));
    const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: `Girone ${String.fromCharCode(65 + i)}`, teams: [] }));
    shuffle(parts).forEach((p, i) => groups[i % groupsCount].teams.push(p));

    for (const group of groups) {
      for (const p of group.teams) {
        await supabase.from('competition_participants').update({ group_name: group.name }).eq('id', p.id);
      }
      const rounds = roundRobin(group.teams);
      rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.home, m.away, `Gironi • ${group.name}`, idx + 1, 1, group.name))));
      rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.away, m.home, `Gironi ritorno • ${group.name}`, rounds.length + idx + 1, 2, group.name))));
    }
  }

  if (!rows.length) throw new Error('Nessuna partita generata');
  const { error: mErr } = await supabase.from('matches').insert(rows);
  if (mErr) throw mErr;

  await supabase.from('competitions').update({ status: 'calendar_generated' }).eq('id', competitionId);
  return { competition: comp, matchesCreated: rows.length, teams: parts.length };
}

// =======================================================
// FASE 4 - REFERTI / RISULTATI / STATISTICHE
// =======================================================
async function getCaptainMatches(discordId) {
  const team = await getDraftTeamByCaptain(discordId);
  if (!team) return { team: null, matches: [] };

  const { data } = await supabase
    .from('matches')
    .select('*, competitions(name, type, season)')
    .or(`home_draft_team_id.eq.${team.id},away_draft_team_id.eq.${team.id}`)
    .in('status', ['scheduled', 'pending_reports', 'disputed'])
    .order('matchday', { ascending: true });

  return { team, matches: data || [] };
}

function buildMatchSelect(matches, teamId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('report_match_select')
      .setPlaceholder('Seleziona partita')
      .addOptions(matches.slice(0, 25).map(m => {
        const isHome = m.home_draft_team_id === teamId;
        const opponent = isHome ? m.away_team_name : m.home_team_name;
        return {
          label: `${m.home_team_name} vs ${m.away_team_name}`.slice(0, 100),
          description: `${m.competitions?.name || 'Competizione'} • vs ${opponent}`.slice(0, 100),
          value: m.id
        };
      }))
  );
}

function buildReportEmbed(draft) {
  const goalsText = draft.goals.length ? draft.goals.map(x => `• ${x.platformId}: ${x.count}`).join('\n') : 'Nessun gol';
  const assistsText = draft.assists.length ? draft.assists.map(x => `• ${x.platformId}: ${x.count}`).join('\n') : 'Nessun assist';
  const mvp = draft.mvpPlayerId ? draft.roster.find(p => p.id === draft.mvpPlayerId)?.platform_id || 'Selezionato' : 'Non selezionato';
  const yellowsText = (draft.yellowCards || []).length ? (draft.yellowCards || []).map(x => `• <@${x.discordId}>`).join('\n') : 'Nessuna';
  const redsText = (draft.redCards || []).length ? (draft.redCards || []).map(x => `• <@${x.discordId}>`).join('\n') : 'Nessuna';

  return new EmbedBuilder()
    .setTitle('📝 Referto partita')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Partita', value: draft.matchLabel || 'Non selezionata', inline: false },
      { name: 'Risultato', value: draft.scoreSet ? `${draft.goalsFor} - ${draft.goalsAgainst}` : 'Non inserito', inline: true },
      { name: 'Presenti', value: draft.presentPlayers.length ? `${draft.presentPlayers.length} player` : 'Non selezionati', inline: true },
      { name: 'MVP', value: mvp, inline: true },
      { name: 'Gol', value: goalsText.slice(0, 1024), inline: false },
      { name: 'Assist', value: assistsText.slice(0, 1024), inline: false },
      { name: 'Ammonizioni', value: yellowsText.slice(0, 1024), inline: true },
      { name: 'Espulsioni', value: redsText.slice(0, 1024), inline: true }
    )
    .setFooter({ text: 'Compila solo i player della tua squadra. Conferma finale quando entrambe le squadre hanno inviato il referto.' })
    .setTimestamp();
}

function buildPresentSelect(draft) {
  const roster = draft.roster || [];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('report_present_select')
      .setPlaceholder('Seleziona presenti')
      .setMinValues(1)
      .setMaxValues(Math.min(25, roster.length))
      .addOptions(roster.slice(0, 25).map(r => ({
        label: `${r.player_registrations?.platform_id || r.platform_id || r.discord_tag}`.slice(0, 100),
        description: `${r.primary_role || r.player_registrations?.primary_role || 'Ruolo'} • ${r.discord_tag || r.discord_id}`.slice(0, 100),
        value: r.id
      })))
  );
}

function buildReportButtons(draft) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('report_score').setLabel('RISULTATO').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('report_goal').setLabel('GOL').setStyle(ButtonStyle.Success).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_assist').setLabel('ASSIST').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_mvp').setLabel('MVP').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_confirm').setLabel('CONFERMA').setStyle(ButtonStyle.Danger).setDisabled(!draft.scoreSet || !draft.presentPlayers.length)
  );
}

function buildReportDisciplineButtons(draft) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('report_yellow').setLabel('AMMONIZIONE').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_red').setLabel('ESPULSIONE').setStyle(ButtonStyle.Danger).setDisabled(!draft.presentPlayers.length)
  );
}

function buildReportComponents(draft) {
  const components = [];
  if (!draft.matchId) return components;
  if (!draft.presentPlayers.length) components.push(buildPresentSelect(draft));
  components.push(buildReportButtons(draft));
  components.push(buildReportDisciplineButtons(draft));
  return components;
}

function buildStatPlayerSelect(draft, mode) {
  const roster = draft.roster.filter(r => draft.presentPlayers.includes(r.id));
  let customId = 'report_goal_player_select';
  let placeholder = 'Seleziona marcatore';
  if (mode === 'assist') { customId = 'report_assist_player_select'; placeholder = 'Seleziona assistman'; }
  if (mode === 'mvp') { customId = 'report_mvp_player_select'; placeholder = 'Seleziona MVP'; }
  if (mode === 'yellow') { customId = 'report_yellow_player_select'; placeholder = 'Seleziona ammonito'; }
  if (mode === 'red') { customId = 'report_red_player_select'; placeholder = 'Seleziona espulso'; }

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(roster.slice(0, 25).map(r => ({
        label: `${r.platform_id || r.player_registrations?.platform_id || r.discord_tag}`.slice(0, 100),
        value: r.id
      })))
  );
}

function buildCountModal(customId, title, label) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('count')
        .setLabel(label)
        .setPlaceholder('Esempio: 1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );
  return modal;
}

function buildScoreModal() {
  const modal = new ModalBuilder().setCustomId('report_score_modal').setTitle('Risultato');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('goals_for').setLabel('Gol fatti dalla tua squadra').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('goals_against').setLabel('Gol subiti dalla tua squadra').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );
  return modal;
}

function scoreForTeam(match, report) {
  const side = report.draft_team_id === match.home_draft_team_id ? 'home' : 'away';
  if (side === 'home') return { home: report.goals_for, away: report.goals_against };
  return { home: report.goals_against, away: report.goals_for };
}

async function applyReportStats(reportId) {
  const { data: report } = await supabase.from('match_reports').select('*').eq('id', reportId).single();
  if (!report || report.stats_applied) return;

  const { data: stats } = await supabase.from('match_report_player_stats').select('*').eq('report_id', reportId);
  for (const stat of stats || []) {
    const { data: reg } = await supabase.from('player_registrations').select('*').eq('discord_id', stat.discord_id).maybeSingle();
    if (!reg) continue;

    const matchWinPoints = Number(report.goals_for || 0) > Number(report.goals_against || 0)
      ? 3
      : Number(report.goals_for || 0) === Number(report.goals_against || 0)
        ? 1
        : 0;

    const cleanSheetPoints = Number(report.goals_against || 0) === 0 && (reg.primary_role === 'POR') ? 4 : 0;

    const gainedOverall =
      Number(stat.appearance || 0) +
      matchWinPoints +
      (Number(stat.mvp || 0) * 5) +
      (Number(stat.goals || 0) * 2) +
      Number(stat.assists || 0) +
      cleanSheetPoints;

    await supabase.from('player_registrations').update({
      appearances: Number(reg.appearances || 0) + Number(stat.appearance || 0),
      goals: Number(reg.goals || 0) + Number(stat.goals || 0),
      assists: Number(reg.assists || 0) + Number(stat.assists || 0),
      mvp_awards: Number(reg.mvp_awards || 0) + Number(stat.mvp || 0),
      rpci_overall: Number(reg.rpci_overall || reg.overall || 0) + gainedOverall,
      overall: Number(reg.rpci_overall || reg.overall || 0) + gainedOverall,
      updated_at: new Date().toISOString()
    }).eq('id', reg.id);
  }

  await supabase.from('match_reports').update({ stats_applied: true }).eq('id', reportId);
}

async function updateStandings(match, homeGoals, awayGoals) {
  const teams = [
    { id: match.home_draft_team_id, name: match.home_team_name, gf: homeGoals, ga: awayGoals },
    { id: match.away_draft_team_id, name: match.away_team_name, gf: awayGoals, ga: homeGoals }
  ];

  for (const t of teams) {
    const won = t.gf > t.ga ? 1 : 0;
    const draw = t.gf === t.ga ? 1 : 0;
    const lost = t.gf < t.ga ? 1 : 0;
    const points = won * 3 + draw;

    const { data: existing } = await supabase
      .from('competition_standings')
      .select('*')
      .eq('competition_id', match.competition_id)
      .eq('draft_team_id', t.id)
      .maybeSingle();

    if (existing) {
      await supabase.from('competition_standings').update({
        played: Number(existing.played || 0) + 1,
        wins: Number(existing.wins || 0) + won,
        draws: Number(existing.draws || 0) + draw,
        losses: Number(existing.losses || 0) + lost,
        goals_for: Number(existing.goals_for || 0) + t.gf,
        goals_against: Number(existing.goals_against || 0) + t.ga,
        points: Number(existing.points || 0) + points,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      await supabase.from('competition_standings').insert({
        competition_id: match.competition_id,
        draft_team_id: t.id,
        team_name: t.name,
        played: 1,
        wins: won,
        draws: draw,
        losses: lost,
        goals_for: t.gf,
        goals_against: t.ga,
        points
      });
    }
  }
}

async function finalizeMatchIfReady(matchId) {
  const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (!match) return;

  const { data: reports } = await supabase.from('match_reports').select('*').eq('match_id', matchId).eq('status', 'submitted');
  if (!reports || reports.length < 2) return;

  const homeReport = reports.find(r => r.draft_team_id === match.home_draft_team_id);
  const awayReport = reports.find(r => r.draft_team_id === match.away_draft_team_id);
  if (!homeReport || !awayReport) return;

  const s1 = scoreForTeam(match, homeReport);
  const s2 = scoreForTeam(match, awayReport);

  if (s1.home === s2.home && s1.away === s2.away) {
    await applyReportStats(homeReport.id);
    await applyReportStats(awayReport.id);
    await updateStandings(match, s1.home, s1.away);
    await applyDisciplineAfterConfirmed(matchId);
    await decrementSuspensionsForParticipants(matchId);

    await supabase.from('matches').update({
      status: 'confirmed',
      home_goals: s1.home,
      away_goals: s1.away,
      confirmed_at: new Date().toISOString()
    }).eq('id', matchId);

    await closeCompleteReportMessage(match);
    await publishStandingsAndStats(match.competition_id);

    if (s1.home === s1.away && (String(match.round_name || '').toLowerCase().includes('finale') || String(match.round_name || '').toLowerCase().includes('quarti') || String(match.round_name || '').toLowerCase().includes('semi') || String(match.round_name || '').toLowerCase().includes('ottavi'))) {
      const appealCh = await client.channels.fetch(APPEALS_CHANNEL_ID).catch(() => null);
      if (appealCh) {
        await appealCh.send({
          embeds: [new EmbedBuilder().setTitle('⚖️ PAREGGIO COPPA - SUPPLEMENTARI/RIGORI').setColor(0xf1c40f).setDescription(`Partita **${match.home_team_name} vs ${match.away_team_name}** finita in pareggio. Lo staff deve indicare vincitore, supplementari/rigori.`)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ko_winner_${match.id}_${match.home_draft_team_id}`).setLabel(`Vince ${match.home_team_name}`.slice(0,80)).setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`ko_winner_${match.id}_${match.away_draft_team_id}`).setLabel(`Vince ${match.away_team_name}`.slice(0,80)).setStyle(ButtonStyle.Primary)
          )]
        });
      }
    }


    const ch = await client.channels.fetch(MATCH_RESULTS_CHANNEL_ID).catch(() => null);
    if (ch) {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ RISULTATO CONFERMATO')
            .setColor(0x2ecc71)
            .setDescription(`**${match.home_team_name} ${s1.home} - ${s1.away} ${match.away_team_name}**`)
            .addFields(
              { name: 'Stato', value: 'I due referti combaciano.' },
              { name: 'Statistiche', value: 'Presenze, gol, assist, MVP e classifica aggiornati automaticamente.' }
            )
            .setFooter({ text: 'RPCI • Risultati partita' })
            .setTimestamp()
        ]
      });
    }
  } else {
    await supabase.from('matches').update({ status: 'disputed' }).eq('id', matchId);

    await closeCompleteReportMessage(match);

    const ch = await client.channels.fetch(APPEALS_CHANNEL_ID).catch(() => null);
    if (ch) {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ RICORSO REFERTI')
            .setColor(0xe74c3c)
            .setDescription(`I referti di **${match.home_team_name} vs ${match.away_team_name}** non combaciano.`)
            .addFields(
              { name: `Referto ${match.home_team_name}`, value: `${s1.home} - ${s1.away}`, inline: true },
              { name: `Referto ${match.away_team_name}`, value: `${s2.home} - ${s2.away}`, inline: true },
              { name: 'Azione richiesta', value: 'Lo staff deve verificare manualmente.' }
            )
            .setFooter({ text: 'RPCI • Ricorso' })
            .setTimestamp()
        ]
      });
    }
  }
}


async function getDraftTeamCaptain(teamId) {
  const { data } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('id', teamId)
    .maybeSingle();

  return data?.captain_discord_id || null;
}

function getOpponentTeamIdFromMatch(match, teamId) {
  if (match.home_draft_team_id === teamId) return match.away_draft_team_id;
  if (match.away_draft_team_id === teamId) return match.home_draft_team_id;
  return null;
}

function getTeamNameFromMatch(match, teamId) {
  if (match.home_draft_team_id === teamId) return match.home_team_name;
  if (match.away_draft_team_id === teamId) return match.away_team_name;
  return 'Squadra';
}

function buildCompleteReportButton(matchId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`complete_report_${matchId}`)
      .setLabel('COMPLETARE RISULTATO')
      .setStyle(ButtonStyle.Primary)
  );
}

async function sendCompleteReportRequest(interaction, match, submittingTeamId) {
  const opponentTeamId = getOpponentTeamIdFromMatch(match, submittingTeamId);
  if (!opponentTeamId) return null;

  const opponentCaptainId = await getDraftTeamCaptain(opponentTeamId);
  const submittingTeamName = getTeamNameFromMatch(match, submittingTeamId);
  const opponentTeamName = getTeamNameFromMatch(match, opponentTeamId);

  const embed = new EmbedBuilder()
    .setTitle('📝 COMPLETARE RISULTATO')
    .setColor(0xf1c40f)
    .setDescription(
      `La squadra **${submittingTeamName}** ha già compilato il proprio referto.\n\n` +
      `Ora il capitano di **${opponentTeamName}** deve completare il referto della propria squadra.`
    )
    .addFields(
      { name: 'Partita', value: `**${match.home_team_name} vs ${match.away_team_name}**`, inline: false },
      { name: 'Da completare', value: opponentCaptainId ? `<@${opponentCaptainId}>` : 'Capitano non assegnato', inline: true }
    )
    .setFooter({ text: 'RPCI • Referti partita' })
    .setTimestamp();

  const channel = await client.channels.fetch(MATCH_REPORTS_CHANNEL_ID).catch(() => null);
  let publicMessage = null;

  if (channel) {
    publicMessage = await channel.send({
      content: opponentCaptainId ? `<@${opponentCaptainId}>` : undefined,
      embeds: [embed],
      components: [buildCompleteReportButton(match.id)]
    }).catch(() => null);
  }

  if (opponentCaptainId) {
    const user = await client.users.fetch(opponentCaptainId).catch(() => null);
    if (user) {
      await user.send({
        content:
          `📝 Devi completare il referto per la partita **${match.home_team_name} vs ${match.away_team_name}**.\n\n` +
          `Compila solo i dati della tua squadra: presenti, gol, assist e MVP se appartiene alla tua squadra.`,
        embeds: [embed],
        components: [buildCompleteReportButton(match.id)]
      }).catch(() => null);
    }
  }

  await supabase
    .from('matches')
    .update({
      status: 'pending_reports',
      complete_report_message_id: publicMessage?.id || null,
      complete_report_channel_id: publicMessage?.channel?.id || MATCH_REPORTS_CHANNEL_ID
    })
    .eq('id', match.id)
    .catch(() => null);

  return publicMessage;
}

async function closeCompleteReportMessage(match) {
  const channelId = match.complete_report_channel_id || MATCH_REPORTS_CHANNEL_ID;
  const messageId = match.complete_report_message_id;
  if (!messageId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  await message.edit({
    content: '✅ Referto completato e chiuso.',
    components: []
  }).catch(() => null);
}

async function openReportForMatch(interaction, forcedMatchId = null) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member?.roles.cache.has(CAPTAIN_ROLE_ID)) {
    return interaction.reply({ content: '❌ Solo i capitani possono compilare referti.', flags: MessageFlags.Ephemeral });
  }

  const team = await getDraftTeamByCaptain(interaction.user.id);
  if (!team) {
    return interaction.reply({ content: '❌ Non trovo una squadra collegata a te come capitano.', flags: MessageFlags.Ephemeral });
  }

  let match = null;

  if (forcedMatchId) {
    const { data } = await supabase
      .from('matches')
      .select('*, competitions(name, type, season)')
      .eq('id', forcedMatchId)
      .maybeSingle();
    match = data || null;

    if (!match || (match.home_draft_team_id !== team.id && match.away_draft_team_id !== team.id)) {
      return interaction.reply({ content: '❌ Questa partita non appartiene alla tua squadra.', flags: MessageFlags.Ephemeral });
    }

    const { data: existingReport } = await supabase
      .from('match_reports')
      .select('*')
      .eq('match_id', match.id)
      .eq('draft_team_id', team.id)
      .maybeSingle();

    if (existingReport) {
      return interaction.reply({ content: '❌ Hai già compilato il referto per questa partita.', flags: MessageFlags.Ephemeral });
    }
  }

  const roster = await getRosterByDraftTeamId(team.id);
  if (!roster.length) {
    return interaction.reply({ content: '❌ Rosa non trovata per la tua squadra.', flags: MessageFlags.Ephemeral });
  }

  reportDrafts.set(interaction.user.id, {
    team,
    matches: forcedMatchId ? [match] : null,
    matchId: forcedMatchId ? match.id : null,
    match,
    matchLabel: forcedMatchId ? `${match.home_team_name} vs ${match.away_team_name}` : null,
    roster,
    presentPlayers: [],
    scoreSet: false,
    goalsFor: null,
    goalsAgainst: null,
    goals: [],
    assists: [],
    mvpPlayerId: null,
    pendingStatPlayerId: null,
    yellowCards: [],
    redCards: []
  });

  const draft = reportDrafts.get(interaction.user.id);

  if (forcedMatchId) {
    return interaction.reply({
      embeds: [buildReportEmbed(draft)],
      components: buildReportComponents(draft),
      flags: MessageFlags.Ephemeral
    });
  }

  const { matches } = await getCaptainMatches(interaction.user.id);
  if (!matches.length) {
    return interaction.reply({ content: '❌ Non ci sono partite da refertare.', flags: MessageFlags.Ephemeral });
  }

  draft.matches = matches;

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📝 Seleziona partita').setColor(0xd4af37)],
    components: [buildMatchSelect(matches, team.id)],
    flags: MessageFlags.Ephemeral
  });
}

async function submitReport(interaction, draft) {
  const { data: report, error } = await supabase.from('match_reports').upsert({
    match_id: draft.matchId,
    draft_team_id: draft.team.id,
    captain_discord_id: interaction.user.id,
    goals_for: Number(draft.goalsFor),
    goals_against: Number(draft.goalsAgainst),
    status: 'submitted',
    submitted_at: new Date().toISOString()
  }, { onConflict: 'match_id,draft_team_id' }).select().single();

  if (error) throw error;

  await supabase.from('match_report_player_stats').delete().eq('report_id', report.id);

  const rows = draft.presentPlayers.map(assignId => {
    const row = draft.roster.find(r => r.id === assignId);
    const goals = draft.goals.filter(g => g.playerId === assignId).reduce((s, x) => s + Number(x.count), 0);
    const assists = draft.assists.filter(a => a.playerId === assignId).reduce((s, x) => s + Number(x.count), 0);
    return {
      report_id: report.id,
      match_id: draft.matchId,
      draft_assignment_id: assignId,
      discord_id: row.discord_id,
      appearance: 1,
      goals,
      assists,
      mvp: draft.mvpPlayerId === assignId ? 1 : 0
    };
  });

  if (rows.length) await supabase.from('match_report_player_stats').insert(rows);
  await supabase.from('matches').update({ status: 'pending_reports' }).eq('id', draft.matchId).neq('status', 'confirmed');

  await finalizeMatchIfReady(draft.matchId);
}


function getCompetitionWinBonus(comp) {
  if (!comp) return 0;
  if (comp.mode === 'national') return 25;
  if (comp.type === 'league') return 15;
  if (comp.type === 'national_cup') return 10;
  if (comp.type === 'european_cup') return 20;
  return 10;
}

async function findCompetitionByName(name) {
  const { data } = await supabase
    .from('competitions')
    .select('*')
    .ilike('name', name)
    .maybeSingle();

  return data || null;
}

async function findDraftTeamByName(name, mode = null) {
  let query = supabase
    .from('draft_teams')
    .select('*')
    .ilike('name', name);

  const { data } = await query.maybeSingle();
  return data || null;
}

async function addOverallBonusToTeam(teamId, bonus, reason, competitionId = null) {
  const { data: assignments } = await supabase
    .from('draft_assignments')
    .select('*')
    .eq('draft_team_id', teamId);

  for (const row of assignments || []) {
    const { data: reg } = await supabase
      .from('player_registrations')
      .select('*')
      .eq('discord_id', row.discord_id)
      .maybeSingle();

    if (!reg) continue;

    const newOverall = Number(reg.rpci_overall || reg.overall || 0) + Number(bonus || 0);

    await supabase
      .from('player_registrations')
      .update({
        rpci_overall: newOverall,
        overall: newOverall,
        updated_at: new Date().toISOString()
      })
      .eq('id', reg.id);

    await supabase
      .from('player_awards')
      .insert({
        competition_id: competitionId,
        discord_id: row.discord_id,
        award_type: 'team_bonus',
        award_label: reason,
        bonus_points: bonus
      })
      .catch(() => null);
  }
}

async function addOverallBonusToPlayer(discordId, bonus, awardType, label, competitionId = null) {
  const { data: reg } = await supabase
    .from('player_registrations')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();

  if (!reg) return null;

  const newOverall = Number(reg.rpci_overall || reg.overall || 0) + Number(bonus || 0);

  await supabase
    .from('player_registrations')
    .update({
      rpci_overall: newOverall,
      overall: newOverall,
      updated_at: new Date().toISOString()
    })
    .eq('id', reg.id);

  await supabase
    .from('player_awards')
    .insert({
      competition_id: competitionId,
      discord_id: discordId,
      award_type: awardType,
      award_label: label,
      bonus_points: bonus
    })
    .catch(() => null);

  return { ...reg, rpci_overall: newOverall, overall: newOverall };
}

async function getCompetitionTopScorers(competitionId, limit = 10) {
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('competition_id', competitionId);

  const matchIds = (matches || []).map(m => m.id);
  if (!matchIds.length) return [];

  const { data: stats } = await supabase
    .from('match_report_player_stats')
    .select('discord_id, goals')
    .in('match_id', matchIds);

  const totals = {};
  for (const row of stats || []) {
    if (!row.discord_id) continue;
    totals[row.discord_id] = Number(totals[row.discord_id] || 0) + Number(row.goals || 0);
  }

  const ids = Object.keys(totals);
  if (!ids.length) return [];

  const { data: regs } = await supabase
    .from('player_registrations')
    .select('*')
    .in('discord_id', ids);

  return ids
    .map(id => ({
      discord_id: id,
      goals: totals[id],
      player: (regs || []).find(r => r.discord_id === id)
    }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, limit);
}

async function getCompetitionMatchesList(competitionId, limit = 10) {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('competition_id', competitionId)
    .in('status', ['scheduled', 'pending_reports', 'disputed'])
    .order('matchday', { ascending: true })
    .limit(limit);

  return data || [];
}

async function buildPromotionRelegationResult(comp) {
  if (!comp || comp.type !== 'league') {
    throw new Error('Promozioni/retrocessioni disponibili solo per campionati.');
  }

  const promotedCount = Number(comp.settings?.promosse || 0);
  const relegatedCount = Number(comp.settings?.retrocesse || 0);

  const { data: standings } = await supabase
    .from('competition_standings')
    .select('*')
    .eq('competition_id', comp.id)
    .order('points', { ascending: false })
    .order('goals_for', { ascending: false });

  const rows = standings || [];
  const promoted = promotedCount > 0 ? rows.slice(0, promotedCount) : [];
  const relegated = relegatedCount > 0 ? rows.slice(-relegatedCount).reverse() : [];

  await supabase
    .from('competition_movements')
    .delete()
    .eq('competition_id', comp.id)
    .catch(() => null);

  const movementRows = [
    ...promoted.map(r => ({
      competition_id: comp.id,
      draft_team_id: r.draft_team_id,
      team_name: r.team_name,
      movement_type: 'promoted'
    })),
    ...relegated.map(r => ({
      competition_id: comp.id,
      draft_team_id: r.draft_team_id,
      team_name: r.team_name,
      movement_type: 'relegated'
    }))
  ];

  if (movementRows.length) {
    await supabase
      .from('competition_movements')
      .insert(movementRows);
  }

  return { promoted, relegated };
}

async function closeCompetitionAndAward(comp, winnerTeam) {
  const bonus = getCompetitionWinBonus(comp);

  await addOverallBonusToTeam(
    winnerTeam.id,
    bonus,
    `Vittoria ${competitionTypeLabel(comp.type)}: ${comp.name}`,
    comp.id
  );

  await supabase
    .from('competitions')
    .update({
      status: 'closed',
      winner_team_id: winnerTeam.id,
      winner_team_name: winnerTeam.name,
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', comp.id);

  await addHallOfFameEntry(`${competitionTypeLabel(comp.type)} ${comp.name}`, comp.mode || 'club', winnerTeam.name, comp.id);

  return bonus;
}



function isRpcStaffMember(member) {
  if (!member) return false;
  if (isStaff(member)) return true;
  return STAFF_ROLE_IDS.some(roleId => member.roles.cache.has(roleId));
}

async function getTeamsByTypeForCaptainAssignment(teamType) {
  const { data, error } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('team_type', teamType)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

function buildCaptainAssignTeamSelect(draft) {
  const page = draft.page || 0;
  const teams = draft.teams || [];
  const pageTeams = teams.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('captain_assign_team_select')
      .setPlaceholder(draft.teamType === 'national' ? 'Seleziona nazionale' : 'Seleziona club')
      .addOptions(pageTeams.map(team => ({
        label: team.name.slice(0, 100),
        description: team.captain_discord_tag ? `Capitano attuale: ${team.captain_discord_tag}` : 'Nessun capitano assegnato',
        value: team.id
      })))
  );
}

function buildCaptainAssignPagination(draft) {
  const totalPages = Math.max(1, Math.ceil((draft.teams || []).length / PER_PAGE));

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('captain_assign_prev')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.page || 0) <= 0),
    new ButtonBuilder()
      .setCustomId('captain_assign_next')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.page || 0) >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('captain_assign_cancel')
      .setLabel('ANNULLA')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildCaptainAssignPlayerSelect(draft) {
  const players = draft.players || [];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('captain_assign_player_select')
      .setPlaceholder('Seleziona player da nominare capitano')
      .addOptions(players.slice(0, 25).map(row => ({
        label: `${row.platform_id || row.discord_tag || row.discord_id}`.slice(0, 100),
        description: `${row.primary_role || 'Ruolo N/D'} • ${row.discord_tag || row.discord_id}`.slice(0, 100),
        value: row.discord_id
      })))
  );
}

function buildCaptainAssignEmbed(draft) {
  return new EmbedBuilder()
    .setTitle(draft.teamType === 'national' ? '🌍 Assegna Capitano Nazionale' : '👑 Assegna Capitano Club')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Tipo', value: draft.teamType === 'national' ? 'Nazionale' : 'Club', inline: true },
      { name: 'Squadra selezionata', value: draft.selectedTeam?.name || 'Non selezionata', inline: true },
      { name: 'Player disponibili', value: draft.players ? String(draft.players.length) : 'Da caricare', inline: true }
    )
    .setFooter({ text: 'RPCI • Gestione capitani staff' })
    .setTimestamp();
}

async function startCaptainAssignment(interaction, teamType) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!isRpcStaffMember(member)) {
    return interaction.reply({
      content: '❌ Solo lo staff autorizzato può assegnare capitani.',
      flags: MessageFlags.Ephemeral
    });
  }

  const teams = await getTeamsByTypeForCaptainAssignment(teamType);

  if (!teams.length) {
    return interaction.reply({
      content: teamType === 'national'
        ? '❌ Non ci sono nazionali disponibili.'
        : '❌ Non ci sono club disponibili.',
      flags: MessageFlags.Ephemeral
    });
  }

  captainAssignDrafts.set(interaction.user.id, {
    teamType,
    teams,
    page: 0,
    selectedTeam: null,
    players: null
  });

  const draft = captainAssignDrafts.get(interaction.user.id);

  return interaction.reply({
    embeds: [buildCaptainAssignEmbed(draft)],
    components: [
      buildCaptainAssignTeamSelect(draft),
      buildCaptainAssignPagination(draft)
    ],
    flags: MessageFlags.Ephemeral
  });
}

async function getCaptainAssignablePlayers(teamId) {
  const { data, error } = await supabase
    .from('draft_assignments')
    .select('*, player_registrations(*)')
    .eq('draft_team_id', teamId)
    .order('pick_number', { ascending: true });

  if (error) throw error;

  return (data || []).map(row => ({
    ...row,
    platform_id: row.platform_id || row.player_registrations?.platform_id || null,
    primary_role: row.primary_role || row.player_registrations?.primary_role || null,
    discord_tag: row.discord_tag || row.player_registrations?.discord_tag || null
  }));
}

async function assignCaptainToTeam(guild, team, newCaptainDiscordId) {
  if (team.captain_discord_id && team.captain_discord_id !== newCaptainDiscordId) {
    const oldMember = await guild.members.fetch(team.captain_discord_id).catch(() => null);
    if (oldMember) {
      await oldMember.roles.remove(CAPTAIN_ROLE_ID).catch(() => null);
    }
  }

  const newMember = await guild.members.fetch(newCaptainDiscordId).catch(() => null);
  if (!newMember) {
    throw new Error('Il player scelto non è presente nel server.');
  }

  await newMember.roles.add(CAPTAIN_ROLE_ID);

  await supabase
    .from('draft_teams')
    .update({
      captain_discord_id: newCaptainDiscordId,
      captain_discord_tag: newMember.user.tag,
      updated_at: new Date().toISOString()
    })
    .eq('id', team.id);

  return newMember;
}



function getTierFromOverall(overall) {
  return getEconomyTierFromOverall(overall);
}

function getSalaryFromOverall(overall) {
  return getEconomySalaryFromOverall(overall);
}

async function setMarketOpen(open) {
  await supabase.from('bot_settings').upsert({
    key: 'club_market_open',
    value: { open },
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
}

async function isMarketOpen() {
  const { data } = await supabase.from('bot_settings').select('value').eq('key', 'club_market_open').maybeSingle();
  return data?.value?.open === true;
}

async function ensureClubBudget(team) {
  const { data: existing } = await supabase
    .from('club_budgets')
    .select('*')
    .eq('draft_team_id', team.id)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase.from('club_budgets').insert({
    draft_team_id: team.id,
    team_name: team.name,
    season_budget: ECONOMY_BASE_CLUB_BUDGET,
    bonus_budget: 0
  }).select().single();

  if (error) throw error;
  return data;
}

async function getClubBudgetInfo(team) {
  const budget = await ensureClubBudget(team);

  const { data: contracts } = await supabase
    .from('player_contracts')
    .select('*')
    .eq('draft_team_id', team.id)
    .eq('status', 'active');

  const spent = (contracts || []).reduce((sum, c) => sum + (Number(c.salary || 0) * Number(c.years_remaining || 1)), 0);
  const total = Number(budget.season_budget || 0) + Number(budget.bonus_budget || 0);
  return { budget, total, spent, remaining: total - spent };
}

async function initializeOneYearContractsForClubDraft() {
  const { data: assignments } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams!inner(team_type, name), player_registrations(*)')
    .eq('draft_teams.team_type', 'club');

  let created = 0;

  for (const row of assignments || []) {
    const { data: existing } = await supabase
      .from('player_contracts')
      .select('*')
      .eq('discord_id', row.discord_id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) continue;

    const overall = row.player_registrations?.rpci_overall || row.player_registrations?.overall || 0;
    const tier = getTierFromOverall(overall);
    const salary = getSalaryFromOverall(overall);

    await supabase.from('player_contracts').insert({
      draft_team_id: row.draft_team_id,
      team_name: row.draft_teams?.name || 'Club',
      discord_id: row.discord_id,
      player_registration_id: row.player_registration_id,
      years_total: 1,
      years_remaining: 1,
      salary,
      tier,
      status: 'active',
      signed_at: new Date().toISOString()
    });

    created += 1;
  }

  return created;
}

function buildFreeAgentPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🆓 FREE AGENT RPCI')
    .setColor(0x2ecc71)
    .setDescription(
      'Se non fai parte di nessun club puoi candidarti come giocatore Free Agent.\n\n' +
      'Premi il pulsante qui sotto e compila i dati richiesti.\n\n' +
      'I capitani potranno contattarti e, se trovate un accordo, depositare il contratto.'
    )
    .setFooter({ text: 'RPCI • Mercato Free Agent' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('free_agent_apply_start')
    .setLabel('CANDIDATI COME GIOCATORE')
    .setStyle(ButtonStyle.Success);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] };
}

function buildFreeAgentRoleSelect(prefix, secondary = false, primaryRole = null) {
  const options = secondary
    ? [{ label: 'NESSUNO', value: 'NO', description: 'Nessun ruolo secondario' }, ...GAME_ROLES.filter(r => r !== primaryRole).map(r => ({ label: `${r} - ${ROLE_LABELS[r]}`, value: r }))]
    : GAME_ROLES.map(r => ({ label: `${r} - ${ROLE_LABELS[r]}`, value: r }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(prefix)
      .setPlaceholder(secondary ? 'Seleziona secondo ruolo oppure NESSUNO' : 'Seleziona primo ruolo')
      .addOptions(options)
  );
}

function buildFreeAgentEmbed(profile) {
  return new EmbedBuilder()
    .setTitle('🆓 NUOVO FREE AGENT')
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Player', value: `<@${profile.discord_id}>`, inline: true },
      { name: 'Nome', value: profile.name || 'N/D', inline: true },
      { name: 'Età', value: String(profile.age || 'N/D'), inline: true },
      { name: 'Console', value: profile.platform || 'N/D', inline: true },
      { name: 'ID Console', value: profile.platform_id || 'N/D', inline: true },
      { name: 'Ruolo 1', value: profile.primary_role || 'N/D', inline: true },
      { name: 'Ruolo 2', value: profile.secondary_role && profile.secondary_role !== 'NO' ? profile.secondary_role : 'NESSUNO', inline: true },
      { name: 'Overall RPCI', value: String(profile.rpci_overall || 0), inline: true }
    )
    .setFooter({ text: 'RPCI • Free Agent' })
    .setTimestamp();
}

function buildFreeAgentButtons(profileId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fa_contact_forum_${profileId}`)
      .setLabel('PRENDI CONTATTI')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`fa_agreement_${profileId}`)
      .setLabel('ACCORDO TROVATO')
      .setStyle(ButtonStyle.Success)
  );
}

async function publishFreeAgent(profile) {
  const channel = await client.channels.fetch(FREE_AGENT_CHANNEL_ID).catch(() => null);
  if (!channel) return null;

  const message = await channel.send({
    embeds: [buildFreeAgentEmbed(profile)],
    components: [buildFreeAgentButtons(profile.id)]
  });

  await supabase.from('free_agent_profiles').update({
    message_id: message.id,
    channel_id: channel.id
  }).eq('id', profile.id);

  return message;
}

async function playerHasActiveClub(discordId) {
  const { data } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams!inner(team_type)')
    .eq('discord_id', discordId)
    .eq('draft_teams.team_type', 'club')
    .maybeSingle();

  const { data: contract } = await supabase
    .from('player_contracts')
    .select('*')
    .eq('discord_id', discordId)
    .eq('status', 'active')
    .maybeSingle();

  return Boolean(data && contract);
}

async function captainCanUseMarket(discordId) {
  const marketOpen = await isMarketOpen();
  if (!marketOpen) return { ok: false, reason: 'Mercato chiuso.' };
  const team = await getDraftTeamByCaptain(discordId);
  if (!team || team.team_type !== 'club') return { ok: false, reason: 'Devi essere capitano di un club.' };
  return { ok: true, team };
}

async function createFreeAgentForumThread(interaction, profile, captainTeam) {
  const channel = await client.channels.fetch(FREE_AGENT_CHANNEL_ID).catch(() => null);
  if (!channel || !channel.threads) return null;

  const thread = await channel.threads.create({
    name: `Trattativa ${captainTeam.name} - ${profile.platform_id || profile.name}`,
    autoArchiveDuration: 1440,
    reason: 'Trattativa Free Agent RPCI'
  }).catch(() => null);

  if (thread) {
    await thread.send(
      `🤝 **TRATTATIVA FREE AGENT**\n\n` +
      `Club: **${captainTeam.name}**\n` +
      `Capitano: <@${interaction.user.id}>\n` +
      `Player: <@${profile.discord_id}>\n` +
      `ID Console: **${profile.platform_id || 'N/D'}**\n\n` +
      `Usate questo thread/forum per parlare e trovare un accordo.`
    ).catch(() => null);
  }

  return thread;
}

function buildAgreementYearsModal(profileId) {
  const modal = new ModalBuilder()
    .setCustomId(`fa_agreement_years_modal_${profileId}`)
    .setTitle('Accordo Free Agent');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('years')
        .setLabel('ANNI CONTRATTO')
        .setPlaceholder('Scrivi 1, 2 oppure 3')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}


async function archiveSignedFreeAgent(profile, teamName, years, salary, tier) {
  const archiveChannel = await client.channels.fetch(FREE_AGENT_ARCHIVE_CHANNEL_ID).catch(() => null);

  const archiveEmbed = new EmbedBuilder()
    .setTitle('📦 FREE AGENT ARCHIVIATO')
    .setColor(0x2ecc71)
    .setDescription('Il giocatore ha trovato un accordo ed è stato rimosso dalla lista Free Agent attivi.')
    .addFields(
      { name: 'Player', value: `<@${profile.discord_id}>`, inline: true },
      { name: 'Nome', value: profile.name || 'N/D', inline: true },
      { name: 'ID Console', value: profile.platform_id || 'N/D', inline: true },
      { name: 'Nuovo Club', value: teamName, inline: true },
      { name: 'Contratto', value: `${years} stagione/i`, inline: true },
      { name: 'Stipendio', value: `${salary} crediti/stagione`, inline: true },
      { name: 'Fascia', value: tier, inline: true },
      { name: 'Ruolo 1', value: profile.primary_role || 'N/D', inline: true },
      { name: 'Ruolo 2', value: profile.secondary_role && profile.secondary_role !== 'NO' ? profile.secondary_role : 'NESSUNO', inline: true }
    )
    .setFooter({ text: 'RPCI • Archivio Free Agent' })
    .setTimestamp();

  if (archiveChannel) {
    await archiveChannel.send({ embeds: [archiveEmbed] }).catch(() => null);
  }

  if (profile.channel_id && profile.message_id) {
    const originalChannel = await client.channels.fetch(profile.channel_id).catch(() => null);
    const originalMessage = await originalChannel?.messages.fetch(profile.message_id).catch(() => null);

    if (originalMessage) {
      const closedEmbed = new EmbedBuilder()
        .setTitle('✅ GIOCATORE INGAGGIATO')
        .setColor(0x95a5a6)
        .setDescription('Questo Free Agent ha firmato con un club. La candidatura non è più disponibile.')
        .addFields(
          { name: 'Player', value: `<@${profile.discord_id}>`, inline: true },
          { name: 'Nome', value: profile.name || 'N/D', inline: true },
          { name: 'ID Console', value: profile.platform_id || 'N/D', inline: true },
          { name: 'Nuovo Club', value: teamName, inline: true },
          { name: 'Contratto', value: `${years} stagione/i`, inline: true },
          { name: 'Stipendio', value: `${salary} crediti/stagione`, inline: true }
        )
        .setFooter({ text: 'RPCI • Free Agent chiuso' })
        .setTimestamp();

      await originalMessage.edit({
        embeds: [closedEmbed],
        components: []
      }).catch(() => null);
    }
  }
}


async function completeFreeAgentAgreement(interaction, profileId, years) {
  const market = await captainCanUseMarket(interaction.user.id);
  if (!market.ok) {
    return interaction.reply({ content: `❌ ${market.reason}`, flags: MessageFlags.Ephemeral });
  }

  const { data: profile } = await supabase
    .from('free_agent_profiles')
    .select('*')
    .eq('id', profileId)
    .maybeSingle();

  if (!profile || profile.status !== 'open') {
    return interaction.reply({ content: '❌ Free agent non disponibile.', flags: MessageFlags.Ephemeral });
  }

  const salary = getSalaryFromOverall(profile.rpci_overall || 0);
  const tier = getTierFromOverall(profile.rpci_overall || 0);
  const budget = await getClubBudgetInfo(market.team);
  const totalCost = salary * years;

  if (budget.remaining < totalCost) {
    return interaction.reply({
      content: `❌ Budget insufficiente. Costo contratto: **${totalCost}** • Budget residuo: **${budget.remaining}**.`,
      flags: MessageFlags.Ephemeral
    });
  }

  await supabase.from('draft_assignments').insert({
    draft_team_id: market.team.id,
    player_registration_id: profile.player_registration_id || null,
    discord_id: profile.discord_id,
    discord_tag: profile.discord_tag,
    primary_role: profile.primary_role,
    platform_id: profile.platform_id,
    pick_number: 9999
  });

  await supabase.from('player_contracts').insert({
    draft_team_id: market.team.id,
    team_name: market.team.name,
    discord_id: profile.discord_id,
    player_registration_id: profile.player_registration_id || null,
    years_total: years,
    years_remaining: years,
    salary,
    tier,
    status: 'active',
    signed_at: new Date().toISOString()
  });

  await supabase.from('free_agent_profiles').update({
    status: 'signed',
    signed_team_id: market.team.id,
    signed_team_name: market.team.name,
    signed_at: new Date().toISOString()
  }).eq('id', profile.id);

  await archiveSignedFreeAgent(profile, market.team.name, years, salary, tier);

  const guild = interaction.guild || client.guilds.cache.get(process.env.GUILD_ID);
  const member = await guild?.members.fetch(profile.discord_id).catch(() => null);
  if (member) {
    await member.roles.remove(FREE_AGENT_ROLE_ID).catch(() => null);
    await member.roles.add(PLAYER_ROLE_ID).catch(() => null);
  }

  const ch = await client.channels.fetch(CONTRACT_DEPOSIT_CHANNEL_ID).catch(() => null);
  if (ch) {
    await ch.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('📄 CONTRATTO DEPOSITATO')
          .setColor(0xd4af37)
          .addFields(
            { name: 'Club', value: market.team.name, inline: true },
            { name: 'Player', value: `<@${profile.discord_id}>`, inline: true },
            { name: 'ID Console', value: profile.platform_id || 'N/D', inline: true },
            { name: 'Contratto', value: `${years} stagione/i`, inline: true },
            { name: 'Stipendio', value: `${salary} crediti/stagione`, inline: true },
            { name: 'Fascia', value: tier, inline: true }
          )
          .setFooter({ text: 'RPCI • Deposito contratto' })
          .setTimestamp()
      ]
    });
  }

  return interaction.reply({
    content: `✅ Accordo completato. <@${profile.discord_id}> è ora un player di **${market.team.name}** per **${years} stagione/i**.`,
    flags: MessageFlags.Ephemeral
  });
}

async function makePlayerFreeAgentFromContract(contract, reason = 'Contratto scaduto o rescisso') {
  const { data: reg } = await supabase
    .from('player_registrations')
    .select('*')
    .eq('discord_id', contract.discord_id)
    .maybeSingle();

  await supabase.from('player_contracts').update({
    status: 'expired',
    years_remaining: 0,
    ended_at: new Date().toISOString()
  }).eq('id', contract.id);

  await supabase.from('draft_assignments')
    .delete()
    .eq('discord_id', contract.discord_id)
    .eq('draft_team_id', contract.draft_team_id);

  const { data: profile } = await supabase.from('free_agent_profiles').insert({
    discord_id: contract.discord_id,
    discord_tag: reg?.discord_tag || null,
    player_registration_id: reg?.id || null,
    name: reg?.name || 'Player',
    age: reg?.age || null,
    platform: reg?.platform || null,
    platform_id: reg?.platform_id || null,
    primary_role: reg?.primary_role || null,
    secondary_role: reg?.secondary_role || 'NO',
    rpci_overall: reg?.rpci_overall || reg?.overall || 0,
    status: 'open',
    reason
  }).select().single();

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  const member = await guild?.members.fetch(contract.discord_id).catch(() => null);
  if (member) {
    await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => null);
  }

  if (profile) await publishFreeAgent(profile);
  return profile;
}

async function processSeasonEnd(interaction) {
  const { data: contracts } = await supabase
    .from('player_contracts')
    .select('*')
    .eq('status', 'active');

  let scaled = 0;
  let expired = 0;

  for (const contract of contracts || []) {
    const remaining = Number(contract.years_remaining || 0);

    if (remaining > 1) {
      await supabase.from('player_contracts').update({
        years_remaining: remaining - 1,
        updated_at: new Date().toISOString()
      }).eq('id', contract.id);
      scaled += 1;
    } else {
      const user = await client.users.fetch(contract.discord_id).catch(() => null);
      if (user) {
        const button = new ButtonBuilder()
          .setCustomId(`contract_rescind_${contract.id}`)
          .setLabel('RESCINDI CONTRATTO')
          .setStyle(ButtonStyle.Danger);

        await user.send({
          content:
            `📄 Il tuo contratto con **${contract.team_name}** è arrivato a scadenza.\n\n` +
            `Puoi rescindere e diventare Free Agent premendo il pulsante qui sotto.`,
          components: [new ActionRowBuilder().addComponents(button)]
        }).catch(() => null);
      }

      await makePlayerFreeAgentFromContract(contract, 'Contratto arrivato a scadenza');
      expired += 1;
    }
  }

  return { scaled, expired };
}


function buildCaptainElectionPanel() {
  const embed = new EmbedBuilder()
    .setTitle('👑 CANDIDATURE CAPITANO / CT RPCI')
    .setColor(0xd4af37)
    .setDescription(
      'Vuoi candidarti come capitano del tuo club o CT della tua nazionale?\n\n' +
      'Premi il pulsante qui sotto. Il bot controllerà automaticamente la tua squadra/nazionale e pubblicherà la candidatura.\n\n' +
      'Potranno votare solo i player appartenenti alla stessa squadra/nazionale.'
    )
    .setFooter({ text: 'RPCI • Elezioni Capitani' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('captain_candidate_apply')
      .setLabel('CANDIDATI CAPITANO')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

async function findAllTeamsForPlayer(discordId) {
  const { data } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams(*)')
    .eq('discord_id', discordId);

  return (data || []).filter(row => row.draft_teams);
}

function buildCaptainElectionTeamSelect(rows) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('captain_election_team_select')
      .setPlaceholder('Scegli per quale squadra candidarti')
      .addOptions(rows.slice(0, 25).map(row => ({
        label: row.draft_teams.name.slice(0, 100),
        description: row.draft_teams.team_type === 'national' ? 'Nazionale' : 'Club',
        value: row.draft_teams.id
      })))
  );
}

async function publishCaptainCandidate(interaction, teamId) {
  const { data: assignment } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams(*), player_registrations(*)')
    .eq('discord_id', interaction.user.id)
    .eq('draft_team_id', teamId)
    .maybeSingle();

  if (!assignment || !assignment.draft_teams) {
    return interaction.reply({ content: '❌ Non appartieni a questa squadra.', flags: MessageFlags.Ephemeral });
  }

  const { data: existing } = await supabase
    .from('captain_elections')
    .select('*')
    .eq('team_id', teamId)
    .eq('candidate_discord_id', interaction.user.id)
    .eq('status', 'open')
    .maybeSingle();

  if (existing) {
    return interaction.reply({ content: '❌ Hai già una candidatura aperta per questa squadra.', flags: MessageFlags.Ephemeral });
  }

  const { data: election, error } = await supabase
    .from('captain_elections')
    .insert({
      team_id: teamId,
      team_name: assignment.draft_teams.name,
      team_type: assignment.draft_teams.team_type || 'club',
      candidate_discord_id: interaction.user.id,
      candidate_discord_tag: interaction.user.tag,
      status: 'open'
    })
    .select()
    .single();

  if (error) throw error;

  const embed = new EmbedBuilder()
    .setTitle(assignment.draft_teams.team_type === 'national' ? '🌍 CANDIDATURA CT NAZIONALE' : '👑 CANDIDATURA CAPITANO CLUB')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Candidato', value: `<@${interaction.user.id}>`, inline: true },
      { name: 'Squadra', value: assignment.draft_teams.name, inline: true },
      { name: 'Tipo', value: assignment.draft_teams.team_type === 'national' ? 'Nazionale' : 'Club', inline: true },
      { name: 'ID Console', value: assignment.platform_id || assignment.player_registrations?.platform_id || 'N/D', inline: true },
      { name: 'Ruolo', value: assignment.primary_role || assignment.player_registrations?.primary_role || 'N/D', inline: true }
    )
    .setFooter({ text: 'Votano solo i player appartenenti alla stessa squadra/nazionale' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`captain_vote_yes_${election.id}`).setLabel('VOTA SI').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`captain_vote_no_${election.id}`).setLabel('VOTA NO').setStyle(ButtonStyle.Danger)
  );

  const channel = await client.channels.fetch(CAPTAIN_ELECTION_CANDIDATES_CHANNEL_ID).catch(() => null);
  const msg = await channel?.send({ embeds: [embed], components: [row] }).catch(() => null);

  if (msg) {
    await supabase.from('captain_elections').update({
      message_id: msg.id,
      channel_id: msg.channel.id
    }).eq('id', election.id);
  }

  return interaction.reply({ content: '✅ Candidatura pubblicata.', flags: MessageFlags.Ephemeral });
}

async function handleCaptainVote(interaction, electionId, vote) {
  const { data: election } = await supabase
    .from('captain_elections')
    .select('*')
    .eq('id', electionId)
    .maybeSingle();

  if (!election || election.status !== 'open') {
    return interaction.reply({ content: '❌ Votazione non disponibile.', flags: MessageFlags.Ephemeral });
  }

  const { data: assignment } = await supabase
    .from('draft_assignments')
    .select('*')
    .eq('draft_team_id', election.team_id)
    .eq('discord_id', interaction.user.id)
    .maybeSingle();

  if (!assignment) {
    return interaction.reply({ content: '❌ Puoi votare solo per candidati della tua squadra/nazionale.', flags: MessageFlags.Ephemeral });
  }

  await supabase.from('captain_votes').upsert({
    election_id: electionId,
    voter_discord_id: interaction.user.id,
    vote,
    voted_at: new Date().toISOString()
  }, { onConflict: 'election_id,voter_discord_id' });

  return interaction.reply({ content: `✅ Voto registrato: **${vote === 'yes' ? 'SI' : 'NO'}**.`, flags: MessageFlags.Ephemeral });
}

async function closeCaptainElectionsAndAssign(guild) {
  const { data: elections } = await supabase
    .from('captain_elections')
    .select('*')
    .eq('status', 'open');

  let assigned = 0;

  for (const election of elections || []) {
    const { data: votes } = await supabase
      .from('captain_votes')
      .select('*')
      .eq('election_id', election.id);

    const yes = (votes || []).filter(v => v.vote === 'yes').length;
    const no = (votes || []).filter(v => v.vote === 'no').length;

    if (yes > no) {
      const { data: team } = await supabase.from('draft_teams').select('*').eq('id', election.team_id).maybeSingle();
      if (team) {
        await assignCaptainToTeam(guild, team, election.candidate_discord_id);
        assigned += 1;
      }
    }

    await supabase.from('captain_elections').update({
      status: 'closed',
      yes_votes: yes,
      no_votes: no,
      closed_at: new Date().toISOString()
    }).eq('id', election.id);

    if (election.channel_id && election.message_id) {
      const ch = await client.channels.fetch(election.channel_id).catch(() => null);
      const msg = await ch?.messages.fetch(election.message_id).catch(() => null);
      if (msg) {
        await msg.edit({ components: [] }).catch(() => null);
      }
    }
  }

  return assigned;
}

function buildTransferTeamSelect(teams) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('transfer_target_team_select')
      .setPlaceholder('Scegli club proprietario del player')
      .addOptions(teams.slice(0, 25).map(t => ({
        label: t.name.slice(0, 100),
        description: t.captain_discord_tag ? `Capitano: ${t.captain_discord_tag}` : 'Club',
        value: t.id
      })))
  );
}

function buildTransferPlayerSelect(players) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('transfer_target_player_select')
      .setPlaceholder('Scegli player da trattare')
      .addOptions(players.slice(0, 25).map(p => ({
        label: `${p.platform_id || p.discord_tag || p.discord_id}`.slice(0, 100),
        description: `${p.primary_role || 'Ruolo'} • ${p.discord_tag || p.discord_id}`.slice(0, 100),
        value: p.discord_id
      })))
  );
}

async function startClubTransfer(interaction) {
  const market = await captainCanUseMarket(interaction.user.id);
  if (!market.ok) return interaction.reply({ content: `❌ ${market.reason}`, flags: MessageFlags.Ephemeral });

  const { data: teams } = await supabase
    .from('draft_teams')
    .select('*')
    .eq('team_type', 'club')
    .neq('id', market.team.id)
    .order('name', { ascending: true });

  if (!teams || !teams.length) return interaction.reply({ content: '❌ Nessun club disponibile.', flags: MessageFlags.Ephemeral });

  transferDrafts.set(interaction.user.id, { buyerTeam: market.team, teams, sellerTeam: null, players: null, targetPlayer: null });

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('🤝 Richiesta Trattativa Club').setColor(0xd4af37).setDescription('Scegli il club proprietario del player.')],
    components: [buildTransferTeamSelect(teams)],
    flags: MessageFlags.Ephemeral
  });
}

async function openTransferThread(interaction, draft) {
  const sellerCaptainId = draft.sellerTeam.captain_discord_id;
  const channel = await client.channels.fetch(TRANSFER_REQUESTS_CHANNEL_ID).catch(() => null);
  let thread = null;

  if (channel?.threads) {
    thread = await channel.threads.create({
      name: `Trattativa ${draft.buyerTeam.name}-${draft.sellerTeam.name}`,
      autoArchiveDuration: 1440,
      reason: 'Trattativa club RPCI'
    }).catch(() => null);
  }

  const { data: contract } = await supabase
    .from('player_contracts')
    .select('*')
    .eq('discord_id', draft.targetPlayer.discord_id)
    .eq('status', 'active')
    .maybeSingle();

  const embed = new EmbedBuilder()
    .setTitle('🤝 RICHIESTA TRATTATIVA')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Club interessato', value: draft.buyerTeam.name, inline: true },
      { name: 'Club proprietario', value: draft.sellerTeam.name, inline: true },
      { name: 'Player', value: `<@${draft.targetPlayer.discord_id}>`, inline: true },
      { name: 'ID Console', value: draft.targetPlayer.platform_id || 'N/D', inline: true },
      { name: 'Contratto rimanente', value: contract ? `${contract.years_remaining} stagione/i` : 'N/D', inline: true }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`transfer_accept_${draft.buyerTeam.id}_${draft.sellerTeam.id}_${draft.targetPlayer.discord_id}`).setLabel('ACCETTA TRATTATIVA').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`transfer_reject_${draft.buyerTeam.id}_${draft.sellerTeam.id}_${draft.targetPlayer.discord_id}`).setLabel('RIFIUTA TRATTATIVA').setStyle(ButtonStyle.Danger)
  );

  if (thread) {
    await thread.send({
      content: sellerCaptainId ? `<@${sellerCaptainId}>` : undefined,
      embeds: [embed],
      components: [row]
    });
  } else if (channel) {
    await channel.send({
      content: sellerCaptainId ? `<@${sellerCaptainId}>` : undefined,
      embeds: [embed],
      components: [row]
    });
  }

  return thread;
}

function buildRenewalPlayerSelect(players) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('renewal_player_select')
      .setPlaceholder('Scegli player da rinnovare')
      .addOptions(players.slice(0, 25).map(c => ({
        label: `${c.platform_id || c.discord_id}`.slice(0, 100),
        description: `${c.years_remaining} stagione/i rimaste • ${c.salary} crediti`,
        value: c.discord_id
      })))
  );
}

function buildRenewalYearsModal(discordId) {
  const modal = new ModalBuilder().setCustomId(`renewal_years_modal_${discordId}`).setTitle('Proposta rinnovo');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('years').setLabel('ANNI RINNOVO').setPlaceholder('1, 2 oppure 3').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );
  return modal;
}

async function startRenewal(interaction) {
  const market = await captainCanUseMarket(interaction.user.id);
  if (!market.ok) return interaction.reply({ content: `❌ ${market.reason}`, flags: MessageFlags.Ephemeral });

  const { data: contracts } = await supabase
    .from('player_contracts')
    .select('*')
    .eq('draft_team_id', market.team.id)
    .eq('status', 'active')
    .order('years_remaining', { ascending: true });

  if (!contracts || !contracts.length) return interaction.reply({ content: '❌ Nessun contratto attivo.', flags: MessageFlags.Ephemeral });

  renewalDrafts.set(interaction.user.id, { team: market.team, contracts });

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📄 Proponi Rinnovo').setColor(0xd4af37).setDescription('Scegli il player da rinnovare.')],
    components: [buildRenewalPlayerSelect(contracts)],
    flags: MessageFlags.Ephemeral
  });
}

async function sendRenewalOffer(interaction, targetDiscordId, years) {
  const draft = renewalDrafts.get(interaction.user.id);
  if (!draft) return interaction.reply({ content: '❌ Rinnovo non trovato.', flags: MessageFlags.Ephemeral });

  const contract = draft.contracts.find(c => c.discord_id === targetDiscordId);
  if (!contract) return interaction.reply({ content: '❌ Contratto non valido.', flags: MessageFlags.Ephemeral });

  const salary = getSalaryFromOverall(contract.rpci_overall || 0) || contract.salary;
  const user = await client.users.fetch(targetDiscordId).catch(() => null);
  if (!user) return interaction.reply({ content: '❌ Player non trovato.', flags: MessageFlags.Ephemeral });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`renewal_accept_${contract.id}_${years}`).setLabel('ACCETTA RINNOVO').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`renewal_reject_${contract.id}`).setLabel('RIFIUTA').setStyle(ButtonStyle.Danger)
  );

  await user.send({
    embeds: [
      new EmbedBuilder()
        .setTitle('📄 PROPOSTA RINNOVO CONTRATTO')
        .setColor(0xd4af37)
        .addFields(
          { name: 'Club', value: draft.team.name, inline: true },
          { name: 'Durata proposta', value: `${years} stagione/i`, inline: true },
          { name: 'Stipendio stimato', value: `${salary} crediti/stagione`, inline: true }
        )
        .setTimestamp()
    ],
    components: [row]
  });

  renewalDrafts.delete(interaction.user.id);
  return interaction.reply({ content: `✅ Proposta rinnovo inviata a <@${targetDiscordId}>.`, flags: MessageFlags.Ephemeral });
}

async function addHallOfFameEntry(label, category, winnerName, competitionId = null) {
  await supabase.from('hall_of_fame').insert({
    label,
    category,
    winner_name: winnerName,
    competition_id: competitionId
  }).catch(() => null);
}


function buildStaffPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('🛠️ PANNELLO STAFF RPCI')
        .setColor(0xd4af37)
        .setDescription('Gestione rapida bot RPCI. Usa i pulsanti per le azioni principali.')
        .setFooter({ text: 'RPCI • Staff Panel' })
        .setTimestamp()
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('staff_open_market').setLabel('Apri Mercato').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('staff_close_market').setLabel('Chiudi Mercato').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('staff_open_reg').setLabel('Apri Iscrizioni').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('staff_close_reg').setLabel('Chiudi Iscrizioni').setStyle(ButtonStyle.Danger)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('staff_elections_start').setLabel('Avvia Elezioni').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('staff_elections_close').setLabel('Chiudi Elezioni').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('staff_season_end').setLabel('Termina Stagione').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('staff_backup').setLabel('Backup').setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('staff_publish_fa').setLabel('Pannello Free Agent').setStyle(ButtonStyle.Primary)
      )
    ]
  };
}

async function getOpenCompetitionsWithoutCalendar() {
  const { data } = await supabase
    .from('competitions')
    .select('*')
    .in('status', ['setup'])
    .order('created_at', { ascending: false });

  const result = [];
  for (const comp of data || []) {
    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', comp.id);
    if (!count) result.push(comp);
  }
  return result;
}

function buildAdvancedCalendarCompSelect(comps) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('adv_calendar_comp_select')
      .setPlaceholder('Scegli competizione senza calendario')
      .addOptions(comps.slice(0, 25).map(c => ({
        label: `${c.name} • ${competitionTypeLabel(c.type)}`.slice(0, 100),
        description: `${competitionModeLabel(c.mode)} • ${c.season || 'stagione'}`.slice(0, 100),
        value: c.id
      })))
  );
}

function buildAdvancedCalendarOptions(comp) {
  const options = [];
  if (comp.type === 'league') {
    options.push({ label: 'Campionato A/R', value: 'league_double', description: 'Andata e ritorno' });
  } else if (comp.type === 'national_cup') {
    options.push({ label: 'Coppa partita secca', value: 'cup_single', description: 'Solo andata, pari = supplementari/rigori' });
  } else {
    options.push(
      { label: 'Gironi: partita unica + finale secca', value: 'groups_single_ko_single', description: 'Gironi solo andata, KO secco' },
      { label: 'Gironi A/R + KO A/R finale secca', value: 'groups_double_ko_double', description: 'Gironi andata/ritorno, KO andata/ritorno' },
      { label: 'Gironi A/R + KO secco', value: 'groups_double_ko_single', description: 'Gironi A/R, eliminazione secca' },
      { label: 'Gironi partita unica + KO A/R', value: 'groups_single_ko_double', description: 'Gironi secco, KO A/R' }
    );
  }
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('adv_calendar_format_select')
      .setPlaceholder('Scegli formato calendario')
      .addOptions(options)
  );
}

function buildAdvancedCalendarModal(compId, format) {
  const modal = new ModalBuilder()
    .setCustomId(`adv_calendar_modal_${compId}_${format}`)
    .setTitle('Impostazioni Calendario');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('groups')
        .setLabel('NUMERO GIRONI')
        .setPlaceholder('Per campionato/coppa secca lascia 1')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('teams_per_group')
        .setLabel('SQUADRE PER GIRONI')
        .setPlaceholder('Es. 4')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('qualifiers')
        .setLabel('QUALIFICATE PER GIRONI')
        .setPlaceholder('Es. 2')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
    )
  );

  return modal;
}

function buildKnockoutRows(comp, parts, singleLeg = true, startMatchday = 1, roundLabel = null) {
  const rows = [];
  const teams = shuffle(parts);
  const roundName = roundLabel || koRoundName(teams.length);

  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];
    if (!home || !away) continue;

    rows.push(matchRow(comp, home, away, roundName, startMatchday++, 1, null));
    if (!singleLeg && teams.length > 2) {
      rows.push(matchRow(comp, away, home, `${roundName} • Ritorno`, startMatchday++, 2, null));
    }
  }
  return rows;
}

async function generateAdvancedCalendar(competitionId, format, opts = {}) {
  const { data: comp, error: compErr } = await supabase.from('competitions').select('*').eq('id', competitionId).single();
  if (compErr || !comp) throw new Error('Competizione non trovata');

  const { data: parts, error: pErr } = await supabase
    .from('competition_participants')
    .select('*')
    .eq('competition_id', competitionId)
    .order('seed_number', { ascending: true });

  if (pErr) throw pErr;
  if (!parts || parts.length < 2) throw new Error('Servono almeno 2 squadre');

  const rows = [];

  if (comp.type === 'league' || format === 'league_double') {
    const rounds = roundRobin(parts);
    rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.home, m.away, 'Andata', idx + 1, 1, 'Girone Unico'))));
    rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.away, m.home, 'Ritorno', rounds.length + idx + 1, 2, 'Girone Unico'))));
  } else if (comp.type === 'national_cup' || format === 'cup_single') {
    rows.push(...buildKnockoutRows(comp, parts, true, 1));
  } else {
    const groupsCount = Math.max(1, Number(opts.groups || comp.settings?.gironi || 4));
    const qualifiers = Math.max(1, Number(opts.qualifiers || comp.settings?.qualificate_per_girone || 2));
    const groupDouble = format.includes('groups_double');
    const koDouble = format.includes('ko_double');

    const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: `Girone ${String.fromCharCode(65 + i)}`, teams: [] }));
    shuffle(parts).forEach((p, i) => groups[i % groupsCount].teams.push(p));

    for (const group of groups) {
      for (const p of group.teams) {
        await supabase.from('competition_participants').update({ group_name: group.name }).eq('id', p.id);
      }
      const rounds = roundRobin(group.teams);
      rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.home, m.away, `Gironi • ${group.name}`, idx + 1, 1, group.name))));
      if (groupDouble) {
        rounds.forEach((ms, idx) => ms.forEach(m => rows.push(matchRow(comp, m.away, m.home, `Gironi ritorno • ${group.name}`, rounds.length + idx + 1, 2, group.name))));
      }
    }

    // Placeholder fase finale generata con prime seed, da confermare staff a fine gironi
    await supabase.from('competitions').update({
      settings: { ...(comp.settings || {}), qualifiers_per_group: qualifiers, knockout_double_leg: koDouble, group_double_leg: groupDouble }
    }).eq('id', comp.id);
  }

  if (!rows.length) throw new Error('Nessuna partita generata');

  const { error: mErr } = await supabase.from('matches').insert(rows);
  if (mErr) throw mErr;

  await supabase.from('competitions').update({ status: 'calendar_generated' }).eq('id', competitionId);
  return { competition: comp, matchesCreated: rows.length };
}

async function recordDisciplineFromDraft(reportId, matchId, draft) {
  const cards = [];
  for (const y of draft.yellowCards || []) {
    cards.push({ report_id: reportId, match_id: matchId, draft_assignment_id: y.playerId, discord_id: y.discordId, card_type: 'yellow' });
  }
  for (const r of draft.redCards || []) {
    cards.push({ report_id: reportId, match_id: matchId, draft_assignment_id: r.playerId, discord_id: r.discordId, card_type: 'red' });
  }
  if (cards.length) await supabase.from('disciplinary_cards').insert(cards);
}

async function applyDisciplineAfterConfirmed(matchId) {
  const { data: cards } = await supabase.from('disciplinary_cards').select('*').eq('match_id', matchId);
  const byPlayer = {};

  for (const card of cards || []) {
    if (!byPlayer[card.discord_id]) byPlayer[card.discord_id] = { yellow: 0, red: 0 };
    byPlayer[card.discord_id][card.card_type] += 1;
  }

  for (const [discordId, counts] of Object.entries(byPlayer)) {
    const { data: existing } = await supabase.from('disciplinary_records').select('*').eq('discord_id', discordId).maybeSingle();
    const yellows = Number(existing?.yellow_count || 0) + counts.yellow;
    let suspension = Number(existing?.suspension_matches || 0);

    if (counts.red > 0) suspension += 1;
    if (yellows >= 3) suspension += 1;

    await supabase.from('disciplinary_records').upsert({
      discord_id: discordId,
      yellow_count: yellows % 3,
      red_count: Number(existing?.red_count || 0) + counts.red,
      suspension_matches: suspension,
      updated_at: new Date().toISOString()
    }, { onConflict: 'discord_id' });
  }
}

async function decrementSuspensionsForParticipants(matchId) {
  const { data: stats } = await supabase.from('match_report_player_stats').select('discord_id').eq('match_id', matchId);
  const ids = [...new Set((stats || []).map(s => s.discord_id).filter(Boolean))];
  for (const id of ids) {
    const { data: rec } = await supabase.from('disciplinary_records').select('*').eq('discord_id', id).maybeSingle();
    if (rec && Number(rec.suspension_matches || 0) > 0) {
      await supabase.from('disciplinary_records').update({ suspension_matches: Math.max(0, Number(rec.suspension_matches) - 1) }).eq('discord_id', id);
    }
  }
}

async function isPlayerSuspended(discordId) {
  const { data } = await supabase.from('disciplinary_records').select('*').eq('discord_id', discordId).maybeSingle();
  return Number(data?.suspension_matches || 0) > 0;
}

async function publishStandingsAndStats(competitionId) {
  const { data: comp } = await supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle();
  if (!comp) return;

  const { data: standings } = await supabase
    .from('competition_standings')
    .select('*')
    .eq('competition_id', competitionId)
    .order('points', { ascending: false })
    .order('goals_for', { ascending: false });

  const standingsText = (standings || []).map((r, i) => {
    const diff = Number(r.goals_for || 0) - Number(r.goals_against || 0);
    return `**${i + 1}. ${r.team_name}** — ${r.points} pt | ${r.played}G ${r.wins}V ${r.draws}N ${r.losses}P | GF ${r.goals_for} GS ${r.goals_against} DR ${diff}`;
  }).join('\n') || 'Classifica vuota.';

  const standingsChannel = await client.channels.fetch(STANDINGS_CHANNEL_ID).catch(() => null);
  if (standingsChannel) {
    await standingsChannel.send({
      embeds: [new EmbedBuilder().setTitle(`📊 Classifica • ${comp.name}`).setColor(0xd4af37).setDescription(standingsText.slice(0, 4096)).setTimestamp()]
    }).catch(() => null);
  }

  const topScorers = await getCompetitionTopScorers(competitionId, 10);
  const scorersText = topScorers.length ? topScorers.map((s, i) => `**${i + 1}.** <@${s.discord_id}> — ${s.goals} gol`).join('\n') : 'Nessun gol.';
  const topAssists = await getCompetitionTopAssists(competitionId, 10);
  const assistsText = topAssists.length ? topAssists.map((s, i) => `**${i + 1}.** <@${s.discord_id}> — ${s.assists} assist`).join('\n') : 'Nessun assist.';
  const topMvp = await getCompetitionTopMvp(competitionId, 10);
  const mvpText = topMvp.length ? topMvp.map((s, i) => `**${i + 1}.** <@${s.discord_id}> — ${s.mvp} MVP`).join('\n') : 'Nessun MVP.';
  const bestGk = await getCompetitionBestGoalkeepers(competitionId, 10);
  const gkText = bestGk.length ? bestGk.map((s, i) => `**${i + 1}.** <@${s.discord_id}> — ${s.clean_sheets} clean sheet`).join('\n') : 'Nessun dato portieri.';

  const statsChannel = await client.channels.fetch(STATS_CHANNEL_ID).catch(() => null);
  if (statsChannel) {
    await statsChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📈 Statistiche • ${comp.name}`)
          .setColor(0xd4af37)
          .addFields(
            { name: '⚽ Marcatori', value: scorersText.slice(0, 1024), inline: false },
            { name: '🎯 Assist', value: assistsText.slice(0, 1024), inline: false },
            { name: '⭐ MVP', value: mvpText.slice(0, 1024), inline: false },
            { name: '🧤 Miglior Portiere', value: gkText.slice(0, 1024), inline: false }
          )
          .setTimestamp()
      ]
    }).catch(() => null);
  }
}

async function getCompetitionStatsTotals(competitionId, field, limit = 10) {
  const { data: matches } = await supabase.from('matches').select('id').eq('competition_id', competitionId);
  const matchIds = (matches || []).map(m => m.id);
  if (!matchIds.length) return [];
  const { data: stats } = await supabase.from('match_report_player_stats').select(`discord_id, ${field}`).in('match_id', matchIds);
  const totals = {};
  for (const row of stats || []) totals[row.discord_id] = Number(totals[row.discord_id] || 0) + Number(row[field] || 0);
  return Object.entries(totals).map(([discord_id, value]) => ({ discord_id, [field]: value })).sort((a,b)=>b[field]-a[field]).slice(0, limit);
}

async function getCompetitionTopAssists(competitionId, limit = 10) {
  return getCompetitionStatsTotals(competitionId, 'assists', limit);
}

async function getCompetitionTopMvp(competitionId, limit = 10) {
  return getCompetitionStatsTotals(competitionId, 'mvp', limit);
}

async function getCompetitionBestGoalkeepers(competitionId, limit = 10) {
  const { data: matches } = await supabase.from('matches').select('*').eq('competition_id', competitionId).eq('status', 'confirmed');
  const totals = {};
  for (const m of matches || []) {
    if (Number(m.away_goals || 0) === 0) {
      const { data: stats } = await supabase.from('match_report_player_stats').select('discord_id, player_registrations(primary_role)').eq('match_id', m.id);
      for (const s of stats || []) {
        if (s.player_registrations?.primary_role === 'POR') totals[s.discord_id] = Number(totals[s.discord_id] || 0) + 1;
      }
    }
  }
  return Object.entries(totals).map(([discord_id, clean_sheets]) => ({ discord_id, clean_sheets })).sort((a,b)=>b.clean_sheets-a.clean_sheets).slice(0, limit);
}

async function autoAwardSeasonPrizes(competitionId) {
  const { data: comp } = await supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle();
  if (!comp) return [];

  const awards = [];
  const scorers = await getCompetitionTopScorers(competitionId, 1);
  if (scorers[0]) {
    await addOverallBonusToPlayer(scorers[0].discord_id, 10, 'top_scorer', `Capocannoniere ${comp.name}`, competitionId);
    awards.push(`Capocannoniere: <@${scorers[0].discord_id}>`);
  }

  const mvps = await getCompetitionTopMvp(competitionId, 1);
  if (mvps[0]) {
    await addOverallBonusToPlayer(mvps[0].discord_id, 15, 'mvp_competition', `MVP ${comp.name}`, competitionId);
    awards.push(`MVP: <@${mvps[0].discord_id}>`);
  }

  const gks = await getCompetitionBestGoalkeepers(competitionId, 1);
  if (gks[0]) {
    await addOverallBonusToPlayer(gks[0].discord_id, 10, 'best_goalkeeper', `Miglior Portiere ${comp.name}`, competitionId);
    awards.push(`Miglior Portiere: <@${gks[0].discord_id}>`);
  }

  return awards;
}

async function createSeasonBackup(label = null) {
  const backupLabel = label || `Backup ${new Date().toISOString()}`;
  const tables = ['competitions', 'matches', 'competition_standings', 'player_registrations', 'player_contracts', 'draft_teams', 'draft_assignments', 'hall_of_fame'];
  const payload = {};
  for (const table of tables) {
    const { data } = await supabase.from(table).select('*').limit(10000);
    payload[table] = data || [];
  }
  const { data, error } = await supabase.from('season_backups').insert({
    label: backupLabel,
    payload
  }).select().single();
  if (error) throw error;
  return data;
}


function getEconomyTierFromOverall(overall) {
  const value = Number(overall || 0);
  if (value <= 19) return 'ROOKIE';
  if (value <= 39) return 'BASSA';
  if (value <= 59) return 'MEDIA';
  if (value <= 79) return 'ALTA';
  if (value <= 119) return 'TOP';
  return 'LEGGENDA';
}

function getEconomySalaryFromOverall(overall) {
  const value = Number(overall || 0);
  if (value <= 19) return 5;
  if (value <= 39) return 10;
  if (value <= 59) return 20;
  if (value <= 79) return 35;
  if (value <= 99) return 50;
  if (value <= 119) return 70;
  return 100;
}

async function findPlayerClubTeam(discordId) {
  const { data } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams!inner(*)')
    .eq('discord_id', discordId)
    .eq('draft_teams.team_type', 'club')
    .maybeSingle();

  return data?.draft_teams || null;
}

async function getClubRosterWithContracts(teamId) {
  const { data: rows } = await supabase
    .from('draft_assignments')
    .select('*, player_registrations(*)')
    .eq('draft_team_id', teamId)
    .order('primary_role', { ascending: true })
    .order('platform_id', { ascending: true });

  const contractsResult = await supabase
    .from('player_contracts')
    .select('*')
    .eq('draft_team_id', teamId)
    .eq('status', 'active');

  const contracts = contractsResult.data || [];

  return (rows || []).map(row => {
    const c = contracts.find(x => x.discord_id === row.discord_id);
    const overall = row.player_registrations?.rpci_overall || row.player_registrations?.overall || 0;
    return {
      ...row,
      role: row.primary_role || row.player_registrations?.primary_role || 'N/D',
      platform_id: row.platform_id || row.player_registrations?.platform_id || 'N/D',
      overall,
      salary: c?.salary ?? getEconomySalaryFromOverall(overall),
      years_remaining: c?.years_remaining ?? 1,
      contract: c || null
    };
  });
}

async function buildClubBalanceEmbedForUser(discordId) {
  const team = await findPlayerClubTeam(discordId);
  if (!team) return null;

  const budget = await getClubBudgetInfo(team);
  const roster = await getClubRosterWithContracts(team.id);
  const expiring = roster.filter(p => Number(p.years_remaining || 0) <= 1).length;
  const squadValue = roster.reduce((sum, p) => sum + (Number(p.overall || 0) * 2 + Number(p.salary || 0)), 0);

  return new EmbedBuilder()
    .setTitle('💰 BILANCIO CLUB')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Club', value: team.name, inline: false },
      { name: 'Budget iniziale', value: `${budget.budget.season_budget || ECONOMY_BASE_CLUB_BUDGET} crediti`, inline: true },
      { name: 'Bonus budget', value: `${budget.budget.bonus_budget || 0} crediti`, inline: true },
      { name: 'Budget totale', value: `${budget.total} crediti`, inline: true },
      { name: 'Monte ingaggi', value: `${budget.spent} crediti`, inline: true },
      { name: 'Budget residuo', value: `${budget.remaining} crediti`, inline: true },
      { name: 'Contratti in scadenza', value: String(expiring), inline: true },
      { name: 'Valore rosa stimato', value: `${squadValue} crediti`, inline: true }
    )
    .setFooter({ text: 'RPCI • Bilancio Club' })
    .setTimestamp();
}

async function buildClubRosterEmbedForUser(discordId) {
  const team = await findPlayerClubTeam(discordId);
  if (!team) return null;

  const roster = await getClubRosterWithContracts(team.id);
  const grouped = {};
  for (const p of roster) {
    if (!grouped[p.role]) grouped[p.role] = [];
    grouped[p.role].push(p);
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 ROSA CLUB • ${team.name}`)
    .setColor(0xd4af37)
    .setFooter({ text: 'RPCI • Rose' })
    .setTimestamp();

  for (const role of GAME_ROLES) {
    const players = grouped[role] || [];
    if (!players.length) continue;
    embed.addFields({
      name: `${role} - ${ROLE_LABELS[role] || role}`,
      value: players.map(p => `• <@${p.discord_id}> | ID: **${p.platform_id}** | OVR ${p.overall} | ${p.salary} cr | ${p.years_remaining} stag.`).join('\n').slice(0, 1024),
      inline: false
    });
  }

  if (!roster.length) embed.setDescription('Nessun player in rosa.');
  return embed;
}

async function buildCalendarEmbedForUser(discordId) {
  const team = await findPlayerClubTeam(discordId);
  if (!team) return null;

  const { data: matches } = await supabase
    .from('matches')
    .select('*, competitions(name, type, season)')
    .or(`home_draft_team_id.eq.${team.id},away_draft_team_id.eq.${team.id}`)
    .order('matchday', { ascending: true })
    .limit(25);

  const text = (matches || []).map(m => {
    const score = m.status === 'confirmed' ? ` | ${m.home_goals}-${m.away_goals}` : '';
    return `**${m.competitions?.name || 'Competizione'}** • G${m.matchday || '-'} • ${m.home_team_name} vs ${m.away_team_name}${score} • ${m.status}`;
  }).join('\n') || 'Nessuna partita trovata.';

  return new EmbedBuilder()
    .setTitle(`📅 CALENDARIO • ${team.name}`)
    .setColor(0xd4af37)
    .setDescription(text.slice(0, 4096))
    .setFooter({ text: 'RPCI • Calendario' })
    .setTimestamp();
}

function buildBalancePanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('💰 BILANCIO CLUB')
        .setColor(0xd4af37)
        .setDescription('Premi il pulsante qui sotto per visualizzare il bilancio del tuo club.')
        .setFooter({ text: 'RPCI • Bilancio Club' })
        .setTimestamp()
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel_balance_my_club').setLabel('VEDI BILANCIO CLUB').setStyle(ButtonStyle.Primary))]
  };
}

function buildRosterPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('📋 ROSE CLUB')
        .setColor(0xd4af37)
        .setDescription('Premi il pulsante qui sotto per visualizzare la rosa del tuo club divisa per ruoli.')
        .setFooter({ text: 'RPCI • Rose' })
        .setTimestamp()
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel_roster_my_club').setLabel('VEDI ROSA CLUB').setStyle(ButtonStyle.Primary))]
  };
}

function buildCalendarPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('📅 CALENDARIO')
        .setColor(0xd4af37)
        .setDescription('Premi il pulsante qui sotto per visualizzare il calendario della tua squadra.')
        .setFooter({ text: 'RPCI • Calendario' })
        .setTimestamp()
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel_calendar_my_team').setLabel('VEDI CALENDARIO').setStyle(ButtonStyle.Primary))]
  };
}

function buildReportsPanel() {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('📝 REFERTI PARTITA')
        .setColor(0xd4af37)
        .setDescription(
          'Canale riservato ai capitani.\n\n' +
          'Premi **INSERISCI RISULTATO** per selezionare la competizione, scegliere la partita da disputare e compilare il referto della tua squadra.'
        )
        .setFooter({ text: 'RPCI • Referti' })
        .setTimestamp()
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('panel_insert_report').setLabel('INSERISCI RISULTATO').setStyle(ButtonStyle.Success))]
  };
}

async function publishOperationalPanels() {
  const balanceChannel = await client.channels.fetch(BALANCE_CHANNEL_ID).catch(() => null);
  if (balanceChannel) await balanceChannel.send(buildBalancePanel()).catch(() => null);

  const rosterChannel = await client.channels.fetch(ROSTERS_CHANNEL_ID).catch(() => null);
  if (rosterChannel) await rosterChannel.send(buildRosterPanel()).catch(() => null);

  const calendarChannel = await client.channels.fetch(CALENDAR_CHANNEL_ID).catch(() => null);
  if (calendarChannel) await calendarChannel.send(buildCalendarPanel()).catch(() => null);

  const reportsChannel = await client.channels.fetch(MATCH_REPORTS_CHANNEL_ID).catch(() => null);
  if (reportsChannel) await reportsChannel.send(buildReportsPanel()).catch(() => null);
}

async function openReportCompetitionSelection(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member?.roles.cache.has(CAPTAIN_ROLE_ID)) {
    return interaction.reply({ content: '❌ Solo i capitani possono inserire referti.', flags: MessageFlags.Ephemeral });
  }

  const team = await getDraftTeamByCaptain(interaction.user.id);
  if (!team) return interaction.reply({ content: '❌ Non risulti capitano di nessuna squadra.', flags: MessageFlags.Ephemeral });

  const { data: matches } = await supabase
    .from('matches')
    .select('*, competitions(*)')
    .or(`home_draft_team_id.eq.${team.id},away_draft_team_id.eq.${team.id}`)
    .in('status', ['scheduled', 'pending_reports', 'disputed'])
    .order('matchday', { ascending: true });

  if (!matches || !matches.length) return interaction.reply({ content: '❌ Non hai partite da refertare.', flags: MessageFlags.Ephemeral });

  const compsMap = new Map();
  for (const m of matches) if (m.competitions) compsMap.set(m.competitions.id, m.competitions);
  const comps = [...compsMap.values()].slice(0, 25);

  reportDrafts.set(interaction.user.id, {
    team,
    reportCompetitionMatches: matches,
    roster: [],
    presentPlayers: [],
    scoreSet: false,
    goals: [],
    assists: [],
    yellowCards: [],
    redCards: []
  });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('report_competition_select')
      .setPlaceholder('Seleziona competizione')
      .addOptions(comps.map(c => ({ label: c.name.slice(0,100), description: competitionTypeLabel(c.type), value: c.id })))
  );

  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('📝 Inserisci Risultato').setColor(0xd4af37).setDescription('Scegli la competizione.')],
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function publishSeasonAwardMessage(title, description, fields = []) {
  const ch = await client.channels.fetch(SEASON_AWARDS_CHANNEL_ID).catch(() => null);
  if (!ch) return;
  await ch.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(title)
        .setColor(0xd4af37)
        .setDescription(description)
        .addFields(fields)
        .setFooter({ text: 'RPCI • Premi stagionali' })
        .setTimestamp()
    ]
  }).catch(() => null);
}


async function getQualifiedTeamsFromGroups(competitionId) {
  const { data: comp } = await supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle();
  const qualifiersPerGroup = Number(comp?.settings?.qualifiers_per_group || comp?.settings?.qualificate_per_girone || 2);

  const { data: participants } = await supabase
    .from('competition_participants')
    .select('*')
    .eq('competition_id', competitionId);

  const groups = {};
  for (const p of participants || []) {
    const g = p.group_name || 'Girone Unico';
    if (!groups[g]) groups[g] = [];
    groups[g].push(p);
  }

  const qualified = [];

  for (const [groupName, teams] of Object.entries(groups)) {
    const standingsResult = await supabase
      .from('competition_standings')
      .select('*')
      .eq('competition_id', competitionId)
      .in('draft_team_id', teams.map(t => t.draft_team_id))
      .order('points', { ascending: false })
      .order('goals_for', { ascending: false });

    const standings = standingsResult.data || [];
    const top = standings.slice(0, qualifiersPerGroup);
    for (const row of top) {
      const participant = teams.find(t => t.draft_team_id === row.draft_team_id);
      if (participant) qualified.push(participant);
    }
  }

  return qualified;
}

async function generateFinalStageFromGroups(competitionName) {
  const comp = await findCompetitionByName(competitionName);
  if (!comp) throw new Error('Competizione non trovata');

  const qualified = await getQualifiedTeamsFromGroups(comp.id);
  if (qualified.length < 2) throw new Error('Non ci sono abbastanza qualificate');

  const koDouble = comp.settings?.knockout_double_leg === true;
  const rows = buildKnockoutRows(comp, qualified, !koDouble, 100, koRoundName(qualified.length));

  if (!rows.length) throw new Error('Nessuna partita fase finale generata');

  const { error } = await supabase.from('matches').insert(rows);
  if (error) throw error;

  await supabase.from('competitions').update({
    status: 'final_stage_generated',
    updated_at: new Date().toISOString()
  }).eq('id', comp.id);

  return { comp, rows, qualified };
}

function buildPenaltyModal(matchId, winnerTeamId) {
  const modal = new ModalBuilder()
    .setCustomId(`penalty_result_modal_${matchId}_${winnerTeamId}`)
    .setTitle('Supplementari / Rigori');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('extra_time')
        .setLabel('RISULTATO SUPPLEMENTARI')
        .setPlaceholder('Es. 1-0 oppure NO')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('penalties')
        .setLabel('RISULTATO RIGORI')
        .setPlaceholder('Es. 5-4 oppure NO')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  return modal;
}

async function saveKnockoutWinner(matchId, winnerTeamId, extraTime, penalties) {
  await supabase.from('matches').update({
    winner_team_id: winnerTeamId,
    extra_time_result: extraTime,
    penalties_result: penalties,
    updated_at: new Date().toISOString()
  }).eq('id', matchId);
}

async function applyAutomaticPromotionsRelegationsAll() {
  const { data: comps } = await supabase
    .from('competitions')
    .select('*')
    .eq('type', 'league')
    .in('status', ['closed', 'calendar_generated', 'final_stage_generated']);

  const results = [];

  for (const comp of comps || []) {
    const promotedCount = Number(comp.settings?.promosse || 0);
    const relegatedCount = Number(comp.settings?.retrocesse || 0);
    if (!promotedCount && !relegatedCount) continue;
  }

  return results;
}

async function applyLeagueMovementsForCompetition(comp) {
  const promotedCount = Number(comp.settings?.promosse || 0);
  const relegatedCount = Number(comp.settings?.retrocesse || 0);

  const { data: standings } = await supabase
    .from('competition_standings')
    .select('*')
    .eq('competition_id', comp.id)
    .order('points', { ascending: false })
    .order('goals_for', { ascending: false });

  const rows = standings || [];
  const promoted = promotedCount > 0 ? rows.slice(0, promotedCount) : [];
  const relegated = relegatedCount > 0 ? rows.slice(-relegatedCount).reverse() : [];

  await supabase.from('competition_movements').delete().eq('competition_id', comp.id).catch(() => null);

  const insertRows = [];
  for (const p of promoted) insertRows.push({ competition_id: comp.id, draft_team_id: p.draft_team_id, team_name: p.team_name, movement_type: 'promoted' });
  for (const r of relegated) insertRows.push({ competition_id: comp.id, draft_team_id: r.draft_team_id, team_name: r.team_name, movement_type: 'relegated' });

  if (insertRows.length) await supabase.from('competition_movements').insert(insertRows);
  return { promoted, relegated };
}

async function updateCareerSnapshotForPlayer(discordId) {
  const { data: reg } = await supabase.from('player_registrations').select('*').eq('discord_id', discordId).maybeSingle();
  if (!reg) return null;

  const { data: assignments } = await supabase
    .from('draft_assignments')
    .select('*, draft_teams(name, team_type)')
    .eq('discord_id', discordId);

  const clubs = [...new Set((assignments || []).filter(a => a.draft_teams?.team_type === 'club').map(a => a.draft_teams.name))];
  const nationals = [...new Set((assignments || []).filter(a => a.draft_teams?.team_type === 'national').map(a => a.draft_teams.name))];

  const { data: awards } = await supabase.from('player_awards').select('*').eq('discord_id', discordId);
  const { data: transfers } = await supabase.from('transfer_logs').select('*').eq('player_discord_id', discordId);

  const payload = {
    discord_id: discordId,
    discord_tag: reg.discord_tag,
    name: reg.name,
    platform_id: reg.platform_id,
    primary_role: reg.primary_role,
    rpci_overall: reg.rpci_overall || reg.overall || 0,
    appearances: reg.appearances || 0,
    goals: reg.goals || 0,
    assists: reg.assists || 0,
    mvp_awards: reg.mvp_awards || 0,
    clubs,
    nationals,
    awards: awards || [],
    transfers: transfers || []
  };

  await supabase.from('career_snapshots').upsert(payload, { onConflict: 'discord_id' }).catch(() => null);
  return payload;
}

async function buildCareerEmbed(discordId) {
  const payload = await updateCareerSnapshotForPlayer(discordId);
  if (!payload) return null;

  const awardsText = payload.awards.length
    ? payload.awards.slice(0, 10).map(a => `• ${a.award_label || a.award_type} (+${a.bonus_points || 0})`).join('\n')
    : 'Nessun premio.';

  return new EmbedBuilder()
    .setTitle(`📖 Carriera RPCI • ${payload.name || payload.discord_tag || 'Player'}`)
    .setColor(0xd4af37)
    .addFields(
      { name: 'Player', value: `<@${discordId}>`, inline: true },
      { name: 'ID Console', value: payload.platform_id || 'N/D', inline: true },
      { name: 'Ruolo', value: payload.primary_role || 'N/D', inline: true },
      { name: 'Overall RPCI', value: String(payload.rpci_overall), inline: true },
      { name: 'Presenze', value: String(payload.appearances), inline: true },
      { name: 'Gol', value: String(payload.goals), inline: true },
      { name: 'Assist', value: String(payload.assists), inline: true },
      { name: 'MVP', value: String(payload.mvp_awards), inline: true },
      { name: 'Club', value: payload.clubs.length ? payload.clubs.join(', ') : 'Nessuno', inline: false },
      { name: 'Nazionali', value: payload.nationals.length ? payload.nationals.join(', ') : 'Nessuna', inline: false },
      { name: 'Premi', value: awardsText.slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'RPCI • Storico Carriera' })
    .setTimestamp();
}

async function runSystemChecks() {
  const issues = [];

  const { data: assignments } = await supabase
    .from('draft_assignments')
    .select('discord_id, draft_team_id, draft_teams(team_type, name)');

  const clubMap = {};
  for (const a of assignments || []) {
    if (a.draft_teams?.team_type !== 'club') continue;
    if (!clubMap[a.discord_id]) clubMap[a.discord_id] = [];
    clubMap[a.discord_id].push(a.draft_teams.name);
  }

  for (const [discordId, teams] of Object.entries(clubMap)) {
    if (teams.length > 1) issues.push(`Player <@${discordId}> risulta in più club: ${teams.join(', ')}`);
  }

  const { data: teams } = await supabase.from('draft_teams').select('*');
  for (const t of teams || []) {
    if (t.captain_discord_id) {
      const exists = (assignments || []).some(a => a.discord_id === t.captain_discord_id && a.draft_team_id === t.id);
      if (!exists) issues.push(`Capitano di ${t.name} non risulta nella rosa.`);
    }
  }

  const { data: budgets } = await supabase.from('club_budgets').select('*');
  for (const b of budgets || []) {
    const { data: contracts } = await supabase.from('player_contracts').select('*').eq('draft_team_id', b.draft_team_id).eq('status', 'active');
    const spent = (contracts || []).reduce((s, c) => s + Number(c.salary || 0) * Number(c.years_remaining || 1), 0);
    const total = Number(b.season_budget || 0) + Number(b.bonus_budget || 0);
    if (spent > total) issues.push(`Budget negativo per ${b.team_name}: speso ${spent}, budget ${total}`);
  }

  const { data: expired } = await supabase.from('player_contracts').select('*').eq('status', 'active').lte('years_remaining', 0);
  for (const c of expired || []) issues.push(`Contratto scaduto ancora attivo: <@${c.discord_id}> (${c.team_name})`);

  return issues;
}

async function buildAdvancedStaffDashboard() {
  const comps = await supabase.from('competitions').select('*');
  const clubs = await supabase.from('draft_teams').select('*').eq('team_type', 'club');
  const nationals = await supabase.from('draft_teams').select('*').eq('team_type', 'national');
  const contracts = await supabase.from('player_contracts').select('*').eq('status', 'active').lte('years_remaining', 1);
  const budgets = await supabase.from('club_budgets').select('*');

  const captains = (clubs.data || []).filter(t => t.captain_discord_id).length + (nationals.data || []).filter(t => t.captain_discord_id).length;

  return new EmbedBuilder()
    .setTitle('🧭 DASHBOARD STAFF AVANZATA')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Competizioni', value: String((comps.data || []).length), inline: true },
      { name: 'Club', value: String((clubs.data || []).length), inline: true },
      { name: 'Nazionali', value: String((nationals.data || []).length), inline: true },
      { name: 'Capitani/CT assegnati', value: String(captains), inline: true },
      { name: 'Contratti in scadenza', value: String((contracts.data || []).length), inline: true },
      { name: 'Budget club', value: String((budgets.data || []).length), inline: true }
    )
    .setFooter({ text: 'RPCI • Dashboard staff' })
    .setTimestamp();
}

// =======================================================
// INTERACTIONS
// =======================================================
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await logCommand(interaction);

      if (interaction.commandName === 'avvia_iscrizioni_player') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può avviare le iscrizioni player.', flags: MessageFlags.Ephemeral });
        }

        await setRegistrationOpen(true);
        await interaction.channel.send(buildPlayerRegistrationPanel());
        return interaction.reply({ content: '✅ Pannello iscrizioni player pubblicato e iscrizioni aperte.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'chiudi_iscrizioni_player') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere le iscrizioni.', flags: MessageFlags.Ephemeral });
        }

        await setRegistrationOpen(false);
        return interaction.reply({ content: '✅ Iscrizioni player chiuse.', flags: MessageFlags.Ephemeral });
      }


      if (interaction.commandName === 'avvia_stagione_club') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può avviare la modalità club.', flags: MessageFlags.Ephemeral });
        }

        await setModeActive('club', true);
        return interaction.reply({ content: '✅ Modalità Club attivata. Campionati/coppe club possono partire.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'chiudi_stagione_club') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere la modalità club.', flags: MessageFlags.Ephemeral });
        }

        await setModeActive('club', false);
        return interaction.reply({ content: '✅ Modalità Club chiusa.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'avvia_stagione_nazionale') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può avviare la modalità nazionale.', flags: MessageFlags.Ephemeral });
        }

        await setModeActive('national', true);
        return interaction.reply({ content: '✅ Modalità Nazionale attivata. Mondiale/Europeo possono partire in parallelo alla modalità club.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'chiudi_stagione_nazionale') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere la modalità nazionale.', flags: MessageFlags.Ephemeral });
        }

        await setModeActive('national', false);
        return interaction.reply({ content: '✅ Modalità Nazionale chiusa.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'prepara_draft_club') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può preparare il draft club.', flags: MessageFlags.Ephemeral });
        }

        const active = await getActiveLiveDraftSession();
        if (active) {
          return interaction.reply({ content: '❌ Esiste già un draft live attivo. Chiudilo con `/chiudi_draft_live`.', flags: MessageFlags.Ephemeral });
        }

        const numero = interaction.options.getInteger('numero_squadre');
        const nomi = parseCommaList(interaction.options.getString('nomi_squadre'));
        const maxPlayers = interaction.options.getInteger('max_player') || 30;

        if (nomi.length !== numero) {
          return interaction.reply({ content: `❌ Devi inserire esattamente ${numero} nomi squadra.`, flags: MessageFlags.Ephemeral });
        }

        const players = await getAvailablePlayersForLiveDraft('club');
        if (players.length < numero) {
          return interaction.reply({ content: '❌ Non ci sono abbastanza player iscritti per preparare il draft club.', flags: MessageFlags.Ephemeral });
        }

        const result = await createLiveDraftSession({
          mode: 'club',
          teamNames: nomi,
          maxPlayers,
          createdBy: interaction.user.id
        });

        return interaction.reply({
          content:
            `✅ Draft Club LIVE preparato.\n` +
            `Squadre: **${result.teams.length}**\n` +
            `Player disponibili: **${players.length}**\n\n` +
            `Durante la live usa **/pesca_draft_live** per sorteggiare un player alla volta.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'prepara_draft_nazionale') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può preparare il draft nazionali.', flags: MessageFlags.Ephemeral });
        }

        const active = await getActiveLiveDraftSession();
        if (active) {
          return interaction.reply({ content: '❌ Esiste già un draft live attivo. Chiudilo con `/chiudi_draft_live`.', flags: MessageFlags.Ephemeral });
        }

        const numero = interaction.options.getInteger('numero_nazionali');
        const nomi = parseCommaList(interaction.options.getString('nomi_nazionali'));
        const maxPlayers = interaction.options.getInteger('max_player') || 30;

        if (nomi.length !== numero) {
          return interaction.reply({ content: `❌ Devi inserire esattamente ${numero} nomi nazionale.`, flags: MessageFlags.Ephemeral });
        }

        const players = await getAvailablePlayersForLiveDraft('national');
        if (players.length < numero) {
          return interaction.reply({ content: '❌ Non ci sono abbastanza player assegnati ai club per preparare il draft nazionali.', flags: MessageFlags.Ephemeral });
        }

        const result = await createLiveDraftSession({
          mode: 'national',
          teamNames: nomi,
          maxPlayers,
          createdBy: interaction.user.id
        });

        return interaction.reply({
          content:
            `✅ Draft Nazionali LIVE preparato.\n` +
            `Nazionali: **${result.teams.length}**\n` +
            `Player disponibili: **${players.length}**\n\n` +
            `Durante la live usa **/pesca_draft_live** per sorteggiare un player alla volta.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'pesca_draft_live') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può pescare nel draft live.', flags: MessageFlags.Ephemeral });
        }

        const active = await getActiveLiveDraftSession();
        if (!active) {
          return interaction.reply({ content: '❌ Nessun draft live attivo. Preparalo prima con `/prepara_draft_club` o `/prepara_draft_nazionale`.', flags: MessageFlags.Ephemeral });
        }

        const pick = await pickNextLiveDraftPlayer(active);
        if (pick.done) {
          return interaction.reply({ content: `✅ Draft terminato: ${pick.reason}`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
          content: active.session.mode === 'national' ? '🌍 **PESCATA NAZIONALE LIVE**' : '🎲 **PESCATA CLUB LIVE**',
          embeds: [buildLiveDraftPickEmbed({ player: pick.player, team: pick.team, session: active.session })]
        });
      }

      if (interaction.commandName === 'chiudi_draft_live') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere il draft live.', flags: MessageFlags.Ephemeral });
        }

        const closed = await closeActiveLiveDraftSession();
        if (!closed) {
          return interaction.reply({ content: '❌ Nessun draft live attivo.', flags: MessageFlags.Ephemeral });
        }

        if (closed.mode === 'club') {
          const created = await initializeOneYearContractsForClubDraft();
          return interaction.reply({ content: `✅ Draft live **club** chiuso. Contratti iniziali creati: **${created}** (1 stagione).`, flags: MessageFlags.Ephemeral });
        }
        return interaction.reply({ content: `✅ Draft live **${closed.mode}** chiuso.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'reset_nazionali') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può resettare le nazionali.', flags: MessageFlags.Ephemeral });
        }

        const removed = await resetNationalDraftData();
        return interaction.reply({
          content:
            `✅ Nazionali resettate.\n` +
            `Squadre nazionali rimosse: **${removed}**.\n\n` +
            `Ora puoi preparare un nuovo draft nazionale con **/prepara_draft_nazionale**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'sorteggia_squadre') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può sorteggiare le squadre.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const numero = interaction.options.getInteger('numero_squadre');
        const nomi = parseCommaList(interaction.options.getString('nomi_squadre'));
        const maxPlayers = interaction.options.getInteger('max_player') || 30;

        if (nomi.length !== numero) {
          return interaction.editReply(`❌ Devi inserire esattamente ${numero} nomi squadra separati da virgola.`);
        }

        const players = await getRegisteredPlayersForDraft();
        if (players.length < numero) {
          return interaction.editReply('❌ Non ci sono abbastanza player iscritti per creare queste squadre.');
        }

        // pulizia draft precedente non bloccante
        const { data: oldClubTeams } = await supabase.from('draft_teams').select('id').eq('team_type', 'club');
        const oldClubIds = (oldClubTeams || []).map(t => t.id);
        if (oldClubIds.length) {
          await supabase.from('draft_assignments').delete().in('draft_team_id', oldClubIds).catch(() => null);
          await supabase.from('draft_teams').delete().in('id', oldClubIds).catch(() => null);
        }

        const { teams, assignments } = balancedDraft(players, nomi, maxPlayers);

        const insertedTeams = [];
        for (const t of teams) {
          const { data, error } = await supabase.from('draft_teams').insert({
            name: t.name,
            seed_number: t.seed,
            team_type: 'club',
            status: 'drafted',
            created_by_discord_id: interaction.user.id
          }).select().single();
          if (error) throw error;
          insertedTeams.push(data);
        }

        const rows = assignments.map(a => {
          const team = insertedTeams.find(t => t.name === a.teamName);
          return {
            draft_team_id: team.id,
            player_registration_id: a.player.id,
            discord_id: a.player.discord_id,
            discord_tag: a.player.discord_tag,
            primary_role: a.player.primary_role,
            platform_id: a.player.platform_id,
            pick_number: a.pickNumber
          };
        });

        if (rows.length) {
          const { error } = await supabase.from('draft_assignments').insert(rows);
          if (error) throw error;
        }

        await supabase.from('player_registrations').update({ status: 'assigned' }).in('id', assignments.map(a => a.player.id));

        return interaction.editReply({
          content: `✅ Sorteggio completato. Player assegnati: **${assignments.length}**.`,
          embeds: [buildDraftResultEmbed(teams)]
        });
      }

      if (interaction.commandName === 'staff_assegna_capitano') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può assegnare capitani.', flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('utente');
        const teamName = interaction.options.getString('squadra').trim();

        const { data: team } = await supabase.from('draft_teams').select('*').ilike('name', teamName).maybeSingle();
        if (!team) return interaction.reply({ content: '❌ Squadra non trovata.', flags: MessageFlags.Ephemeral });

        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ Utente non trovato nel server.', flags: MessageFlags.Ephemeral });

        if (team.captain_discord_id && team.captain_discord_id !== target.id) {
          const oldMember = await interaction.guild.members.fetch(team.captain_discord_id).catch(() => null);
          if (oldMember) await oldMember.roles.remove(CAPTAIN_ROLE_ID).catch(() => null);
        }

        await targetMember.roles.add(CAPTAIN_ROLE_ID).catch(() => null);

        await supabase.from('draft_teams').update({
          captain_discord_id: target.id,
          captain_discord_tag: target.tag,
          updated_at: new Date().toISOString()
        }).eq('id', team.id);

        return interaction.reply({ content: `✅ <@${target.id}> è ora capitano di **${team.name}**.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'staff_rimuovi_capitano') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può rimuovere capitani.', flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('utente');
        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (targetMember) await targetMember.roles.remove(CAPTAIN_ROLE_ID).catch(() => null);

        await supabase.from('draft_teams').update({
          captain_discord_id: null,
          captain_discord_tag: null,
          updated_at: new Date().toISOString()
        }).eq('captain_discord_id', target.id);

        return interaction.reply({ content: `✅ Ruolo capitano rimosso da <@${target.id}>.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'crea_competizione') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può creare competizioni.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: '🏆 Seleziona la modalità della competizione.', components: [buildCompetitionModeSelect()], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'genera_calendario') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può generare calendari.', flags: MessageFlags.Ephemeral });
        }

        const comps = await getOpenCompetitionsWithoutCalendar();
        if (!comps.length) {
          return interaction.reply({ content: '❌ Nessuna competizione attiva senza calendario.', flags: MessageFlags.Ephemeral });
        }

        advancedCalendarDrafts.set(interaction.user.id, { comps, comp: null, format: null });

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle('📅 Genera Calendario').setColor(0xd4af37).setDescription('Scegli una competizione senza calendario.')],
          components: [buildAdvancedCalendarCompSelect(comps)],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'referto') {
        if (interaction.channelId !== MATCH_REPORTS_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa /referto solo nel canale referti.', flags: MessageFlags.Ephemeral });
        }

        return openReportForMatch(interaction);
      }

      if (interaction.commandName === 'classifica') {
        const name = interaction.options.getString('competizione').trim();
        const { data: comp } = await supabase.from('competitions').select('*').ilike('name', name).maybeSingle();
        if (!comp) return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });

        const { data: rows } = await supabase
          .from('competition_standings')
          .select('*')
          .eq('competition_id', comp.id)
          .order('points', { ascending: false })
          .order('goals_for', { ascending: false });

        const table = (rows || []).map((r, i) => {
          const gd = Number(r.goals_for || 0) - Number(r.goals_against || 0);
          return `**${i + 1}. ${r.team_name}** — ${r.points} pt | ${r.played}G | ${r.wins}V ${r.draws}N ${r.losses}P | DR ${gd}`;
        }).join('\n') || 'Classifica vuota.';

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle(`📊 Classifica ${comp.name}`).setColor(0xd4af37).setDescription(table.slice(0, 4096))],
          flags: MessageFlags.Ephemeral
        });
      }


      if (interaction.commandName === 'assegna_premio_competizione') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può assegnare premi competizione.', flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('player');
        const prize = interaction.options.getString('premio');
        const pointsMap = {
          league_win: 15,
          national_cup_win: 10,
          european_cup_win: 20,
          national_tournament_win: 25,
          top_scorer: 10
        };
        const labelMap = {
          league_win: 'Vittoria campionato',
          national_cup_win: 'Vittoria coppa nazionale',
          european_cup_win: 'Vittoria coppa europea',
          national_tournament_win: 'Vittoria mondiale/europeo',
          top_scorer: 'Capocannoniere competizione'
        };
        const bonus = pointsMap[prize] || 0;

        const { data: reg } = await supabase
          .from('player_registrations')
          .select('*')
          .eq('discord_id', target.id)
          .maybeSingle();

        if (!reg) {
          return interaction.reply({ content: '❌ Player non trovato nelle iscrizioni.', flags: MessageFlags.Ephemeral });
        }

        const newOverall = Number(reg.rpci_overall || reg.overall || 0) + bonus;

        await supabase
          .from('player_registrations')
          .update({
            rpci_overall: newOverall,
            overall: newOverall,
            updated_at: new Date().toISOString()
          })
          .eq('id', reg.id);

        return interaction.reply({
          content: `✅ Premio assegnato a <@${target.id}>: **${labelMap[prize]}** (+${bonus}). Overall RPCI ora: **${newOverall}**.`,
          flags: MessageFlags.Ephemeral
        });
      }


      if (interaction.commandName === 'chiudi_competizione') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere una competizione.', flags: MessageFlags.Ephemeral });
        }

        const compName = interaction.options.getString('competizione').trim();
        const winnerName = interaction.options.getString('vincitore').trim();

        const comp = await findCompetitionByName(compName);
        if (!comp) {
          return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });
        }

        const winner = await findDraftTeamByName(winnerName);
        if (!winner) {
          return interaction.reply({ content: '❌ Squadra/nazionale vincitrice non trovata.', flags: MessageFlags.Ephemeral });
        }

        const bonus = await closeCompetitionAndAward(comp, winner);
        const autoAwards = await autoAwardSeasonPrizes(comp.id);
        await publishSeasonAwardMessage('🏆 PREMI STAGIONALI', `Competizione conclusa: **${comp.name}**\nVincitore: **${winner.name}**`, [
          { name: 'Bonus vincitore', value: `+${bonus} Overall RPCI ai player vincitori`, inline: false },
          { name: 'Premi automatici', value: autoAwards.length ? autoAwards.join('\n') : 'Nessuno', inline: false }
        ]);

        return interaction.reply({
          content:
            `✅ Competizione **${comp.name}** chiusa.\n` +
            `🏆 Vincitore: **${winner.name}**\n` +
            `Bonus assegnato a tutti i player della squadra: **+${bonus} Overall RPCI**.\n` +
            `Premi automatici: ${autoAwards.length ? autoAwards.join(', ') : 'nessuno'}`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'capocannoniere') {
        const compName = interaction.options.getString('competizione').trim();
        const comp = await findCompetitionByName(compName);

        if (!comp) {
          return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });
        }

        const scorers = await getCompetitionTopScorers(comp.id, 10);
        const text = scorers.length
          ? scorers.map((s, i) => `**${i + 1}.** <@${s.discord_id}> — **${s.goals} gol** (${s.player?.platform_id || 'ID N/D'})`).join('\n')
          : 'Nessun gol registrato.';

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`⚽ Capocannonieri • ${comp.name}`)
              .setColor(0xd4af37)
              .setDescription(text)
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'assegna_capocannoniere') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può assegnare il premio capocannoniere.', flags: MessageFlags.Ephemeral });
        }

        const compName = interaction.options.getString('competizione').trim();
        const target = interaction.options.getUser('player');

        const comp = await findCompetitionByName(compName);
        if (!comp) {
          return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });
        }

        const updated = await addOverallBonusToPlayer(
          target.id,
          10,
          'top_scorer',
          `Capocannoniere ${comp.name}`,
          comp.id
        );

        if (!updated) {
          return interaction.reply({ content: '❌ Player non trovato.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
          content: `✅ Premio capocannoniere assegnato a <@${target.id}>: **+10 Overall RPCI**. Nuovo overall: **${updated.rpci_overall || updated.overall || 0}**.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'applica_promozioni_retrocessioni') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può applicare promozioni/retrocessioni.', flags: MessageFlags.Ephemeral });
        }

        const compName = interaction.options.getString('competizione').trim();
        const comp = await findCompetitionByName(compName);

        if (!comp) {
          return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });
        }

        const result = await buildPromotionRelegationResult(comp);
        const promotedText = result.promoted.length
          ? result.promoted.map(r => `⬆️ ${r.team_name}`).join('\n')
          : 'Nessuna promozione impostata.';
        const relegatedText = result.relegated.length
          ? result.relegated.map(r => `⬇️ ${r.team_name}`).join('\n')
          : 'Nessuna retrocessione impostata.';

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`🔁 Promozioni/Retrocessioni • ${comp.name}`)
              .setColor(0xd4af37)
              .addFields(
                { name: 'Promosse', value: promotedText, inline: false },
                { name: 'Retrocesse', value: relegatedText, inline: false }
              )
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'prossime_partite') {
        const compName = interaction.options.getString('competizione').trim();
        const comp = await findCompetitionByName(compName);

        if (!comp) {
          return interaction.reply({ content: '❌ Competizione non trovata.', flags: MessageFlags.Ephemeral });
        }

        const matches = await getCompetitionMatchesList(comp.id, 15);
        const text = matches.length
          ? matches.map(m => `**G${m.matchday || '-'}** • ${m.round_name || 'Turno'} • **${m.home_team_name} vs ${m.away_team_name}** • ${m.status}`).join('\n')
          : 'Nessuna partita disponibile.';

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`📅 Prossime partite • ${comp.name}`)
              .setColor(0xd4af37)
              .setDescription(text.slice(0, 4096))
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }


      if (interaction.commandName === 'assegna_capitano_club') {
        return startCaptainAssignment(interaction, 'club');
      }

      if (interaction.commandName === 'assegna_capitano_nazionale') {
        return startCaptainAssignment(interaction, 'national');
      }


      if (interaction.commandName === 'apri_mercato') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può aprire il mercato.', flags: MessageFlags.Ephemeral });
        }
        await setMarketOpen(true);
        return interaction.reply({ content: '✅ Mercato club aperto.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'chiudi_mercato') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere il mercato.', flags: MessageFlags.Ephemeral });
        }
        await setMarketOpen(false);
        return interaction.reply({ content: '✅ Mercato club chiuso.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'pubblica_free_agent') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può pubblicare il pannello free agent.', flags: MessageFlags.Ephemeral });
        }
        const ch = await client.channels.fetch(FREE_AGENT_CHANNEL_ID).catch(() => null);
        if (!ch) return interaction.reply({ content: '❌ Canale free agent non trovato.', flags: MessageFlags.Ephemeral });
        await ch.send(buildFreeAgentPanel());
        return interaction.reply({ content: '✅ Pannello Free Agent pubblicato.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'stagione_terminata') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può terminare la stagione.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const backup = await createSeasonBackup('Backup automatico stagione terminata');
        const result = await processSeasonEnd(interaction);
        return interaction.editReply(`✅ Stagione terminata. Backup creato: **${backup.label}** • Contratti scalati: **${result.scaled}** • Free Agent creati: **${result.expired}**. Promozioni/retrocessioni disponibili con /applica_promozioni_retrocessioni.`);
      }

      if (interaction.commandName === 'budget_club') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono vedere il budget.', flags: MessageFlags.Ephemeral });
        }
        const team = await getDraftTeamByCaptain(interaction.user.id);
        if (!team || team.team_type !== 'club') {
          return interaction.reply({ content: '❌ Devi essere capitano di un club.', flags: MessageFlags.Ephemeral });
        }
        const info = await getClubBudgetInfo(team);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('💰 Budget Club')
              .setColor(0xd4af37)
              .addFields(
                { name: 'Club', value: team.name, inline: false },
                { name: 'Budget totale', value: `${info.total} crediti`, inline: true },
                { name: 'Contratti attivi', value: `${info.spent} crediti`, inline: true },
                { name: 'Residuo', value: `${info.remaining} crediti`, inline: true }
              )
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }


      if (interaction.commandName === 'avvia_elezioni_capitani') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può avviare le elezioni.', flags: MessageFlags.Ephemeral });
        }
        const ch = await client.channels.fetch(CAPTAIN_ELECTION_PANEL_CHANNEL_ID).catch(() => null);
        if (!ch) return interaction.reply({ content: '❌ Canale elezioni non trovato.', flags: MessageFlags.Ephemeral });
        await ch.send(buildCaptainElectionPanel());
        return interaction.reply({ content: '✅ Pannello elezioni capitani pubblicato.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'chiudi_elezioni_capitani') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può chiudere le elezioni.', flags: MessageFlags.Ephemeral });
        }
        const assigned = await closeCaptainElectionsAndAssign(interaction.guild);
        return interaction.reply({ content: `✅ Elezioni chiuse. Capitani/CT assegnati: **${assigned}**.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'richiedi_trattativa') {
        return startClubTransfer(interaction);
      }

      if (interaction.commandName === 'proponi_rinnovo') {
        return startRenewal(interaction);
      }

      if (interaction.commandName === 'ranking_rpci') {
        const { data: players } = await supabase
          .from('player_registrations')
          .select('*')
          .order('rpci_overall', { ascending: false })
          .limit(20);

        const text = (players || []).map((p, i) => `**${i + 1}.** <@${p.discord_id}> — **${p.rpci_overall || p.overall || 0}** pts • ${p.platform_id || 'ID N/D'}`).join('\n') || 'Ranking vuoto.';

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle('🏆 Ranking RPCI').setColor(0xd4af37).setDescription(text).setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'hall_of_fame') {
        const { data: rows } = await supabase
          .from('hall_of_fame')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

        const text = (rows || []).map(r => `🏆 **${r.label}** — ${r.winner_name} (${r.category})`).join('\n') || 'Hall of Fame vuota.';

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle('🏛️ Hall of Fame RPCI').setColor(0xd4af37).setDescription(text).setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'assegna_premio') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può assegnare premi.', flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('player');
        const prize = interaction.options.getString('premio');
        const map = {
          season_mvp: ['MVP Stagione', 15],
          best_gk: ['Miglior Portiere', 10],
          best_defender: ['Miglior Difensore', 10],
          best_assistman: ['Miglior Assistman', 10],
          fair_play: ['Fair Play', 5]
        };
        const [label, bonus] = map[prize] || ['Premio RPCI', 5];

        const updated = await addOverallBonusToPlayer(target.id, bonus, prize, label, null);
        if (!updated) return interaction.reply({ content: '❌ Player non trovato.', flags: MessageFlags.Ephemeral });

        await addHallOfFameEntry(label, 'player_award', target.tag, null);

        return interaction.reply({ content: `✅ Premio **${label}** assegnato a <@${target.id}> (+${bonus} Overall RPCI).`, flags: MessageFlags.Ephemeral });
      }


      if (interaction.commandName === 'pannello_staff') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può usare il pannello.', flags: MessageFlags.Ephemeral });
        }
        return interaction.reply({ ...buildStaffPanel(), flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'backup_stagione') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        const backup = await createSeasonBackup('Backup manuale');
        return interaction.reply({ content: `✅ Backup creato: **${backup.label}**`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'squalifiche') {
        const { data } = await supabase.from('disciplinary_records').select('*').gt('suspension_matches', 0).order('suspension_matches', { ascending: false });
        const text = (data || []).map(r => `<@${r.discord_id}> — ${r.suspension_matches} partita/e di stop`).join('\n') || 'Nessun player squalificato.';
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🚫 Squalifiche').setColor(0xe74c3c).setDescription(text)], flags: MessageFlags.Ephemeral });
      }


      if (interaction.commandName === 'pubblica_pannelli_canali') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        await publishOperationalPanels();
        return interaction.reply({ content: '✅ Pannelli pubblicati nei canali operativi.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'bilancio_club') {
        const embed = await buildClubBalanceEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'rosa_club') {
        const embed = await buildClubRosterEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'calendario_mia_squadra') {
        const embed = await buildCalendarEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }


      if (interaction.commandName === 'genera_fase_finale') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });

        const name = interaction.options.getString('competizione').trim();
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await generateFinalStageFromGroups(name);
        return interaction.editReply(`✅ Fase finale generata per **${result.comp.name}**. Qualificate: **${result.qualified.length}** • Partite create: **${result.rows.length}**.`);
      }

      if (interaction.commandName === 'staff_dashboard') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        const embed = await buildAdvancedStaffDashboard();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'carriera_player') {
        const target = interaction.options.getUser('player') || interaction.user;
        const embed = await buildCareerEmbed(target.id);
        if (!embed) return interaction.reply({ content: '❌ Player non trovato.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'controlli_sistema') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        const issues = await runSystemChecks();
        const text = issues.length ? issues.slice(0, 25).join('\n') : '✅ Nessun problema rilevato.';
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🛡️ Controlli Sistema').setColor(issues.length ? 0xe74c3c : 0x2ecc71).setDescription(text.slice(0,4096))], flags: MessageFlags.Ephemeral });
      }


      if (interaction.commandName === 'dashboard' || interaction.commandName === 'staff_dashboard') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        const embed = await buildAdvancedStaffDashboard();
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'staff' || interaction.commandName === 'pannello_staff') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ ...buildStaffPanel(), flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'budget' || interaction.commandName === 'bilancio' || interaction.commandName === 'bilancio_club') {
        const embed = await buildClubBalanceEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'rosa' || interaction.commandName === 'rosa_club') {
        const embed = await buildClubRosterEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'calendario' || interaction.commandName === 'calendario_mia_squadra') {
        const embed = await buildCalendarEmbedForUser(interaction.user.id);
        if (!embed) return interaction.reply({ content: '❌ Non appartieni a nessun club.', flags: MessageFlags.Ephemeral });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'pannelli' || interaction.commandName === 'pubblica_pannelli_canali') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!isRpcStaffMember(member)) return interaction.reply({ content: '❌ Solo staff.', flags: MessageFlags.Ephemeral });
        await publishOperationalPanels();
        return interaction.reply({ content: '✅ Pannelli pubblicati nei canali operativi.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'statistiche_player') {
        const target = interaction.options.getUser('utente');
        const { data: reg } = await supabase.from('player_registrations').select('*').eq('discord_id', target.id).maybeSingle();
        if (!reg) return interaction.reply({ content: '❌ Player non trovato.', flags: MessageFlags.Ephemeral });

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`📈 Statistiche ${reg.name}`)
              .setColor(0xd4af37)
              .addFields(
                { name: 'ID Console', value: reg.platform_id || 'N/D', inline: true },
                { name: 'Ruolo', value: reg.primary_role || 'N/D', inline: true },
                { name: 'Presenze', value: String(reg.appearances || 0), inline: true },
                { name: 'Gol', value: String(reg.goals || 0), inline: true },
                { name: 'Assist', value: String(reg.assists || 0), inline: true },
                { name: 'MVP', value: String(reg.mvp_awards || 0), inline: true },
                { name: 'Overall RPCI', value: String(reg.rpci_overall || reg.overall || 0), inline: true }
              )
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // ====== BUTTONS ======
    if (interaction.isButton()) {
      if (interaction.customId === 'player_signup_start') {
        const open = await getRegistrationOpen();
        if (!open) {
          return interaction.reply({ content: '❌ Le iscrizioni player sono chiuse.', flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({ content: 'Seleziona il tuo ruolo principale.', components: [buildPlayerRoleSelect()], flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'competition_prev' || interaction.customId === 'competition_next') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });

        const total = Math.max(1, Math.ceil((draft.teams || []).length / PER_PAGE));
        if (interaction.customId === 'competition_prev') draft.page = Math.max(0, draft.page - 1);
        else draft.page = Math.min(total - 1, draft.page + 1);

        return updateCompetitionDraft(interaction, draft);
      }

      if (interaction.customId === 'competition_cancel') {
        competitionDrafts.delete(interaction.user.id);
        return interaction.update({ content: '❌ Creazione competizione annullata.', embeds: [], components: [] });
      }

      if (interaction.customId === 'competition_confirm') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft || !draft.selectedTeamIds || draft.selectedTeamIds.length < 2) {
          return interaction.reply({ content: '❌ Seleziona almeno 2 squadre.', flags: MessageFlags.Ephemeral });
        }

        const comp = await saveCompetition(draft, interaction.user.id);
        competitionDrafts.delete(interaction.user.id);
        return interaction.update({ content: `✅ Competizione **${comp.name}** creata con **${draft.selectedTeamIds.length}** squadre.`, embeds: [], components: [] });
      }

      if (interaction.customId === 'calendar_prev' || interaction.customId === 'calendar_next') {
        const draft = calendarDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna generazione calendario in corso.', flags: MessageFlags.Ephemeral });

        const total = Math.max(1, Math.ceil((draft.competitions || []).length / PER_PAGE));
        if (interaction.customId === 'calendar_prev') draft.page = Math.max(0, draft.page - 1);
        else draft.page = Math.min(total - 1, draft.page + 1);

        return updateCalendarDraft(interaction, draft);
      }

      if (interaction.customId === 'calendar_cancel') {
        calendarDrafts.delete(interaction.user.id);
        return interaction.update({ content: '❌ Generazione calendario annullata.', embeds: [], components: [] });
      }

      if (interaction.customId === 'calendar_generate') {
        const draft = calendarDrafts.get(interaction.user.id);
        if (!draft || !draft.competitionId) return interaction.reply({ content: '❌ Seleziona una competizione.', flags: MessageFlags.Ephemeral });

        await interaction.deferUpdate();
        const result = await generateCalendar(draft.competitionId);
        calendarDrafts.delete(interaction.user.id);

        return interaction.editReply({ content: `✅ Calendario generato per **${result.competition.name}**. Partite create: **${result.matchesCreated}**.`, embeds: [], components: [] });
      }


      if (interaction.customId === 'captain_assign_prev' || interaction.customId === 'captain_assign_next') {
        const draft = captainAssignDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna assegnazione capitano in corso.', flags: MessageFlags.Ephemeral });
        }

        const totalPages = Math.max(1, Math.ceil((draft.teams || []).length / PER_PAGE));

        if (interaction.customId === 'captain_assign_prev') {
          draft.page = Math.max(0, draft.page - 1);
        } else {
          draft.page = Math.min(totalPages - 1, draft.page + 1);
        }

        return interaction.update({
          embeds: [buildCaptainAssignEmbed(draft)],
          components: [
            buildCaptainAssignTeamSelect(draft),
            buildCaptainAssignPagination(draft)
          ]
        });
      }

      if (interaction.customId === 'captain_assign_cancel') {
        captainAssignDrafts.delete(interaction.user.id);
        return interaction.update({
          content: '❌ Assegnazione capitano annullata.',
          embeds: [],
          components: []
        });
      }

      if (interaction.customId.startsWith('complete_report_')) {
        const matchId = interaction.customId.replace('complete_report_', '');
        return openReportForMatch(interaction, matchId);
      }

      if (interaction.customId === 'report_score') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.showModal(buildScoreModal());
      }

      if (interaction.customId === 'report_goal') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildReportEmbed(draft)], components: [buildStatPlayerSelect(draft, 'goal'), buildReportButtons(draft)] });
      }

      if (interaction.customId === 'report_assist') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildReportEmbed(draft)], components: [buildStatPlayerSelect(draft, 'assist'), buildReportButtons(draft)] });
      }

      if (interaction.customId === 'report_mvp') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildReportEmbed(draft)], components: [buildStatPlayerSelect(draft, 'mvp'), buildReportButtons(draft)] });
      }

      if (interaction.customId === 'report_confirm') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        if (!draft.scoreSet || !draft.presentPlayers.length) {
          return interaction.reply({ content: '❌ Inserisci risultato e presenti.', flags: MessageFlags.Ephemeral });
        }

        await submitReport(interaction, draft);
        reportDrafts.delete(interaction.user.id);

        return interaction.update({ content: '✅ Referto inviato. Le statistiche si aggiornano quando anche l’altro capitano invia un referto combaciante.', embeds: [], components: [] });
      }
    }

    // ====== SELECT MENUS ======
    if (interaction.isStringSelectMenu()) {


      if (interaction.customId === 'free_agent_primary_role_select') {
        const draft = freeAgentDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Candidatura non trovata.', flags: MessageFlags.Ephemeral });
        draft.primary_role = interaction.values[0];
        return interaction.update({
          content: `✅ Primo ruolo selezionato: **${draft.primary_role}**. Ora scegli il secondo ruolo oppure NESSUNO.`,
          components: [buildFreeAgentRoleSelect('free_agent_secondary_role_select', true, draft.primary_role)]
        });
      }

      if (interaction.customId === 'free_agent_secondary_role_select') {
        const draft = freeAgentDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Candidatura non trovata.', flags: MessageFlags.Ephemeral });
        draft.secondary_role = interaction.values[0];

        let { data: reg } = await supabase.from('player_registrations').select('*').eq('discord_id', interaction.user.id).maybeSingle();
        if (!reg) {
          const { data: newReg } = await supabase.from('player_registrations').insert({
            discord_id: interaction.user.id,
            discord_tag: interaction.user.tag,
            name: draft.name,
            age: draft.age,
            platform: draft.platform,
            platform_id: draft.platform_id,
            overall: 0,
            rpci_overall: 0,
            primary_role: draft.primary_role,
            status: 'free_agent'
          }).select().single();
          reg = newReg;
        }

        const { data: profile, error } = await supabase.from('free_agent_profiles').insert({
          discord_id: interaction.user.id,
          discord_tag: interaction.user.tag,
          player_registration_id: reg?.id || null,
          name: draft.name,
          age: draft.age,
          platform: draft.platform,
          platform_id: draft.platform_id,
          primary_role: draft.primary_role,
          secondary_role: draft.secondary_role || 'NO',
          rpci_overall: reg?.rpci_overall || reg?.overall || 0,
          status: 'open',
          reason: 'Candidatura Free Agent'
        }).select().single();

        if (error) throw error;

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => null);
        }

        await publishFreeAgent(profile);
        freeAgentDrafts.delete(interaction.user.id);

        return interaction.update({
          content: '✅ Candidatura Free Agent pubblicata correttamente.',
          components: []
        });
      }

      if (interaction.customId === 'captain_assign_team_select') {
        const draft = captainAssignDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna assegnazione capitano in corso.', flags: MessageFlags.Ephemeral });
        }

        const team = draft.teams.find(item => item.id === interaction.values[0]);

        if (!team) {
          return interaction.reply({ content: '❌ Squadra non valida.', flags: MessageFlags.Ephemeral });
        }

        const players = await getCaptainAssignablePlayers(team.id);

        if (!players.length) {
          return interaction.reply({ content: '❌ Questa squadra non ha player assegnati.', flags: MessageFlags.Ephemeral });
        }

        draft.selectedTeam = team;
        draft.players = players;

        return interaction.update({
          embeds: [buildCaptainAssignEmbed(draft)],
          components: [buildCaptainAssignPlayerSelect(draft)]
        });
      }

      if (interaction.customId === 'captain_assign_player_select') {
        const draft = captainAssignDrafts.get(interaction.user.id);
        if (!draft || !draft.selectedTeam) {
          return interaction.reply({ content: '❌ Nessuna squadra selezionata.', flags: MessageFlags.Ephemeral });
        }

        const selectedDiscordId = interaction.values[0];
        const player = draft.players.find(row => row.discord_id === selectedDiscordId);

        if (!player) {
          return interaction.reply({ content: '❌ Player non valido.', flags: MessageFlags.Ephemeral });
        }

        const member = await assignCaptainToTeam(interaction.guild, draft.selectedTeam, selectedDiscordId);

        captainAssignDrafts.delete(interaction.user.id);

        return interaction.update({
          content:
            `✅ Capitano assegnato correttamente.\n\n` +
            `Squadra: **${draft.selectedTeam.name}**\n` +
            `Nuovo capitano: <@${selectedDiscordId}> (${member.user.tag})`,
          embeds: [],
          components: []
        });
      }

      if (interaction.customId === 'player_signup_role_select') {
        const role = interaction.values[0];
        playerRegistrationDrafts.set(interaction.user.id, { primary_role: role });
        return interaction.showModal(buildPlayerDataModal());
      }


      if (interaction.customId === 'competition_mode_select') {
        const mode = interaction.values[0];

        if (mode === 'club') {
          competitionDrafts.set(interaction.user.id, { mode });
          return interaction.update({
            content: '🏟️ Modalità Club selezionata. Ora scegli il tipo di competizione.',
            components: [buildCompetitionTypeSelect()]
          });
        }

        if (mode === 'national') {
          competitionDrafts.set(interaction.user.id, { mode });
          return interaction.update({
            content: '🌍 Modalità Nazionale selezionata. Ora scegli il tipo di competizione.',
            components: [buildNationalCompetitionTypeSelect()]
          });
        }

        return interaction.reply({ content: '❌ Modalità non valida.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'national_competition_type_select') {
        const existing = competitionDrafts.get(interaction.user.id) || {};
        existing.mode = 'national';
        competitionDrafts.set(interaction.user.id, existing);
        return openCompetitionModal(interaction, interaction.values[0]);
      }

      if (interaction.customId === 'competition_type_select') {
        const existing = competitionDrafts.get(interaction.user.id) || {};
        existing.mode = 'club';
        competitionDrafts.set(interaction.user.id, existing);
        return openCompetitionModal(interaction, interaction.values[0]);
      }

      if (interaction.customId === 'competition_team_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });

        for (const id of interaction.values) {
          if (!draft.selectedTeamIds.includes(id)) draft.selectedTeamIds.push(id);
        }

        return updateCompetitionDraft(interaction, draft);
      }

      if (interaction.customId === 'calendar_comp_select') {
        const draft = calendarDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna generazione calendario in corso.', flags: MessageFlags.Ephemeral });

        const id = interaction.values[0];
        const comp = draft.competitions.find(c => c.id === id);
        draft.competitionId = id;
        draft.selectedCompetition = comp;

        return updateCalendarDraft(interaction, draft);
      }

      if (interaction.customId === 'report_match_select') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });

        const match = draft.matches.find(m => m.id === interaction.values[0]);
        if (!match) return interaction.reply({ content: '❌ Partita non valida.', flags: MessageFlags.Ephemeral });

        const roster = await getRosterByDraftTeamId(draft.team.id);
        if (!roster.length) return interaction.reply({ content: '❌ Rosa non trovata.', flags: MessageFlags.Ephemeral });

        draft.matchId = match.id;
        draft.match = match;
        draft.matchLabel = `${match.home_team_name} vs ${match.away_team_name}`;
        draft.roster = roster;
        draft.presentPlayers = [];
        draft.goals = [];
        draft.assists = [];
        draft.mvpPlayerId = null;

        return interaction.update({ embeds: [buildReportEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'report_present_select') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });

        const blocked = [];
        for (const assignId of interaction.values) {
          const row = draft.roster.find(r => r.id === assignId);
          if (row && await isPlayerSuspended(row.discord_id)) blocked.push(row);
        }
        if (blocked.length) {
          return interaction.reply({ content: `❌ Uno o più player sono squalificati e non possono giocare: ${blocked.map(b => `<@${b.discord_id}>`).join(', ')}`, flags: MessageFlags.Ephemeral });
        }
        draft.presentPlayers = interaction.values;
        return interaction.update({ embeds: [buildReportEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'report_goal_player_select') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.pendingStatPlayerId = interaction.values[0];
        return interaction.showModal(buildCountModal('report_goal_count_modal', 'Gol giocatore', 'Numero gol'));
      }

      if (interaction.customId === 'report_assist_player_select') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.pendingStatPlayerId = interaction.values[0];
        return interaction.showModal(buildCountModal('report_assist_count_modal', 'Assist giocatore', 'Numero assist'));
      }

      if (interaction.customId === 'report_mvp_player_select') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.mvpPlayerId = interaction.values[0];
        return interaction.update({ embeds: [buildReportEmbed(draft)], components: buildReportComponents(draft) });
      }
    }

    // ====== MODALS ======
    if (interaction.isModalSubmit()) {

      if (interaction.customId === 'free_agent_apply_modal') {
        const age = Number(interaction.fields.getTextInputValue('age').trim());
        const platform = interaction.fields.getTextInputValue('platform').trim().toUpperCase();

        if (!Number.isInteger(age) || age < 13 || age > 60) {
          return interaction.reply({ content: '❌ Età non valida.', flags: MessageFlags.Ephemeral });
        }
        if (!['PS5', 'XBOX', 'PC'].includes(platform)) {
          return interaction.reply({ content: '❌ Console valida: PS5, XBOX oppure PC.', flags: MessageFlags.Ephemeral });
        }

        freeAgentDrafts.set(interaction.user.id, {
          name: interaction.fields.getTextInputValue('name').trim(),
          age,
          platform,
          platform_id: interaction.fields.getTextInputValue('platform_id').trim(),
          primary_role: null,
          secondary_role: null
        });

        return interaction.reply({
          content: '✅ Dati ricevuti. Ora scegli il primo ruolo.',
          components: [buildFreeAgentRoleSelect('free_agent_primary_role_select')],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId.startsWith('fa_agreement_years_modal_')) {
        const profileId = interaction.customId.replace('fa_agreement_years_modal_', '');
        const years = Number(interaction.fields.getTextInputValue('years').trim());

        if (![1, 2, 3].includes(years)) {
          return interaction.reply({ content: '❌ Gli anni contratto possono essere solo 1, 2 o 3.', flags: MessageFlags.Ephemeral });
        }

        return completeFreeAgentAgreement(interaction, profileId, years);
      }

      if (interaction.customId === 'player_signup_data_modal') {
        const draft = playerRegistrationDrafts.get(interaction.user.id);
        if (!draft?.primary_role) {
          return interaction.reply({ content: '❌ Ruolo non selezionato. Ricomincia l’iscrizione.', flags: MessageFlags.Ephemeral });
        }

        const age = Number(interaction.fields.getTextInputValue('age').trim());
        const platform = interaction.fields.getTextInputValue('platform').trim().toUpperCase();
        const name = interaction.fields.getTextInputValue('name').trim();
        const platformId = interaction.fields.getTextInputValue('platform_id').trim();

        if (!Number.isInteger(age) || age < 13 || age > 60) return interaction.reply({ content: '❌ Età non valida.', flags: MessageFlags.Ephemeral });
        if (!['PS5', 'XBOX', 'PC'].includes(platform)) return interaction.reply({ content: '❌ Console valida: PS5, XBOX oppure PC.', flags: MessageFlags.Ephemeral });
        if (!platformId || platformId.length < 2) return interaction.reply({ content: '❌ ID console non valido.', flags: MessageFlags.Ephemeral });

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member) {
          await member.roles.add(PLAYER_ROLE_ID).catch(() => null);

          const fcRoleId = FC_ROLE_IDS[draft.primary_role];
          if (fcRoleId) {
            await member.roles.add(fcRoleId).catch(console.error);
          }
        }

        const { error } = await supabase.from('player_registrations').upsert({
          discord_id: interaction.user.id,
          discord_tag: interaction.user.tag,
          name,
          age,
          platform,
          platform_id: platformId,
          overall: 0,
          rpci_overall: 0,
          primary_role: draft.primary_role,
          status: 'registered',
          updated_at: new Date().toISOString()
        }, { onConflict: 'discord_id' });

        if (error) throw error;
        playerRegistrationDrafts.delete(interaction.user.id);

        return interaction.reply({
          content: `✅ Iscrizione completata!\nRuolo: **${draft.primary_role} - ${ROLE_LABELS[draft.primary_role]}**\nID Console: **${platformId}**\nOverall RPCI iniziale: **0**`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId.startsWith('competition_modal_')) {
        const type = interaction.customId.replace('competition_modal_', '');
        const modeForTeams = (competitionDrafts.get(interaction.user.id)?.mode) || (type === 'world_cup' || type === 'euro' ? 'national' : 'club');
        const teams = await getDraftTeamsByMode(modeForTeams);
        if (teams.length < 2) {
          return interaction.reply({ content: '❌ Devi prima creare/sorteggiare almeno 2 squadre.', flags: MessageFlags.Ephemeral });
        }

        const rawLogo = interaction.fields.getTextInputValue('logo_url')?.trim();
        const previousDraft = competitionDrafts.get(interaction.user.id) || {};
        const draft = {
          mode: previousDraft.mode || (type === 'world_cup' || type === 'euro' ? 'national' : 'club'),
          type,
          name: interaction.fields.getTextInputValue('name').trim(),
          season: interaction.fields.getTextInputValue('season').trim(),
          logoUrl: rawLogo && rawLogo.toUpperCase() !== 'NO' ? rawLogo : null,
          nation: interaction.fields.getTextInputValue('nation')?.trim() || null,
          settings: parseSettings(type, interaction.fields.getTextInputValue('settings')?.trim()),
          teams,
          selectedTeamIds: [],
          page: 0
        };

        competitionDrafts.set(interaction.user.id, draft);

        return interaction.reply({
          embeds: [buildCompetitionEmbed(draft)],
          components: [buildCompetitionTeamSelect(draft), buildCompetitionButtons(draft)],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'report_score_modal') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });

        const gf = Number(interaction.fields.getTextInputValue('goals_for').trim());
        const ga = Number(interaction.fields.getTextInputValue('goals_against').trim());

        if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0) {
          return interaction.reply({ content: '❌ Risultato non valido.', flags: MessageFlags.Ephemeral });
        }

        draft.goalsFor = gf;
        draft.goalsAgainst = ga;
        draft.scoreSet = true;

        return interaction.update({ embeds: [buildReportEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'report_goal_count_modal' || interaction.customId === 'report_assist_count_modal') {
        const draft = reportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });

        const count = Number(interaction.fields.getTextInputValue('count').trim());
        if (!Number.isInteger(count) || count <= 0 || count > 20) {
          return interaction.reply({ content: '❌ Numero non valido.', flags: MessageFlags.Ephemeral });
        }

        const player = draft.roster.find(p => p.id === draft.pendingStatPlayerId);
        if (!player) return interaction.reply({ content: '❌ Player non valido.', flags: MessageFlags.Ephemeral });

        const row = {
          playerId: player.id,
          platformId: player.platform_id || player.player_registrations?.platform_id || player.discord_tag || 'Player',
          count
        };

        if (interaction.customId === 'report_goal_count_modal') draft.goals.push(row);
        else draft.assists.push(row);

        draft.pendingStatPlayerId = null;

        return interaction.update({ embeds: [buildReportEmbed(draft)], components: buildReportComponents(draft) });
      }
    }
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(`❌ Errore interno: ${error.message}`);
    }
    return interaction.reply({ content: `❌ Errore interno: ${error.message}`, flags: MessageFlags.Ephemeral });
  }
});

// Blocca messaggi normali nei canali operativi principali
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const protectedChannels = [
    PLAYER_REGISTRATION_CHANNEL_ID,
    MATCH_REPORTS_CHANNEL_ID,
    MATCH_RESULTS_CHANNEL_ID,
    APPEALS_CHANNEL_ID,
    BOT_LOG_CHANNEL_ID,
    FREE_AGENT_CHANNEL_ID,
    CONTRACT_DEPOSIT_CHANNEL_ID,
    FREE_AGENT_ARCHIVE_CHANNEL_ID,
    BALANCE_CHANNEL_ID,
    ROSTERS_CHANNEL_ID,
    CALENDAR_CHANNEL_ID,
    SEASON_AWARDS_CHANNEL_ID
  ];

  if (protectedChannels.includes(message.channelId)) {
    await message.delete().catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN);
