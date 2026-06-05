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

const PLAYER_REGISTRATION_CHANNEL_ID = process.env.PLAYER_REGISTRATION_CHANNEL_ID || '1507746191528562778';
const MATCH_REPORTS_CHANNEL_ID = '1507742878313746443';
const MATCH_RESULTS_CHANNEL_ID = '1507742819920379974';
const APPEALS_CHANNEL_ID = '1507742936618500116';
const BOT_LOG_CHANNEL_ID = '1507744280733683724';

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
,
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
    .setName('statistiche_player')
    .setDescription('Mostra statistiche di un player')
    .addUserOption(o =>
      o.setName('utente')
        .setDescription('Player')
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrazione slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registrate!');
  } catch (error) {
    console.error('❌ Errore registrazione slash commands:', error);
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

  return new EmbedBuilder()
    .setTitle('📝 Referto partita')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Partita', value: draft.matchLabel || 'Non selezionata', inline: false },
      { name: 'Risultato', value: draft.scoreSet ? `${draft.goalsFor} - ${draft.goalsAgainst}` : 'Non inserito', inline: true },
      { name: 'Presenti', value: draft.presentPlayers.length ? `${draft.presentPlayers.length} player` : 'Non selezionati', inline: true },
      { name: 'MVP', value: mvp, inline: true },
      { name: 'Gol', value: goalsText.slice(0, 1024), inline: false },
      { name: 'Assist', value: assistsText.slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'Statistiche aggiornate solo se i due referti combaciano' })
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
    new ButtonBuilder().setCustomId('report_goal').setLabel('AGGIUNGI GOL').setStyle(ButtonStyle.Success).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_assist').setLabel('AGGIUNGI ASSIST').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_mvp').setLabel('MVP').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('report_confirm').setLabel('CONFERMA').setStyle(ButtonStyle.Danger).setDisabled(!draft.scoreSet || !draft.presentPlayers.length)
  );
}

function buildReportComponents(draft) {
  const components = [];
  if (!draft.matchId) return components;
  if (!draft.presentPlayers.length) components.push(buildPresentSelect(draft));
  components.push(buildReportButtons(draft));
  return components;
}

function buildStatPlayerSelect(draft, mode) {
  const roster = draft.roster.filter(r => draft.presentPlayers.includes(r.id));
  let customId = 'report_goal_player_select';
  let placeholder = 'Seleziona marcatore';
  if (mode === 'assist') { customId = 'report_assist_player_select'; placeholder = 'Seleziona assistman'; }
  if (mode === 'mvp') { customId = 'report_mvp_player_select'; placeholder = 'Seleziona MVP'; }

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

    await supabase.from('matches').update({
      status: 'confirmed',
      home_goals: s1.home,
      away_goals: s1.away,
      confirmed_at: new Date().toISOString()
    }).eq('id', matchId);

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

  return bonus;
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
        if (!isStaff(member)) {
          return interaction.reply({ content: '❌ Solo lo staff può generare calendari.', flags: MessageFlags.Ephemeral });
        }

        const competitions = await getCalendarCompetitions();
        if (!competitions.length) {
          return interaction.reply({ content: '❌ Nessuna competizione disponibile.', flags: MessageFlags.Ephemeral });
        }

        calendarDrafts.set(interaction.user.id, { competitions, page: 0, competitionId: null, selectedCompetition: null });
        const draft = calendarDrafts.get(interaction.user.id);

        return interaction.reply({ embeds: [buildCalendarEmbed(draft)], components: [buildCalendarSelect(draft), buildCalendarButtons(draft)], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'referto') {
        if (interaction.channelId !== MATCH_REPORTS_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa /referto solo nel canale referti.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono compilare referti.', flags: MessageFlags.Ephemeral });
        }

        const { team, matches } = await getCaptainMatches(interaction.user.id);
        if (!team) return interaction.reply({ content: '❌ Non trovo una squadra collegata a te come capitano.', flags: MessageFlags.Ephemeral });
        if (!matches.length) return interaction.reply({ content: '❌ Non ci sono partite da refertare.', flags: MessageFlags.Ephemeral });

        reportDrafts.set(interaction.user.id, {
          team,
          matches,
          matchId: null,
          match: null,
          matchLabel: null,
          roster: [],
          presentPlayers: [],
          scoreSet: false,
          goalsFor: null,
          goalsAgainst: null,
          goals: [],
          assists: [],
          mvpPlayerId: null,
          pendingStatPlayerId: null
        });

        return interaction.reply({
          embeds: [new EmbedBuilder().setTitle('📝 Seleziona partita').setColor(0xd4af37)],
          components: [buildMatchSelect(matches, team.id)],
          flags: MessageFlags.Ephemeral
        });
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

        return interaction.reply({
          content:
            `✅ Competizione **${comp.name}** chiusa.\n` +
            `🏆 Vincitore: **${winner.name}**\n` +
            `Bonus assegnato a tutti i player della squadra: **+${bonus} Overall RPCI**.`,
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
    BOT_LOG_CHANNEL_ID
  ];

  if (protectedChannels.includes(message.channelId)) {
    await message.delete().catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN);
