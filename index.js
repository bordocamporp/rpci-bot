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
  MessageFlags
} = require('discord.js');

const { createClient } = require('@supabase/supabase-js');

const ALLOWED_REGISTRATION_CHANNEL_ID = '1507746191528562778';
const STAFF_CHANNEL_ID = '1507744124512768050';
const CAPTAIN_ROLE_ID = '1507736309282635817';
const PLAYER_ROLE_ID = '1507740330299228161';

const OFFERS_CHANNEL_ID = '1507741111118987375';
const TRANSFER_LOG_CHANNEL_ID = '1507741237900214332';
const FREE_AGENT_ROLE_ID = '1507736959009820813';
const FREE_AGENT_CHANNEL_ID = '1507741035999264779';
const CONTRACTS_CHANNEL_ID = '1507741459993071627';
const PLAYER_LOOKING_CHANNEL_ID = '1508019683230486669';
const TEAM_LOOKING_CHANNEL_ID = '1508020017856512030';
const TRANSFER_REQUEST_CHANNEL_ID = '1507741180212023509';
const MATCH_REPORTS_CHANNEL_ID = '1507742878313746443';
const MATCH_RESULTS_CHANNEL_ID = '1507742819920379974';
const APPEALS_CHANNEL_ID = '1507742936618500116';
const BOT_LOG_CHANNEL_ID = '1507744280733683724';


const CLUBS_PER_PAGE = 25;
const PLAYERS_PER_PAGE = 25;
const COMPETITION_CLUBS_PER_PAGE = 25;

const drafts = new Map();
const offerDrafts = new Map();
const competitionDrafts = new Map();
const calendarDrafts = new Map();
const contractDrafts = new Map();
const lookingDrafts = new Map();
const teamSearchDrafts = new Map();
const transferRequestDrafts = new Map();
const matchReportDrafts = new Map();

const BASE_CLUB_BUDGET = 150;
const TIER_SALARIES = {
  ROOKIE: 2,
  BASSA: 5,
  MEDIA: 10,
  ALTA: 18,
  TOP: 30,
  LEGGENDA: 45
};

const TIER_RANGES = [
  { tier: 'ROOKIE', min: 0, max: 15 },
  { tier: 'BASSA', min: 16, max: 40 },
  { tier: 'MEDIA', min: 41, max: 90 },
  { tier: 'ALTA', min: 91, max: 170 },
  { tier: 'TOP', min: 171, max: 300 },
  { tier: 'LEGGENDA', min: 301, max: Infinity }
];

const POTENTIAL_MULTIPLIERS = {
  LOW: 1,
  MEDIUM: 1.1,
  HIGH: 1.2,
  ELITE: 1.5
};

const DEFENSIVE_ROLES = ['POR', 'DC', 'TD', 'TS', 'CDC'];

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

const commands = [
  new SlashCommandBuilder()
    .setName('registrati')
    .setDescription('Registra il tuo profilo RPCI')
    .addStringOption(option =>
      option
        .setName('ea_id')
        .setDescription('Il tuo EA ID')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('ruolo')
        .setDescription('Ruolo principale')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('avvia_iscrizioni')
    .setDescription('Pubblica il pannello ufficiale per iscrivere le squadre RPCI'),

  new SlashCommandBuilder()
    .setName('offerta')
    .setDescription('Crea una offerta di trasferimento'),

  new SlashCommandBuilder()
    .setName('deposita_contratto')
    .setDescription('Deposita un contratto per un giocatore free agent'),

  new SlashCommandBuilder()
    .setName('cerco_squadra')
    .setDescription('Pubblica una scheda per cercare squadra'),

  new SlashCommandBuilder()
    .setName('squadra_cerca')
    .setDescription('Pubblica un annuncio squadra cerca player'),

  new SlashCommandBuilder()
    .setName('richiesta_trasferimento')
    .setDescription('Comunica la tua intenzione di lasciare il club attuale'),

  new SlashCommandBuilder()
    .setName('referto')
    .setDescription('Compila il referto della partita disputata'),

  new SlashCommandBuilder()
    .setName('budget')
    .setDescription('Mostra il budget della tua squadra'),

  new SlashCommandBuilder()
    .setName('calcola_stipendio')
    .setDescription('Calcola lo stipendio in base alla fascia')
    .addStringOption(option =>
      option
        .setName('fascia')
        .setDescription('Fascia player')
        .setRequired(true)
        .addChoices(
          { name: 'ROOKIE', value: 'ROOKIE' },
          { name: 'BASSA', value: 'BASSA' },
          { name: 'MEDIA', value: 'MEDIA' },
          { name: 'ALTA', value: 'ALTA' },
          { name: 'TOP', value: 'TOP' },
          { name: 'LEGGENDA', value: 'LEGGENDA' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('anni')
        .setDescription('Anni di contratto')
        .setRequired(true)
        .addChoices(
          { name: '1 anno', value: 1 },
          { name: '2 anni', value: 2 },
          { name: '3 anni', value: 3 }
        )
    ),

  new SlashCommandBuilder()
    .setName('imposta_budget')
    .setDescription('Staff: imposta il budget di una squadra')
    .addStringOption(option =>
      option
        .setName('club')
        .setDescription('Nome esatto del club')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('budget')
        .setDescription('Budget stagionale in crediti')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('aggiorna_statistiche')
    .setDescription('Staff: aggiorna statistiche RPCI di un player')
    .addUserOption(option =>
      option
        .setName('player')
        .setDescription('Player da aggiornare')
        .setRequired(true)
    )
    .addIntegerOption(option => option.setName('presenze').setDescription('Presenze totali').setRequired(false))
    .addIntegerOption(option => option.setName('gol').setDescription('Gol totali').setRequired(false))
    .addIntegerOption(option => option.setName('assist').setDescription('Assist totali').setRequired(false))
    .addIntegerOption(option => option.setName('clean_sheet').setDescription('Clean sheet totali').setRequired(false))
    .addIntegerOption(option => option.setName('mvp').setDescription('MVP totali').setRequired(false))
    .addStringOption(option =>
      option
        .setName('potenziale')
        .setDescription('Potenziale crescita')
        .setRequired(false)
        .addChoices(
          { name: 'LOW', value: 'LOW' },
          { name: 'MEDIUM', value: 'MEDIUM' },
          { name: 'HIGH', value: 'HIGH' },
          { name: 'ELITE', value: 'ELITE' }
        )
    ),

  new SlashCommandBuilder()
    .setName('crea_competizione')
    .setDescription('Staff: crea una competizione e seleziona le squadre partecipanti'),

  new SlashCommandBuilder()
    .setName('genera_calendario')
    .setDescription('Staff: genera automaticamente calendario/gironi/tabellone della competizione'),

  new SlashCommandBuilder()
    .setName('aggiorna_fasce')
    .setDescription('Staff: ricalcola fasce e stipendi in base alle statistiche RPCI')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registrazione slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ Slash commands registrate!');
  } catch (error) {
    console.error('❌ Errore registrazione slash commands:', error);
  }
})();

client.once('clientReady', async () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  if (guild) {
    await processExpiredContracts(guild);
    setInterval(() => {
      processExpiredContracts(guild).catch(console.error);
    }, 60 * 60 * 1000);
  }
});

async function getOrCreateUserAndPlayer(discordUser, eaId = null, ruolo = null) {
  let { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', discordUser.id)
    .single();

  if (!user) {
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        discord_id: discordUser.id,
        discord_username: discordUser.username
      })
      .select()
      .single();

    if (error) throw error;
    user = newUser;
  }

  let { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!player && eaId && ruolo) {
    const { data: newPlayer, error } = await supabase
      .from('players')
      .insert({
        user_id: user.id,
        ea_id: eaId,
        main_role: ruolo,
        status: 'free_agent'
      })
      .select()
      .single();

    if (error) throw error;
    player = newPlayer;
  }

  return { user, player };
}

function buildPanel() {
  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setAuthor({
      name: 'RPCI • Real Pro Clubs Italia'
    })
    .setTitle('🏆 ISCRIZIONI UFFICIALI RPCI')
    .setDescription(
      'Benvenuto nel sistema ufficiale iscrizioni di **RPCI**.\n\n' +

      '📋 **Cosa può fare il capitano:**\n' +
      '• Registrare la propria squadra\n' +
      '• Caricare il logo ufficiale in PNG\n' +
      '• Selezionare i giocatori in rosa\n' +
      '• Inserire i dati dei player\n' +
      '• Impostare la durata dei contratti\n\n' +

      '⚠️ **Requisiti obbligatori:**\n' +
      '• Minimo 5 giocatori\n' +
      '• Massimo 20 giocatori\n' +
      '• Logo squadra in formato PNG\n' +
      '• Conferma obbligatoria dei player\n\n' +

      'Premi il pulsante qui sotto per iniziare l’iscrizione.'
    )
    .setFooter({
      text: 'RPCI • Sistema iscrizioni ufficiale'
    })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('start_registration')
    .setLabel('ISCRIVI SQUADRA')
    .setEmoji('🏆')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(button)
    ]
  };
}

function buildRosterSelect() {
  const options = [];

  for (let i = 1; i <= 20; i++) {
    options.push({
      label: `${i} giocatori in rosa`,
      value: String(i),
      description: `Iscrivi ${i} giocatori`
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('roster_select')
    .setPlaceholder('Giocatori in rosa')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}


const GAME_ROLES = [
  'POR',
  'TD',
  'DC',
  'TS',
  'CDC',
  'CC',
  'COC',
  'ES',
  'ED',
  'AS',
  'AD',
  'ATT'
];

function buildPrimaryRoleSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('primary_role_select')
      .setPlaceholder('Seleziona RUOLO PRINCIPALE')
      .addOptions(
        GAME_ROLES.map(role => ({
          label: role,
          value: role,
          description: `Ruolo principale: ${role}`
        }))
      )
  );
}

function buildSecondaryRoleSelect(primaryRole = null) {
  const secondaryOptions = [
    {
      label: 'NO',
      value: 'NO',
      description: 'Nessun ruolo secondario'
    },
    ...GAME_ROLES
      .filter(role => role !== primaryRole)
      .map(role => ({
        label: role,
        value: role,
        description: `Ruolo secondario: ${role}`
      }))
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('secondary_role_select')
      .setPlaceholder('Seleziona RUOLO SECONDARIO')
      .addOptions(secondaryOptions)
  );
}

async function completePendingRegistrationPlayer(interaction, draft) {
  if (!draft.pendingPlayer) {
    return interaction.reply({
      content: '❌ Nessun giocatore in attesa di ruolo.',
      flags: MessageFlags.Ephemeral
    });
  }

  draft.players.push(draft.pendingPlayer);
  draft.pendingPlayer = null;

  if (draft.players.length < draft.rosterSize) {
    return interaction.update({
      content:
        `✅ Giocatore inserito con ruoli.\n\n` +
        `Progresso: **${draft.players.length}/${draft.rosterSize}**\n` +
        `Mancano **${draft.rosterSize - draft.players.length}** giocatori.`,
      components: [
        buildAddPlayerButton(draft)
      ]
    });
  }

  await interaction.update({
    content: '✅ Tutti i giocatori sono stati inseriti. Invio iscrizione allo staff...',
    components: []
  });

  await finalizeApplication(interaction, draft);

  return interaction.followUp({
    content:
      '✅ Iscrizione squadra inviata correttamente allo staff.\n\n' +
      'I giocatori riceveranno la conferma in privato.',
    flags: MessageFlags.Ephemeral
  });
}

function buildAddPlayerButton(draft) {
  const next = draft.players.length + 1;

  const button = new ButtonBuilder()
    .setCustomId('add_player')
    .setLabel(`INSERISCI GIOCATORE ${next}/${draft.rosterSize}`)
    .setStyle(ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(button);
}

function buildStaffEmbed(clubName, players, captainDiscordId, logoUrl = null) {
  const list = players.map((player, index) => {
    const icon =
      player.response_status === 'accepted' ? '✅' :
      player.response_status === 'rejected' ? '❌' :
      '⌛';

    return `${icon} **${index + 1}.** <@${player.discord_id}> | Età: ${player.age} | Ruolo: ${player.primary_role || 'N/D'} | Secondario: ${player.secondary_role || 'NO'} | ${player.platform}: ${player.platform_id || 'N/D'} | Contratto: ${player.contract_years} anno/i`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 Nuova richiesta iscrizione squadra')
    .setColor(0xd4af37)
    .addFields(
      {
        name: 'Squadra',
        value: clubName
      },
      {
        name: 'Capitano',
        value: `<@${captainDiscordId}>`
      },
      {
        name: 'Stato giocatori',
        value: list || 'Nessun giocatore inserito'
      }
    )
    .setTimestamp();

  if (logoUrl) {
    embed.setThumbnail(logoUrl);
  }

  return embed;
}

async function updateStaffMessage(applicationId) {
  const { data: app } = await supabase
    .from('club_applications')
    .select('*, clubs(name, logo_url)')
    .eq('id', applicationId)
    .single();

  if (!app || !app.staff_message_id) return;

  const { data: players } = await supabase
    .from('club_application_players')
    .select('*')
    .eq('application_id', applicationId)
    .order('created_at');

  const channel = await client.channels.fetch(STAFF_CHANNEL_ID);
  const message = await channel.messages.fetch(app.staff_message_id);

  await message.edit({
    embeds: [
      buildStaffEmbed(
        app.clubs.name,
        players,
        app.captain_discord_id,
        app.clubs.logo_url
      )
    ],
    components: message.components
  });
}

async function finalizeApplication(interaction, draft) {
  const shortName = draft.teamName
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 5)
    .toUpperCase();

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .insert({
      name: draft.teamName,
      short_name: shortName,
      logo_url: draft.logoUrl,
      status: 'pending',
      captain_player_id: draft.captainPlayerId
    })
    .select()
    .single();

  if (clubError) throw clubError;

  const { data: application, error: appError } = await supabase
    .from('club_applications')
    .insert({
      club_id: club.id,
      captain_player_id: draft.captainPlayerId,
      captain_discord_id: draft.captainDiscordId,
      roster_size: draft.rosterSize,
      status: 'pending'
    })
    .select()
    .single();

  if (appError) throw appError;

  const playersToInsert = draft.players.map(player => ({
    application_id: application.id,
    discord_id: player.discord_id,
    age: player.age,
    platform: player.platform,
    platform_id: player.platform_id,
    primary_role: player.primary_role,
    secondary_role: player.secondary_role,
    contract_years: player.contract_years,
response_status: 'pending'
  }));

  const { data: insertedPlayers, error: playersError } = await supabase
    .from('club_application_players')
    .insert(playersToInsert)
    .select();

  if (playersError) throw playersError;

  for (const player of insertedPlayers) {
    const user = await client.users.fetch(player.discord_id).catch(() => null);

    if (user) {
      const accept = new ButtonBuilder()
        .setCustomId(`player_accept_${player.id}`)
        .setLabel('ACCETTA')
        .setStyle(ButtonStyle.Success);

      const reject = new ButtonBuilder()
        .setCustomId(`player_reject_${player.id}`)
        .setLabel('RIFIUTA')
        .setStyle(ButtonStyle.Danger);

      await user.send({
        content:
          `📋 Sei stato inserito nell’iscrizione della squadra **${draft.teamName}**.\n\n` +
          `Età: ${player.age}\n` +
          `Console: ${player.platform}\n` +
          `ID ${player.platform}: ${player.platform_id || 'N/D'}\n` +
          `Contratto: ${player.contract_years} anno/i\n\n` +
          `Accetti l’iscrizione?`,
        components: [
          new ActionRowBuilder().addComponents(accept, reject)
        ]
      }).catch(() => null);
    }
  }

  const staffChannel = await client.channels.fetch(STAFF_CHANNEL_ID);

  const staffAccept = new ButtonBuilder()
    .setCustomId(`staff_accept_${application.id}`)
    .setLabel('ACCETTA ISCRIZIONE')
    .setStyle(ButtonStyle.Success);

  const staffReject = new ButtonBuilder()
    .setCustomId(`staff_reject_${application.id}`)
    .setLabel('RIFIUTA ISCRIZIONE')
    .setStyle(ButtonStyle.Danger);

  const staffMessage = await staffChannel.send({
    embeds: [
      buildStaffEmbed(
        draft.teamName,
        insertedPlayers,
        draft.captainDiscordId,
        draft.logoUrl
      )
    ],
    components: [
      new ActionRowBuilder().addComponents(staffAccept, staffReject)
    ]
  });

  await supabase
    .from('club_applications')
    .update({
      staff_message_id: staffMessage.id
    })
    .eq('id', application.id);

  drafts.delete(interaction.user.id);
}

async function getApprovedClubs() {
  const { data, error } = await supabase
    .from('clubs')
    .select('id, name, short_name, logo_url, status')
    .eq('status', 'approved')
    .order('name', { ascending: true });

  if (error || !data) return [];
  return data;
}

async function getClubRoster(clubId) {
  const { data: applications, error: appError } = await supabase
    .from('club_applications')
    .select('id, club_id, status')
    .eq('club_id', clubId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1);

  if (appError || !applications || applications.length === 0) return [];

  const applicationId = applications[0].id;

  const { data: players, error: playersError } = await supabase
    .from('club_application_players')
    .select('*')
    .eq('application_id', applicationId)
    .eq('response_status', 'accepted')
    .order('created_at', { ascending: true });

  if (playersError || !players) return [];
  return players;
}

function buildOfferEmbed(offer) {
  return new EmbedBuilder()
    .setTitle('📨 Nuova offerta di trasferimento')
    .setColor(0x3498db)
    .addFields(
      { name: 'Club offerente', value: offer.fromClubName },
      { name: 'Club del giocatore', value: offer.targetClubName },
      { name: 'Capitano', value: `<@${offer.captainDiscordId}>` },
      { name: 'Giocatore', value: `${offer.platformId} (${offer.platform})` },
      { name: 'Contratto', value: `${offer.contractYears} anno/i` },
      { name: 'Prezzo acquisto squadra', value: `${offer.transferFee || 0} crediti` },
      { name: 'Stipendio player', value: `${offer.salary || 0} crediti/anno` },
      {
        name: 'Scadenza risposta',
        value: '24 ore. Se il giocatore non risponde, l’offerta viene accettata automaticamente.'
      }
    )
    .setTimestamp();
}

function buildOfferPanelEmbed(draft) {
  return new EmbedBuilder()
    .setTitle('💼 Crea offerta di trasferimento')
    .setColor(0xd4af37)
    .setDescription(
      'Segui i passaggi:\n\n' +
      '1. Seleziona la squadra partecipante\n' +
      '2. Seleziona il giocatore dalla rosa\n' +
      '3. Seleziona gli anni di contratto\n' +
      '4. Conferma l’offerta'
    )
    .addFields(
      {
        name: 'Squadra selezionata',
        value: draft.targetClubName || 'Non selezionata'
      },
      {
        name: 'Giocatore selezionato',
        value: draft.playerPlatformId
          ? `${draft.playerPlatformId} (${draft.playerPlatform})`
          : 'Non selezionato'
      },
      {
        name: 'Contratto',
        value: draft.contractYears
          ? `${draft.contractYears} anno/i`
          : 'Non selezionato'
      },
      {
        name: 'Prezzo acquisto squadra',
        value: draft.transferFee ? `${draft.transferFee} crediti` : 'Da inserire'
      },
      {
        name: 'Stipendio player',
        value: draft.salary ? `${draft.salary} crediti/anno` : 'Da inserire'
      }
    )
    .setFooter({
      text: 'RPCI • Mercato trasferimenti'
    })
    .setTimestamp();
}
function buildClubSelect(clubs, page = 0) {
  const start = page * CLUBS_PER_PAGE;
  const pageClubs = clubs.slice(start, start + CLUBS_PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('offer_club_select')
      .setPlaceholder('Seleziona squadra partecipante')
      .addOptions(
        pageClubs.map(club => ({
          label: club.name.slice(0, 100),
          description: club.short_name ? `Tag: ${club.short_name}` : 'Squadra iscritta',
          value: club.id
        }))
      )
  );
}

function buildClubPaginationButtons(page, totalPages) {
  const prev = new ButtonBuilder()
    .setCustomId('offer_clubs_prev')
    .setLabel('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);

  const next = new ButtonBuilder()
    .setCustomId('offer_clubs_next')
    .setLabel('➡️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  return new ActionRowBuilder().addComponents(prev, next);
}

function buildPlayersSelect(players, page = 0) {
  const start = page * PLAYERS_PER_PAGE;
  const pagePlayers = players.slice(start, start + PLAYERS_PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('offer_player_select')
      .setPlaceholder('Seleziona giocatore dalla rosa')
      .addOptions(
        pagePlayers.map(player => ({
          label: `${player.platform_id || 'ID console non disponibile'}`.slice(0, 100),
          description: `${player.platform || 'Console'} • Contratto attuale: ${player.contract_years || 'N/D'} anno/i`.slice(0, 100),
          value: player.id
        }))
      )
  );
}

function buildPlayersPaginationButtons(page, totalPages) {
  const prev = new ButtonBuilder()
    .setCustomId('offer_players_prev')
    .setLabel('⬅️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page <= 0);

  const next = new ButtonBuilder()
    .setCustomId('offer_players_next')
    .setLabel('➡️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  return new ActionRowBuilder().addComponents(prev, next);
}

function buildContractSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('offer_contract_select')
      .setPlaceholder('Seleziona anni di contratto')
      .addOptions([
        {
          label: '1 anno',
          value: '1',
          description: 'Contratto di 1 anno'
        },
        {
          label: '2 anni',
          value: '2',
          description: 'Contratto di 2 anni'
        },
        {
          label: '3 anni',
          value: '3',
          description: 'Contratto di 3 anni'
        }
      ])
  );
}

function buildConfirmOfferButton(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('offer_confirm')
      .setLabel('INVIA OFFERTA')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId('offer_cancel')
      .setLabel('ANNULLA')
      .setStyle(ButtonStyle.Danger)
  );
}

async function buildOfferComponents(draft) {
  const components = [];

  const clubs = draft.clubs || [];
  const clubTotalPages = Math.max(1, Math.ceil(clubs.length / CLUBS_PER_PAGE));

  if (!draft.targetClubId) {
    if (clubs.length > 0) {
      components.push(buildClubSelect(clubs, draft.clubPage || 0));

      if (clubTotalPages > 1) {
        components.push(buildClubPaginationButtons(draft.clubPage || 0, clubTotalPages));
      }
    }

    return components;
  }

  const players = draft.players || [];
  const playerTotalPages = Math.max(1, Math.ceil(players.length / PLAYERS_PER_PAGE));

  if (!draft.selectedApplicationPlayerId) {
    if (players.length > 0) {
      components.push(buildPlayersSelect(players, draft.playerPage || 0));

      if (playerTotalPages > 1) {
        components.push(buildPlayersPaginationButtons(draft.playerPage || 0, playerTotalPages));
      }
    }

    return components;
  }

  if (!draft.contractYears) {
    components.push(buildContractSelect());
    return components;
  }

  if (!draft.transferFee || !draft.salary) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('offer_amounts_modal')
        .setLabel('INSERISCI IMPORTI')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('offer_cancel')
        .setLabel('ANNULLA')
        .setStyle(ButtonStyle.Danger)
    ));
    return components;
  }

  components.push(buildConfirmOfferButton(false));
  return components;
}

async function updateOfferDraftMessage(interaction, draft) {
  const components = await buildOfferComponents(draft);

  return interaction.update({
    embeds: [buildOfferPanelEmbed(draft)],
    components
  });
}

async function sendTransferLog(offer, statusText) {
  const channel = await client.channels.fetch(TRANSFER_LOG_CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle('🚨 UFFICIALE')
    .setColor(0xd4af37)
    .setDescription(
      `**${offer.platformId}** è ufficialmente un nuovo giocatore di:\n\n` +
      `🏟️ **${offer.fromClubName}**`
    )
    .addFields(
      {
        name: '🔁 Trasferimento',
        value: `Da **${offer.targetClubName}** a **${offer.fromClubName}**`
      },
      {
        name: '🎮 Giocatore',
        value: `${offer.platformId} • ${offer.platform}`
      },
      {
        name: '📄 Contratto',
        value: `${offer.contractYears} anno/i`
      },
      {
        name: '👑 Capitano offerente',
        value: `<@${offer.captainDiscordId}>`
      },
      {
        name: '✅ Stato',
        value: statusText
      }
    )
    .setFooter({
      text: 'RPCI • Ufficialità mercato'
    })
    .setTimestamp();

  await channel.send({
    content: '🚨 **UFFICIALE MERCATO**',
    embeds: [embed]
  });
}

async function finalizeOfferIfReady(offerId, forced = false) {
  const { data: offer } = await supabase
    .from('transfer_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer || offer.status !== 'pending') return;

  const { data: responses } = await supabase
    .from('transfer_offer_players')
    .select('*')
    .eq('offer_id', offerId);

  if (!responses || responses.length === 0) return;

  if (responses.some(r => r.response_status === 'rejected')) {
    await supabase
      .from('transfer_offers')
      .update({
        status: 'rejected',
        closed_at: new Date().toISOString()
      })
      .eq('id', offerId);

    return;
  }

  if (forced) {
    await supabase
      .from('transfer_offer_players')
      .update({
        response_status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('offer_id', offerId)
      .eq('response_status', 'pending');
  } else if (responses.some(r => r.response_status === 'pending')) {
    return;
  }

  const finalOffer = {
    fromClubName: offer.from_club_name,
    targetClubName: offer.target_club_name,
    captainDiscordId: offer.captain_discord_id,
    playerDiscordId: offer.player_discord_id,
    platform: offer.player_platform,
    platformId: offer.player_platform_id,
    contractYears: offer.contract_years
  };

  if (
    offer.application_player_id &&
    offer.from_application_id
  ) {
    await supabase
      .from('club_application_players')
      .update({
        application_id: offer.from_application_id,
        contract_years: offer.contract_years,
response_status: 'accepted'
      })
      .eq('id', offer.application_player_id);
  }

  await supabase
    .from('transfer_offers')
    .update({
      status: 'accepted',
      closed_at: new Date().toISOString()
    })
    .eq('id', offerId);

  await sendTransferLog(
    finalOffer,
    forced ? 'Accettata automaticamente dopo 24 ore.' : 'Accettata dal giocatore.'
  );
}


function buildOwnerOfferEmbed(offer) {
  return new EmbedBuilder()
    .setTitle('📨 Nuova offerta ricevuta')
    .setColor(0xd4af37)
    .setDescription('Una squadra ha inviato un’offerta per un tuo giocatore. Accetta o rifiuta la trattativa.')
    .addFields(
      { name: 'Club offerente', value: offer.fromClubName || 'N/D' },
      { name: 'Tuo club', value: offer.targetClubName || 'N/D' },
      { name: 'Giocatore', value: `${offer.platformId || 'N/D'} (${offer.platform || 'N/D'})` },
      { name: 'Prezzo trasferimento', value: `${offer.transferFee || 0} crediti` },
      { name: 'Stipendio proposto al player', value: `${offer.salary || 0} crediti/anno` },
      { name: 'Contratto', value: `${offer.contractYears || 'N/D'} anno/i` }
    )
    .setFooter({ text: 'RPCI • Approvazione capitano proprietario' })
    .setTimestamp();
}

async function sendOfferToOwnerCaptain(offer) {
  const ownerUser = await client.users.fetch(offer.ownerCaptainDiscordId).catch(() => null);
  if (!ownerUser) return false;

  const accept = new ButtonBuilder()
    .setCustomId(`owner_offer_accept_${offer.id}`)
    .setLabel('ACCETTA OFFERTA')
    .setStyle(ButtonStyle.Success);

  const reject = new ButtonBuilder()
    .setCustomId(`owner_offer_reject_${offer.id}`)
    .setLabel('RIFIUTA OFFERTA')
    .setStyle(ButtonStyle.Danger);

  await ownerUser.send({
    embeds: [buildOwnerOfferEmbed(offer)],
    components: [new ActionRowBuilder().addComponents(accept, reject)]
  }).catch(() => null);

  return true;
}

async function sendOfferToPlayer(offer, offerPlayerRow) {
  const user = await client.users.fetch(offer.playerDiscordId).catch(() => null);
  if (!user) return;

  const accept = new ButtonBuilder()
    .setCustomId(`offer_accept_${offerPlayerRow.id}`)
    .setLabel('ACCETTA')
    .setStyle(ButtonStyle.Success);

  const reject = new ButtonBuilder()
    .setCustomId(`offer_reject_${offerPlayerRow.id}`)
    .setLabel('RIFIUTA')
    .setStyle(ButtonStyle.Danger);

  await user.send({
    embeds: [buildOfferEmbed(offer)],
    components: [new ActionRowBuilder().addComponents(accept, reject)]
  }).catch(() => null);

  setTimeout(() => {
    finalizeOfferIfReady(offer.id, true).catch(console.error);
  }, 24 * 60 * 60 * 1000);
}


async function logBotCommand(interaction) {
  try {
    if (!interaction.guild || !interaction.isChatInputCommand()) return;
    const channel = await client.channels.fetch(BOT_LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const options = interaction.options?.data?.map(option => {
      const value = option.value ? String(option.value) : '';
      return `/${option.name}: ${value}`;
    }).join('\n') || 'Nessuna opzione';

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🧾 Comando bot usato')
          .setColor(0x5865f2)
          .addFields(
            { name: 'Utente', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
            { name: 'Comando', value: `/${interaction.commandName}` },
            { name: 'Canale', value: `<#${interaction.channelId}>` },
            { name: 'Opzioni', value: options.slice(0, 1024) }
          )
          .setTimestamp()
      ]
    });
  } catch (error) {
    console.error('Errore log comando:', error);
  }
}

async function getCaptainApprovedApplication(discordId) {
  const { data } = await supabase
    .from('club_applications')
    .select('*, clubs(*)')
    .eq('captain_discord_id', discordId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function upsertFreeAgentProfile(profile) {
  const payload = {
    discord_id: profile.discord_id,
    discord_tag: profile.discord_tag || null,
    console: profile.console || profile.platform || null,
    platform_id: profile.platform_id || null,
    age: profile.age || null,
    overall: profile.overall || null,
    primary_role: profile.primary_role || null,
    secondary_role: profile.secondary_role || null,
    description: profile.description || null,
    appearances: profile.appearances || 0,
    goals: profile.goals || 0,
    current_status: profile.current_status || 'free_agent',
    current_club_name: profile.current_club_name || null,
    contract_years_remaining: profile.contract_years_remaining || null,
    application_player_id: profile.application_player_id || null,
potential: profile.potential || 'LOW',
    active: true,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('free_agent_profiles')
    .upsert(payload, { onConflict: 'discord_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function buildFreeAgentEmbed(profile) {
  const isPlayer = profile.current_status === 'player';
  const statusText = isPlayer
    ? `AL MOMENTO PLAYER${profile.current_club_name ? ` • ${profile.current_club_name}` : ''}${profile.contract_years_remaining ? ` • Contratto: ${profile.contract_years_remaining} anno/i` : ''}`
    : 'Senza squadra';

  return new EmbedBuilder()
    .setTitle(isPlayer ? '🔎 Player cerca nuova squadra' : '🆓 Free Agent disponibile')
    .setColor(isPlayer ? 0x3498db : 0x2ecc71)
    .addFields(
      { name: 'Nome / Tag', value: profile.name || profile.discord_tag || `<@${profile.discord_id}>`, inline: false },
      { name: 'Stato', value: statusText, inline: false },
      { name: 'ID Console', value: profile.platform_id || 'N/D', inline: true },
      { name: 'Console', value: profile.console || profile.platform || 'N/D', inline: true },
      { name: 'Età', value: String(profile.age || 'N/D'), inline: true },
      { name: 'Overall', value: String(profile.overall || 'N/D'), inline: true },
      { name: 'Ruolo principale', value: profile.primary_role || 'N/D', inline: true },
      { name: 'Ruolo secondario', value: profile.secondary_role && profile.secondary_role !== 'NO' ? profile.secondary_role : 'NO', inline: true },
      { name: 'Presenze', value: String(profile.appearances || 0), inline: true },
      { name: 'Gol', value: String(profile.goals || 0), inline: true },
      { name: 'Esperienze', value: (profile.description || 'Nessuna descrizione.').slice(0, 1024), inline: false }
    )
    .setTimestamp();
}

function buildContactFreeAgentButton(discordId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fa_contact_${discordId}`)
      .setLabel('CONTATTA')
      .setStyle(ButtonStyle.Primary)
  );
}

async function publishFreeAgentProfile(profile) {
  const channel = await client.channels.fetch(FREE_AGENT_CHANNEL_ID).catch(() => null);
  if (!channel) return null;

  const message = await channel.send({
    embeds: [buildFreeAgentEmbed(profile)],
    components: [buildContactFreeAgentButton(profile.discord_id)]
  });

  await supabase
    .from('free_agent_profiles')
    .update({ message_id: message.id, channel_id: channel.id })
    .eq('discord_id', profile.discord_id);

  return message;
}

async function getCurrentPlayerClub(discordId) {
  const { data: playerRows } = await supabase
    .from('club_application_players')
    .select('*, club_applications(id, status, captain_discord_id, clubs(name))')
    .eq('discord_id', discordId)
    .eq('response_status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1);

  const row = playerRows?.[0];
  if (!row || row.is_free_agent) return null;

  return {
    row,
    clubName: row.club_applications?.clubs?.name || null,
    applicationId: row.application_id,
    ownerCaptainDiscordId: row.club_applications?.captain_discord_id || null,
    contractYears: row.contract_years || null
  };
}

async function makePlayerFreeAgent(guild, appPlayer, reason = 'contract_expired') {
  const member = await guild.members.fetch(appPlayer.discord_id).catch(() => null);
  if (member) {
    await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => null);
    await member.roles.remove(PLAYER_ROLE_ID).catch(() => null);
  }

  await supabase
    .from('club_application_players')
    .update({
      response_status: 'free_agent',
      is_free_agent: true,
      contract_years: 0
    })
    .eq('id', appPlayer.id);

  const profile = await upsertFreeAgentProfile({
    discord_id: appPlayer.discord_id,
    discord_tag: member?.user?.tag || null,
    console: appPlayer.platform,
    platform_id: appPlayer.platform_id,
    age: appPlayer.age,
    primary_role: appPlayer.primary_role,
    secondary_role: appPlayer.secondary_role,
    appearances: appPlayer.appearances || 0,
    goals: appPlayer.goals || 0,
current_status: 'free_agent',
    current_club_name: null,
    contract_years_remaining: null,
    application_player_id: appPlayer.id,
    description: reason === 'contract_expired' ? 'Contratto scaduto: giocatore attualmente senza squadra.' : null
  });

  await publishFreeAgentProfile(profile);
}

async function processExpiredContracts(guild) {
  try {
    const now = new Date().toISOString();
    const { data: expiredPlayers, error } = await supabase
      .from('club_application_players')
      .select('*')
      .eq('response_status', 'accepted')
      .lte('contract_expires_at', now);

    if (error || !expiredPlayers) return;

    for (const player of expiredPlayers) {
      await makePlayerFreeAgent(guild, player, 'contract_expired');
    }
  } catch (error) {
    console.error('Errore controllo contratti scaduti:', error);
  }
}

function buildContractPlayerSelect(players, page = 0) {
  const start = page * PLAYERS_PER_PAGE;
  const pagePlayers = players.slice(start, start + PLAYERS_PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('contract_player_select')
      .setPlaceholder('Seleziona free agent')
      .addOptions(pagePlayers.map(player => ({
        label: `${player.platform_id || 'ID console N/D'}`.slice(0, 100),
        description: `${player.discord_tag || player.discord_id} • ${player.primary_role || 'Ruolo N/D'}`.slice(0, 100),
        value: player.discord_id
      })))
  );
}

function buildContractPaginationButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('contract_players_prev')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId('contract_players_next')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1)
  );
}

function buildContractYearsSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('deposit_contract_years_select')
      .setPlaceholder('Seleziona anni di contratto')
      .addOptions([
        { label: '1 anno', value: '1' },
        { label: '2 anni', value: '2' },
        { label: '3 anni', value: '3' }
      ])
  );
}

function buildDepositContractEmbed(draft) {
  return new EmbedBuilder()
    .setTitle('📄 Deposita contratto')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Giocatore', value: draft.selectedPlayer ? `${draft.selectedPlayer.platform_id || 'N/D'} • ${draft.selectedPlayer.discord_tag || `<@${draft.selectedPlayer.discord_id}>`}` : 'Non selezionato' },
      { name: 'Contratto', value: draft.contractYears ? `${draft.contractYears} anno/i` : 'Non selezionato' },
      { name: 'Stipendio', value: draft.salary ? String(draft.salary) : 'Da inserire' }
    )
    .setTimestamp();
}

async function buildDepositContractComponents(draft) {
  const components = [];
  if (!draft.selectedPlayer) {
    const totalPages = Math.max(1, Math.ceil(draft.players.length / PLAYERS_PER_PAGE));
    components.push(buildContractPlayerSelect(draft.players, draft.page || 0));
    if (totalPages > 1) components.push(buildContractPaginationButtons(draft.page || 0, totalPages));
    return components;
  }
  if (!draft.contractYears) {
    components.push(buildContractYearsSelect());
    return components;
  }
  components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('deposit_salary_modal').setLabel('INSERISCI STIPENDIO').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('deposit_contract_cancel').setLabel('ANNULLA').setStyle(ButtonStyle.Danger)
  ));
  return components;
}

async function getFreeAgentProfilesFromGuild(guild) {
  await guild.members.fetch().catch(() => null);
  const freeMembers = guild.members.cache.filter(member => member.roles.cache.has(FREE_AGENT_ROLE_ID));
  const ids = [...freeMembers.keys()];
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from('free_agent_profiles')
    .select('*')
    .in('discord_id', ids)
    .eq('active', true)
    .order('updated_at', { ascending: false });

  return data || [];
}

function buildLookingRoleSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('looking_role_select')
      .setPlaceholder('Seleziona RUOLO PRINCIPALE')
      .addOptions(GAME_ROLES.map(role => ({
        label: role,
        value: role,
        description: `Ruolo principale: ${role}`
      })))
  );
}

function buildLookingSecondaryRoleSelect(primaryRole = null) {
  const options = [
    {
      label: 'NO',
      value: 'NO',
      description: 'Nessun ruolo secondario'
    },
    ...GAME_ROLES
      .filter(role => role !== primaryRole)
      .map(role => ({
        label: role,
        value: role,
        description: `Ruolo secondario: ${role}`
      }))
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('looking_secondary_role_select')
      .setPlaceholder('Seleziona RUOLO SECONDARIO')
      .addOptions(options)
  );
}



function buildTransferRequestRoleSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('transfer_request_role_select')
      .setPlaceholder('Seleziona RUOLO PRINCIPALE')
      .addOptions(GAME_ROLES.map(role => ({
        label: role,
        value: role,
        description: `Ruolo principale: ${role}`
      })))
  );
}

function buildTransferRequestSecondaryRoleSelect(primaryRole = null) {
  const options = [
    { label: 'NO', value: 'NO', description: 'Nessun ruolo secondario' },
    ...GAME_ROLES
      .filter(role => role !== primaryRole)
      .map(role => ({
        label: role,
        value: role,
        description: `Ruolo secondario: ${role}`
      }))
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('transfer_request_secondary_role_select')
      .setPlaceholder('Seleziona RUOLO SECONDARIO')
      .addOptions(options)
  );
}

function buildTransferRequestEmbed(profile) {
  const secondary = profile.secondary_role && profile.secondary_role !== 'NO'
    ? profile.secondary_role
    : 'NO';

  return new EmbedBuilder()
    .setTitle('🔁 RICHIESTA TRASFERIMENTO')
    .setColor(0xe67e22)
    .setDescription(
      `**${profile.name}** ha comunicato la volontà di valutare un trasferimento.`
    )
    .addFields(
      { name: '👤 Player', value: `<@${profile.discord_id}>`, inline: true },
      { name: '🏟️ Club attuale', value: profile.current_club_name || 'N/D', inline: true },
      { name: '📄 Contratto rimanente', value: profile.contract_years_remaining ? `${profile.contract_years_remaining} anno/i` : 'N/D', inline: true },
      { name: '🎮 ID Console', value: profile.platform_id || 'N/D', inline: true },
      { name: '🕹️ Console', value: profile.console || 'N/D', inline: true },
      { name: '🎂 Età', value: String(profile.age || 'N/D'), inline: true },
      { name: '⭐ Overall', value: String(profile.overall || 'N/D'), inline: true },
      { name: '📌 Ruolo primario', value: profile.primary_role || 'N/D', inline: true },
      { name: '📎 Ruolo secondario', value: secondary, inline: true },
      { name: '📊 Presenze RPCI', value: String(profile.appearances || 0), inline: true },
      { name: '⚽ Gol RPCI', value: String(profile.goals || 0), inline: true },
      { name: '📝 Esperienze', value: (profile.description || 'Nessuna descrizione.').slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'RPCI • Richieste trasferimento' })
    .setTimestamp();
}


function buildTransferRequestContactButton(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tr_contact_owner_${requestId}`)
      .setLabel('CONTATTA CAPITANO CLUB')
      .setStyle(ButtonStyle.Primary)
  );
}

function buildTransferNegotiationButtons(contactId, requesterCaptainId) {
  const contactButton = new ButtonBuilder()
    .setLabel('METTITI IN CONTATTO SE INTERESSATO')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/users/${requesterCaptainId}`);

  const rejectButton = new ButtonBuilder()
    .setCustomId(`tr_reject_contact_${contactId}`)
    .setLabel('RIFIUTA TRATTATIVA')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(contactButton, rejectButton);
}

async function publishTransferRequest(profile) {
  const channel = await client.channels.fetch(TRANSFER_REQUEST_CHANNEL_ID).catch(() => null);
  if (!channel) return null;

  const { data: requestRow } = await supabase
    .from('transfer_requests')
    .insert({
      discord_id: profile.discord_id,
      discord_tag: profile.discord_tag || null,
      name: profile.name || null,
      age: profile.age || null,
      console: profile.console || null,
      platform_id: profile.platform_id || null,
      overall: profile.overall || null,
      primary_role: profile.primary_role || null,
      secondary_role: profile.secondary_role || 'NO',
      description: profile.description || null,
      current_club_name: profile.current_club_name || null,
      current_captain_discord_id: profile.current_captain_discord_id || null,
      contract_years_remaining: profile.contract_years_remaining || null,
      appearances: profile.appearances || 0,
      goals: profile.goals || 0,
      application_player_id: profile.application_player_id || null,
      channel_id: channel.id,
      status: 'open'
    })
    .select()
    .single();

  if (!requestRow) return null;

  const message = await channel.send({
    content: '🔁 **NUOVA RICHIESTA TRASFERIMENTO**',
    embeds: [buildTransferRequestEmbed(profile)],
    components: [buildTransferRequestContactButton(requestRow.id)]
  });

  const { error: updateRequestMessageError } = await supabase
    .from('transfer_requests')
    .update({ message_id: message.id })
    .eq('id', requestRow.id);

  if (updateRequestMessageError) {
    console.error('Errore aggiornamento message_id transfer request:', updateRequestMessageError);
  }

  return message;
}

function buildTeamSearchCountSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('team_search_count_select')
      .setPlaceholder('Quanti giocatori cerchi?')
      .addOptions([1, 2, 3, 4, 5].map(num => ({
        label: `${num} giocatore${num > 1 ? 'i' : ''}`,
        value: String(num),
        description: `Cerchi ${num} giocatore${num > 1 ? 'i' : ''}`
      })))
  );
}

function buildTeamSearchRoleSelect(index, selectedRoles = []) {
  const alreadySelected = selectedRoles.filter(Boolean);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`team_search_role_${index}`)
      .setPlaceholder(`Ruolo cercato ${index + 1}`)
      .addOptions(GAME_ROLES.map(role => ({
        label: role,
        value: role,
        description: `Cerchi un giocatore ruolo ${role}`,
        default: selectedRoles[index] === role
      })))
  );
}

function buildTeamSearchRolesComponents(draft) {
  const components = [];
  for (let i = 0; i < draft.count; i++) {
    components.push(buildTeamSearchRoleSelect(i, draft.roles));
  }
  return components;
}

function buildTeamSearchSetupEmbed(draft) {
  const rolesText = draft.roles?.length
    ? draft.roles.map((role, index) => `**${index + 1}.** ${role || 'Da selezionare'}`).join('\n')
    : 'Non selezionati';

  return new EmbedBuilder()
    .setTitle('📢 Squadra cerca player')
    .setColor(0xd4af37)
    .setDescription('Completa i passaggi per pubblicare un annuncio professionale nel canale.')
    .addFields(
      { name: 'Giocatori cercati', value: draft.count ? String(draft.count) : 'Non selezionato', inline: true },
      { name: 'Ruoli cercati', value: rolesText, inline: false }
    )
    .setFooter({ text: 'RPCI • Squadra cerca player' })
    .setTimestamp();
}

async function getCaptainClubInfo(discordId) {
  const captainApplication = await getCaptainApprovedApplication(discordId);
  if (!captainApplication) return null;

  const { data: roster } = await supabase
    .from('club_application_players')
    .select('id')
    .eq('application_id', captainApplication.id)
    .eq('response_status', 'accepted');

  return {
    applicationId: captainApplication.id,
    clubName: captainApplication.clubs?.name || 'Club del capitano',
    logoUrl: captainApplication.clubs?.logo_url || null,
    rosterCount: roster?.length || 0
  };
}

function buildTeamSearchPublicEmbed({ clubInfo, captainId, count, roles }) {
  const rolesText = roles.map((role, index) => `**${index + 1}.** ${role}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📢 SQUADRA CERCA PLAYER')
    .setColor(0xd4af37)
    .setDescription(
      `La squadra **${clubInfo.clubName}** è alla ricerca di nuovi giocatori per completare la rosa.`
    )
    .addFields(
      {
        name: '🏟️ Info club',
        value:
          `**Club:** ${clubInfo.clubName}\n` +
          `**Player in rosa:** ${clubInfo.rosterCount}`,
        inline: false
      },
      {
        name: '👑 Capitano',
        value: `<@${captainId}>`,
        inline: true
      },
      {
        name: '🔎 Giocatori cercati',
        value: `${count}`,
        inline: true
      },
      {
        name: '🎯 Ruoli cercati',
        value: rolesText,
        inline: false
      }
    )
    .setFooter({ text: 'RPCI • Recruitment ufficiale' })
    .setTimestamp();

  if (clubInfo.logoUrl) embed.setThumbnail(clubInfo.logoUrl);

  return embed;
}

async function publishTeamSearch(interaction, draft) {
  const clubInfo = await getCaptainClubInfo(interaction.user.id);
  if (!clubInfo) {
    return interaction.reply({
      content: '❌ Non trovo una squadra approvata collegata a questo capitano.',
      flags: MessageFlags.Ephemeral
    });
  }

  const contactCaptainButton = new ButtonBuilder()
    .setLabel('CONTATTA CAPITANO')
    .setStyle(ButtonStyle.Link)
    .setURL(`https://discord.com/users/${interaction.user.id}`);

  await interaction.channel.send({
    content: '📢 **NUOVA RICERCA PLAYER**',
    embeds: [buildTeamSearchPublicEmbed({
      clubInfo,
      captainId: interaction.user.id,
      count: draft.count,
      roles: draft.roles
    })],
    components: [
      new ActionRowBuilder().addComponents(contactCaptainButton)
    ]
  });

  teamSearchDrafts.delete(interaction.user.id);

  return interaction.update({
    content: '✅ Annuncio pubblicato correttamente.',
    embeds: [],
    components: []
  });
}

async function sendContractOfferToFreeAgent(interaction, draft) {
  const captainApplication = await getCaptainApprovedApplication(interaction.user.id);
  if (!captainApplication) {
    return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
  }

  const player = draft.selectedPlayer;
  const { data: offer, error } = await supabase
    .from('free_agent_contract_offers')
    .insert({
      captain_discord_id: interaction.user.id,
      club_application_id: captainApplication.id,
      club_name: captainApplication.clubs?.name || 'Club del capitano',
      player_discord_id: player.discord_id,
      player_platform_id: player.platform_id,
      contract_years: Number(draft.contractYears),
      salary: Number(draft.salary),
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  const user = await client.users.fetch(player.discord_id).catch(() => null);
  if (user) {
    const accept = new ButtonBuilder().setCustomId(`fa_contract_accept_${offer.id}`).setLabel('ACCETTA').setStyle(ButtonStyle.Success);
    const reject = new ButtonBuilder().setCustomId(`fa_contract_reject_${offer.id}`).setLabel('RIFIUTA').setStyle(ButtonStyle.Danger);

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('📄 Proposta contratto')
          .setColor(0xd4af37)
          .addFields(
            { name: 'Club', value: captainApplication.clubs?.name || 'Club del capitano' },
            { name: 'Capitano', value: `<@${interaction.user.id}>` },
            { name: 'Contratto', value: `${draft.contractYears} anno/i` },
            { name: 'Stipendio', value: String(draft.salary) }
          )
          .setTimestamp()
      ],
      components: [new ActionRowBuilder().addComponents(accept, reject)]
    }).catch(() => null);
  }
}

async function finalizeFreeAgentContract(offerId, accepted, interaction) {
  const { data: offer } = await supabase
    .from('free_agent_contract_offers')
    .select('*')
    .eq('id', offerId)
    .single();

  if (!offer || offer.status !== 'pending') return;

  await supabase
    .from('free_agent_contract_offers')
    .update({ status: accepted ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
    .eq('id', offerId);

  if (!accepted) return;

  const { data: profile } = await supabase
    .from('free_agent_profiles')
    .select('*')
    .eq('discord_id', offer.player_discord_id)
    .maybeSingle();

  if (profile?.application_player_id) {
    await supabase
      .from('club_application_players')
      .update({
        application_id: offer.club_application_id,
        response_status: 'accepted',
        is_free_agent: false,
        contract_years: offer.contract_years,
})
      .eq('id', profile.application_player_id);
  } else {
    await supabase
      .from('club_application_players')
      .insert({
        application_id: offer.club_application_id,
        discord_id: offer.player_discord_id,
        age: profile?.age || null,
        platform: profile?.console || null,
        platform_id: profile?.platform_id || offer.player_platform_id,
        primary_role: profile?.primary_role || null,
        secondary_role: profile?.secondary_role || 'NO',
        contract_years: offer.contract_years,
response_status: 'accepted',
        is_free_agent: false
      });
  }

  await supabase
    .from('free_agent_profiles')
    .update({ active: false, current_status: 'player', current_club_name: offer.club_name, contract_years_remaining: offer.contract_years })
    .eq('discord_id', offer.player_discord_id);

  const guild = interaction.client.guilds.cache.get(process.env.GUILD_ID);
  const member = await guild?.members.fetch(offer.player_discord_id).catch(() => null);
  if (member) {
    await member.roles.remove(FREE_AGENT_ROLE_ID).catch(() => null);
    await member.roles.add(PLAYER_ROLE_ID).catch(() => null);
  }

  await sendTransferLog({
    fromClubName: offer.club_name,
    targetClubName: 'Free Agent',
    captainDiscordId: offer.captain_discord_id,
    platform: profile?.console || 'N/D',
    platformId: profile?.platform_id || offer.player_platform_id || 'N/D',
    contractYears: offer.contract_years
  }, `Contratto Free Agent accettato • Stipendio: ${offer.salary}`);
}


function calculatePerformancePoints(player = {}) {
  const appearances = Number(player.appearances || 0);
  const goals = Number(player.goals || 0);
  const assists = Number(player.assists || 0);
  const cleanSheets = Number(player.clean_sheets || 0);
  const mvpAwards = Number(player.mvp_awards || 0);
  const awardsPoints = Number(player.awards_points || 0);
  const potential = player.potential || 'LOW';
  const role = player.primary_role || player.main_role || '';

  let points = appearances;
  points += goals;
  points += assists;

  if (role === 'POR') {
    points += cleanSheets * 2;
  } else if (DEFENSIVE_ROLES.includes(role)) {
    points += cleanSheets;
  }

  points += mvpAwards * 5;
  points += awardsPoints;

  const multiplier = POTENTIAL_MULTIPLIERS[potential] || 1;
  return Math.floor(points * multiplier);
}

function getTierFromPoints(points) {
  const range = TIER_RANGES.find(item => points >= item.min && points <= item.max);
  return range?.tier || 'BASSA';
}

function getSalaryByTier(tier) {
  return TIER_SALARIES[tier] || TIER_SALARIES.BASSA;
}

function calculateContractValue(tier, years) {
  return getSalaryByTier(tier) * Number(years || 1);
}

async function ensureClubBudget(applicationId, clubName) {
  const { data: existing } = await supabase
    .from('club_budgets')
    .select('*')
    .eq('club_application_id', applicationId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('club_budgets')
    .insert({
      club_application_id: applicationId,
      club_name: clubName,
      season_budget: BASE_CLUB_BUDGET
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getClubBudgetInfo(applicationId, clubName) {
  const budget = await ensureClubBudget(applicationId, clubName);

  const { data: players } = await supabase
    .from('club_application_players')
    .select('salary_per_year, contract_years')
    .eq('application_id', applicationId)
    .eq('response_status', 'accepted');

  const spent = (players || []).reduce((sum, player) => {
    return sum + (Number(player.salary_per_year || 0) * Number(player.contract_years || 1));
  }, 0);

  const total = Number(budget.season_budget || BASE_CLUB_BUDGET) + Number(budget.bonus_budget || 0);
  const remaining = total - spent;

  return { budget, total, spent, remaining };
}

async function recalculatePlayerEconomyByDiscordId(discordId) {
  const { data: rows } = await supabase
    .from('club_application_players')
    .select('*')
    .eq('discord_id', discordId)
    .eq('response_status', 'accepted')
    .order('created_at', { ascending: false })
    .limit(1);

  const player = rows?.[0];
  if (!player) return null;

  const points = calculatePerformancePoints(player);
  const tier = getTierFromPoints(points);
  const salary = getSalaryByTier(tier);
  const contractTotal = salary * Number(player.contract_years || 1);

  const { data, error } = await supabase
    .from('club_application_players')
    .update({
})
    .eq('id', player.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function recalculateAllPlayerEconomy() {
  const { data: players, error } = await supabase
    .from('club_application_players')
    .select('*')
    .eq('response_status', 'accepted');

  if (error) throw error;

  let updated = 0;
  for (const player of players || []) {
    const points = calculatePerformancePoints(player);
    const tier = getTierFromPoints(points);
    const salary = getSalaryByTier(tier);
    const contractTotal = salary * Number(player.contract_years || 1);

    await supabase
      .from('club_application_players')
      .update({
})
      .eq('id', player.id);

    updated += 1;
  }

  return updated;
}

function buildBudgetEmbed(clubName, info) {
  return new EmbedBuilder()
    .setTitle('💰 Budget squadra')
    .setColor(0xd4af37)
    .addFields(
      { name: 'Club', value: clubName, inline: false },
      { name: 'Budget totale', value: `${info.total} crediti`, inline: true },
      { name: 'Speso contratti', value: `${info.spent} crediti`, inline: true },
      { name: 'Residuo', value: `${info.remaining} crediti`, inline: true }
    )
    .setFooter({ text: 'RPCI • Sistema economico' })
    .setTimestamp();
}



// =========================
// SISTEMA REFERTI PARTITA
// =========================
function chunkOptions(items, page, perPage) {
  const start = page * perPage;
  return items.slice(start, start + perPage);
}

function getTeamSide(match, applicationId) {
  if (match.home_application_id === applicationId) return 'home';
  if (match.away_application_id === applicationId) return 'away';
  return null;
}

function getScoreForTeam(match, report) {
  const side = getTeamSide(match, report.application_id);
  if (side === 'home') {
    return { home: report.goals_for, away: report.goals_against };
  }
  return { home: report.goals_against, away: report.goals_for };
}

async function getCaptainOpenMatches(captainDiscordId) {
  const app = await getCaptainApprovedApplication(captainDiscordId);
  if (!app) return { captainApplication: null, matches: [] };

  const { data } = await supabase
    .from('matches')
    .select('*')
    .or(`home_application_id.eq.${app.id},away_application_id.eq.${app.id}`)
    .in('status', ['scheduled', 'pending_reports', 'disputed'])
    .order('match_date', { ascending: true });

  return { captainApplication: app, matches: data || [] };
}

function buildMatchSelect(matches, applicationId) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_report_match_select')
      .setPlaceholder('Seleziona la partita da refertare')
      .addOptions(
        matches.slice(0, 25).map(match => {
          const isHome = match.home_application_id === applicationId;
          const yourClub = isHome ? match.home_club_name : match.away_club_name;
          const oppClub = isHome ? match.away_club_name : match.home_club_name;
          const label = `${yourClub} vs ${oppClub}`.slice(0, 100);
          return {
            label,
            description: match.match_date ? `Data: ${new Date(match.match_date).toLocaleDateString('it-IT')}` : 'Partita in calendario',
            value: match.id
          };
        })
      )
  );
}

function buildMatchReportPanelEmbed(draft) {
  const goalsText = draft.goals.length
    ? draft.goals.map(g => `• ${g.platformId}: ${g.count}`).join('\n')
    : 'Nessun gol inserito';
  const assistsText = draft.assists.length
    ? draft.assists.map(a => `• ${a.platformId}: ${a.count}`).join('\n')
    : 'Nessun assist inserito';

  return new EmbedBuilder()
    .setTitle('📝 Referto partita RPCI')
    .setColor(0xd4af37)
    .setDescription('Compila il referto. Le statistiche verranno aggiornate solo quando anche l’altro capitano invia un referto combaciante.')
    .addFields(
      { name: 'Partita', value: draft.matchLabel || 'Non selezionata', inline: false },
      { name: 'Risultato dichiarato', value: draft.scoreSet ? `${draft.goalsFor} - ${draft.goalsAgainst}` : 'Non inserito', inline: true },
      { name: 'Presenti', value: draft.presentPlayers.length ? `${draft.presentPlayers.length} giocatori` : 'Non selezionati', inline: true },
      { name: 'MVP', value: draft.mvpPlayerId ? (draft.roster.find(p => p.id === draft.mvpPlayerId)?.platform_id || 'Selezionato') : 'Non selezionato', inline: true },
      { name: 'Gol', value: goalsText.slice(0, 1024), inline: false },
      { name: 'Assist', value: assistsText.slice(0, 1024), inline: false }
    )
    .setFooter({ text: 'RPCI • Referti partita' })
    .setTimestamp();
}

function buildPresentPlayersSelect(draft) {
  const players = draft.roster || [];
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('match_report_present_select')
      .setPlaceholder('Seleziona i giocatori presenti in partita')
      .setMinValues(1)
      .setMaxValues(Math.min(25, players.length))
      .addOptions(players.slice(0, 25).map(player => ({
        label: `${player.platform_id || 'ID console'} (${player.platform || 'N/D'})`.slice(0, 100),
        description: `${player.primary_role || 'Ruolo N/D'} • ${player.discord_id}`.slice(0, 100),
        value: player.id
      })))
  );
}

function buildReportActionButtons(draft) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('match_report_set_score').setLabel('RISULTATO').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('match_report_add_goal').setLabel('AGGIUNGI GOL').setStyle(ButtonStyle.Success).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('match_report_add_assist').setLabel('AGGIUNGI ASSIST').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('match_report_select_mvp').setLabel('MVP').setStyle(ButtonStyle.Secondary).setDisabled(!draft.presentPlayers.length),
    new ButtonBuilder().setCustomId('match_report_confirm').setLabel('CONFERMA').setStyle(ButtonStyle.Danger).setDisabled(!draft.scoreSet || !draft.presentPlayers.length)
  );
}

function buildReportComponents(draft) {
  const components = [];
  if (!draft.matchId) return components;
  if (!draft.presentPlayers.length) components.push(buildPresentPlayersSelect(draft));
  components.push(buildReportActionButtons(draft));
  return components;
}

function buildPlayerForStatSelect(draft, mode) {
  const ids = draft.presentPlayers;
  const players = draft.roster.filter(p => ids.includes(p.id));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(mode === 'goal' ? 'match_report_goal_player_select' : mode === 'assist' ? 'match_report_assist_player_select' : 'match_report_mvp_player_select')
      .setPlaceholder(mode === 'goal' ? 'Seleziona marcatore' : mode === 'assist' ? 'Seleziona assistman' : 'Seleziona MVP')
      .addOptions(players.slice(0, 25).map(player => ({
        label: `${player.platform_id || 'ID console'} (${player.primary_role || 'Ruolo'})`.slice(0, 100),
        value: player.id
      })))
  );
}

function buildCountModal(customId, title, label) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder()
    .setCustomId('count')
    .setLabel(label)
    .setPlaceholder('Esempio: 1')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function updateMatchReportMessage(interaction, draft) {
  return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: buildReportComponents(draft) });
}

async function applyReportPlayerStats(reportId) {
  const { data: report } = await supabase.from('match_reports').select('*').eq('id', reportId).single();
  if (!report || report.stats_applied) return;
  const { data: stats } = await supabase.from('match_report_player_stats').select('*').eq('report_id', reportId);
  for (const stat of stats || []) {
    const { data: player } = await supabase.from('club_application_players').select('*').eq('id', stat.application_player_id).single();
    if (!player) continue;
    await supabase
      .from('club_application_players')
      .update({
        appearances: Number(player.appearances || 0) + Number(stat.appearance || 0),
        goals: Number(player.goals || 0) + Number(stat.goals || 0),
        assists: Number(player.assists || 0) + Number(stat.assists || 0),
        mvp_awards: Number(player.mvp_awards || 0) + Number(stat.mvp || 0)
      })
      .eq('id', player.id);
    await recalculatePlayerEconomyByDiscordId(player.discord_id).catch(console.error);
  }
  await supabase.from('match_reports').update({ stats_applied: true }).eq('id', reportId);
}

async function checkAndFinalizeMatch(matchId) {
  const { data: match } = await supabase.from('matches').select('*').eq('id', matchId).single();
  if (!match) return;
  const { data: reports } = await supabase.from('match_reports').select('*').eq('match_id', matchId).eq('status', 'submitted');
  if (!reports || reports.length < 2) return;

  const homeReport = reports.find(r => r.application_id === match.home_application_id);
  const awayReport = reports.find(r => r.application_id === match.away_application_id);
  if (!homeReport || !awayReport) return;

  const s1 = getScoreForTeam(match, homeReport);
  const s2 = getScoreForTeam(match, awayReport);

  if (s1.home === s2.home && s1.away === s2.away) {
    await applyReportPlayerStats(homeReport.id);
    await applyReportPlayerStats(awayReport.id);
    await supabase.from('matches').update({ status: 'confirmed', home_goals: s1.home, away_goals: s1.away, confirmed_at: new Date().toISOString() }).eq('id', matchId);

    const channel = await client.channels.fetch(MATCH_RESULTS_CHANNEL_ID).catch(() => null);
    if (channel) {
      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('✅ RISULTATO CONFERMATO')
          .setColor(0x2ecc71)
          .setDescription(`**${match.home_club_name} ${s1.home} - ${s1.away} ${match.away_club_name}**`)
          .addFields(
            { name: 'Referti', value: 'Entrambi i capitani hanno inviato un referto combaciante.' },
            { name: 'Statistiche', value: 'Presenze, gol, assist, MVP, punti prestazione, fasce e stipendi futuri aggiornati automaticamente.' }
          )
          .setFooter({ text: 'RPCI • Risultati partita' })
          .setTimestamp()]
      });
    }
  } else {
    await supabase.from('matches').update({ status: 'disputed' }).eq('id', matchId);
    const channel = await client.channels.fetch(APPEALS_CHANNEL_ID).catch(() => null);
    if (channel) {
      await channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('⚠️ RICORSO REFERTI')
          .setColor(0xe74c3c)
          .setDescription(`I referti di **${match.home_club_name} vs ${match.away_club_name}** non combaciano.`)
          .addFields(
            { name: `Referto ${match.home_club_name}`, value: `${s1.home} - ${s1.away}`, inline: true },
            { name: `Referto ${match.away_club_name}`, value: `${s2.home} - ${s2.away}`, inline: true },
            { name: 'Azione richiesta', value: 'Lo staff deve controllare il risultato e decidere manualmente.' }
          )
          .setFooter({ text: 'RPCI • Ricorso referti' })
          .setTimestamp()]
      });
    }
  }
}

async function submitMatchReport(interaction, draft) {
  const side = getTeamSide(draft.match, draft.applicationId);
  if (!side) throw new Error('Squadra non valida per questa partita');

  const { data: report, error } = await supabase
    .from('match_reports')
    .upsert({
      match_id: draft.matchId,
      application_id: draft.applicationId,
      captain_discord_id: interaction.user.id,
      team_side: side,
      goals_for: Number(draft.goalsFor),
      goals_against: Number(draft.goalsAgainst),
      status: 'submitted',
      submitted_at: new Date().toISOString()
    }, { onConflict: 'match_id,application_id' })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('match_report_player_stats').delete().eq('report_id', report.id);
  const statRows = draft.presentPlayers.map(playerId => {
    const player = draft.roster.find(p => p.id === playerId);
    const goals = draft.goals.filter(g => g.playerId === playerId).reduce((s, g) => s + Number(g.count), 0);
    const assists = draft.assists.filter(a => a.playerId === playerId).reduce((s, a) => s + Number(a.count), 0);
    return {
      report_id: report.id,
      match_id: draft.matchId,
      application_player_id: playerId,
      discord_id: player?.discord_id || null,
      appearance: 1,
      goals,
      assists,
      mvp: draft.mvpPlayerId === playerId ? 1 : 0
    };
  });
  if (statRows.length) await supabase.from('match_report_player_stats').insert(statRows);
  await supabase.from('matches').update({ status: 'pending_reports' }).eq('id', draft.matchId).neq('status', 'confirmed');
  await checkAndFinalizeMatch(draft.matchId);
}


function isStaffMember(member) {
  return member.permissions.has('Administrator') || member.permissions.has('ManageGuild');
}

function parseCompetitionSettings(type, raw) {
  const settings = {};
  if (!raw) return settings;
  for (const part of raw.split(';')) {
    const [k, v] = part.split('=').map(x => String(x || '').trim());
    if (!k || !v) continue;
    settings[k.toLowerCase()] = /^\d+$/.test(v) ? Number(v) : v;
  }
  if (type === 'league') {
    settings.gironi = settings.gironi || 1;
    settings.livello = settings.livello || 1;
    settings.promosse = settings.promosse || 0;
    settings.retrocesse = settings.retrocesse || 0;
  }
  if (type === 'european_cup') {
    settings.gironi = settings.gironi || 4;
    settings.squadre_per_girone = settings.squadre || settings.squadre_per_girone || 4;
    settings.qualificate_per_girone = settings.qualificate || settings.qualificate_per_girone || 2;
  }
  return settings;
}

function competitionTypeLabel(type) {
  if (type === 'league') return 'Campionato';
  if (type === 'national_cup') return 'Coppa Nazionale';
  if (type === 'european_cup') return 'Coppa Europea';
  return 'Competizione';
}

function buildCompetitionTypeSelect() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_type_select')
      .setPlaceholder('Scegli il tipo di competizione')
      .addOptions([
        { label: 'Campionato', value: 'league', description: 'Serie A, Serie B, campionati a gironi' },
        { label: 'Coppa Nazionale', value: 'national_cup', description: 'Tabellone nazionale, andata/ritorno, finale secca' },
        { label: 'Coppa Europea', value: 'european_cup', description: 'Gironi + fase finale europea' }
      ])
  );
}

function buildCompetitionEmbed(draft) {
  const selected = draft.selectedClubIds?.length || 0;
  const settingsText = Object.keys(draft.settings || {}).length
    ? Object.entries(draft.settings).map(([k, v]) => `• ${k}: ${v}`).join('\n')
    : 'Nessuna impostazione speciale';

  return new EmbedBuilder()
    .setTitle('🏆 Creazione Competizione')
    .setColor(0xd4af37)
    .setDescription('Step 1: crea la competizione e seleziona le squadre partecipanti.')
    .addFields(
      { name: 'Tipo', value: competitionTypeLabel(draft.type), inline: true },
      { name: 'Nome', value: draft.name || 'Da inserire', inline: true },
      { name: 'Stagione', value: draft.season || 'Da inserire', inline: true },
      { name: 'Nazione / Area', value: draft.nation || 'Non specificata', inline: true },
      { name: 'Squadre selezionate', value: String(selected), inline: true },
      { name: 'Impostazioni', value: settingsText.slice(0, 1024) },
      { name: 'Collegamento campionati', value: draft.settings?.collegata_a ? `Collegata a: ${draft.settings.collegata_a}` : 'Non collegata', inline: false }
    )
    .setFooter({ text: 'RPCI • Step 1 competizioni' })
    .setTimestamp();
}

function buildCompetitionClubSelect(draft) {
  const clubs = draft.clubs || [];
  const page = draft.clubPage || 0;
  const start = page * COMPETITION_CLUBS_PER_PAGE;
  const pageClubs = clubs.slice(start, start + COMPETITION_CLUBS_PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_club_select')
      .setPlaceholder(`Seleziona squadre da aggiungere (${draft.selectedClubIds?.length || 0}/${clubs.length})`)
      .setMinValues(1)
      .setMaxValues(Math.max(1, Math.min(25, pageClubs.length)))
      .addOptions(pageClubs.map(club => ({
        label: club.name.slice(0, 100),
        description: club.short_name ? `Tag: ${club.short_name}` : 'Club approvato',
        value: club.id
      })))
  );
}

function buildCompetitionButtons(draft) {
  const totalPages = Math.max(1, Math.ceil((draft.clubs || []).length / COMPETITION_CLUBS_PER_PAGE));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('competition_prev_page')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.clubPage || 0) <= 0),
    new ButtonBuilder()
      .setCustomId('competition_next_page')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.clubPage || 0) >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('competition_confirm')
      .setLabel('CREA COMPETIZIONE')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!draft.name || !draft.selectedClubIds || draft.selectedClubIds.length < 2),
    new ButtonBuilder()
      .setCustomId('competition_cancel')
      .setLabel('ANNULLA')
      .setStyle(ButtonStyle.Danger)
  );
}


function buildNumberSelect(customId, placeholder, min, max, currentValue = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        Array.from({ length: max - min + 1 }, (_, i) => {
          const value = String(min + i);
          return {
            label: value,
            value
          };
        })
      )
  );
}


function buildCompetitionLevelSelect(draft) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_level_select')
      .setPlaceholder('Livello campionato')
      .addOptions([
        { label: 'Campionato superiore', value: 'superiore', description: 'Esempio: Serie A' },
        { label: 'Campionato inferiore', value: 'inferiore', description: 'Esempio: Serie B' },
        { label: 'Campionato unico / non collegato', value: 'unico', description: 'Nessuna promozione-retrocessione collegata' }
      ])
  );
}

function buildLinkedCompetitionSelect(draft) {
  const comps = draft.existingLeagueCompetitions || [];
  if (!comps.length) return null;

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('competition_linked_league_select')
      .setPlaceholder('Collega a un altro campionato')
      .addOptions(
        comps.slice(0, 25).map(comp => ({
          label: `${comp.name} • ${comp.season}`.slice(0, 100),
          description: 'Usato per promozioni/retrocessioni'.slice(0, 100),
          value: comp.id
        }))
      )
  );
}

function buildCompetitionComponents(draft) {
  const components = [];

  if (draft.type === 'league') {
    components.push(
      buildNumberSelect(
        'competition_groups_select',
        'Numero gironi: 1-10',
        1,
        10,
        draft.settings?.gironi ?? 1
      )
    );

    components.push(
      buildNumberSelect(
        'competition_promoted_select',
        'Promozioni: 0-10',
        0,
        10,
        draft.settings?.promosse ?? 0
      )
    );

    components.push(
      buildNumberSelect(
        'competition_relegated_select',
        'Retrocessioni: 0-10',
        0,
        10,
        draft.settings?.retrocesse ?? 0
      )
    );
  }

  if ((draft.clubs || []).length > 0) {
    components.push(buildCompetitionClubSelect(draft));
  }

  components.push(buildCompetitionButtons(draft));

  return components.slice(0, 5);
}

async function updateCompetitionMessage(interaction, draft) {
  return interaction.update({
    embeds: [buildCompetitionEmbed(draft)],
    components: buildCompetitionComponents(draft)
  });
}

async function openCompetitionModal(interaction, type) {
  const modal = new ModalBuilder()
    .setCustomId(`competition_modal_${type}`)
    .setTitle(`Crea ${competitionTypeLabel(type)}`);

  const name = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('NOME COMPETIZIONE')
    .setPlaceholder('Esempio: Serie A RPCI')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const season = new TextInputBuilder()
    .setCustomId('season')
    .setLabel('STAGIONE')
    .setPlaceholder('Esempio: 2026/27')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const nation = new TextInputBuilder()
    .setCustomId('nation')
    .setLabel(type === 'european_cup' ? 'AREA' : 'NAZIONE / AREA')
    .setPlaceholder(type === 'european_cup' ? 'Europa' : 'Italia, Inghilterra, ecc.')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(season),
    new ActionRowBuilder().addComponents(nation)
  );

  return interaction.showModal(modal);
}

async function saveCompetitionDraft(draft, createdByDiscordId) {
  const { data: competition, error } = await supabase
    .from('competitions')
    .insert({
      name: draft.name,
      type: draft.type,
      season: draft.season,
      logo_url: draft.logoUrl,
      nation: draft.nation,
      settings: draft.settings || {},
      status: 'setup',
      created_by_discord_id: createdByDiscordId
    })
    .select()
    .single();

  if (error) throw error;

  const selected = draft.clubs.filter(c => draft.selectedClubIds.includes(c.id));
  if (selected.length > 0) {
    const rows = selected.map((club, index) => ({
      competition_id: competition.id,
      club_id: club.id,
      club_name: club.name,
      application_id: club.application_id || null,
      group_name: null,
      seed_number: index + 1
    }));

    const { error: partError } = await supabase
      .from('competition_participants')
      .insert(rows);

    if (partError) throw partError;
  }

  return competition;
}

async function getApprovedClubsWithApplications() {
  const { data, error } = await supabase
    .from('club_applications')
    .select('id, club_id, status, clubs(id, name, short_name, logo_url, status)')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.error('Errore getApprovedClubsWithApplications:', error);
    return [];
  }

  const seen = new Set();
  const result = [];

  for (const app of data) {
    const club = app.clubs;
    if (!club || seen.has(club.id)) continue;

    seen.add(club.id);
    result.push({
      id: club.id,
      name: club.name,
      short_name: club.short_name,
      logo_url: club.logo_url,
      status: club.status,
      application_id: app.id
    });
  }

  return result.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}


async function getExistingLeagueCompetitionsForLink(currentName = null) {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, name, season, type, settings, status')
    .eq('type', 'league')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.filter(c => !currentName || c.name !== currentName);
}


async function getApprovedApplicationByClubId(clubId) {
  const { data, error } = await supabase
    .from('club_applications')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Errore getApprovedApplicationByClubId:', error);
    return null;
  }

  return data || null;
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      await logBotCommand(interaction);

      if (interaction.commandName === 'crea_competizione') {
        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!isStaffMember(member)) {
          return interaction.reply({
            content: '❌ Solo lo staff può creare competizioni.',
            flags: MessageFlags.Ephemeral
          });
        }

        return interaction.reply({
          content: '🏆 Seleziona il tipo di competizione da creare.',
          components: [buildCompetitionTypeSelect()],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'registrati') {
        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const eaId = interaction.options.getString('ea_id');
        const ruolo = interaction.options.getString('ruolo');

        const { player } = await getOrCreateUserAndPlayer(
          interaction.user,
          eaId,
          ruolo
        );

        if (player && player.ea_id !== eaId) {
          return interaction.editReply(
            '❌ Sei già registrato nel sistema RPCI.'
          );
        }

        return interaction.editReply(
          `✅ Registrazione completata!\n\n` +
          `🎮 EA ID: ${eaId}\n` +
          `⚽ Ruolo: ${ruolo}\n\n` +
          `Benvenuto in RPCI.`
        );
      }

      if (interaction.commandName === 'avvia_iscrizioni') {
        if (interaction.channelId !== ALLOWED_REGISTRATION_CHANNEL_ID) {
          return interaction.reply({
            content: '❌ Questo comando può essere usato solo nel canale iscrizioni ufficiale.',
            flags: MessageFlags.Ephemeral
          });
        }

        const member = await interaction.guild.members.fetch(
          interaction.user.id
        );

        if (!member.permissions.has('Administrator')) {
          return interaction.reply({
            content: '❌ Solo lo staff può avviare le iscrizioni.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.channel.send(buildPanel());

        return interaction.reply({
          content: '✅ Pannello iscrizioni pubblicato.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'offerta') {
        if (interaction.channelId !== OFFERS_CHANNEL_ID) {
          return interaction.reply({
            content: '❌ Questo comando può essere usato solo nel canale offerte ufficiale.',
            flags: MessageFlags.Ephemeral
          });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);

        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({
            content: '❌ Solo i capitani possono fare offerte.',
            flags: MessageFlags.Ephemeral
          });
        }

        const clubs = await getApprovedClubs();

        if (clubs.length === 0) {
          return interaction.reply({
            content: '❌ Non ci sono squadre approvate disponibili.',
            flags: MessageFlags.Ephemeral
          });
        }

        offerDrafts.set(interaction.user.id, {
          captainDiscordId: interaction.user.id,
          clubs,
          clubPage: 0,
          targetClubId: null,
          targetClubName: null,
          targetApplicationId: null,
          players: [],
          playerPage: 0,
          selectedApplicationPlayerId: null,
          playerDiscordId: null,
          playerPlatform: null,
          playerPlatformId: null,
          contractYears: null,
          transferFee: null,
          salary: null
        });

        const draft = offerDrafts.get(interaction.user.id);

        return interaction.reply({
          embeds: [buildOfferPanelEmbed(draft)],
          components: await buildOfferComponents(draft),
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'referto') {
        if (interaction.channelId !== MATCH_REPORTS_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa /referto solo nel canale referti.', flags: MessageFlags.Ephemeral });
        }
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono compilare i referti.', flags: MessageFlags.Ephemeral });
        }
        const { captainApplication, matches } = await getCaptainOpenMatches(interaction.user.id);
        if (!captainApplication) return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        if (!matches.length) return interaction.reply({ content: '❌ Non ci sono partite da refertare per la tua squadra.', flags: MessageFlags.Ephemeral });
        matchReportDrafts.set(interaction.user.id, {
          applicationId: captainApplication.id,
          clubName: captainApplication.clubs?.name || 'Club',
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
          embeds: [new EmbedBuilder().setTitle('📝 Seleziona partita').setColor(0xd4af37).setDescription('Scegli la partita da refertare.')],
          components: [buildMatchSelect(matches, captainApplication.id)],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'budget') {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono vedere il budget squadra.', flags: MessageFlags.Ephemeral });
        }

        const captainApplication = await getCaptainApprovedApplication(interaction.user.id);
        if (!captainApplication) {
          return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        }

        const clubName = captainApplication.clubs?.name || 'Club del capitano';
        const info = await getClubBudgetInfo(captainApplication.id, clubName);

        return interaction.reply({ embeds: [buildBudgetEmbed(clubName, info)], flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'calcola_stipendio') {
        const tier = interaction.options.getString('fascia');
        const years = interaction.options.getInteger('anni');
        const salary = getSalaryByTier(tier);
        const total = calculateContractValue(tier, years);

        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🧮 Calcolo stipendio RPCI')
              .setColor(0xd4af37)
              .addFields(
                { name: 'Fascia', value: tier, inline: true },
                { name: 'Stipendio annuale', value: `${salary} crediti`, inline: true },
                { name: 'Durata', value: `${years} anno/i`, inline: true },
                { name: 'Costo totale contratto', value: `${total} crediti`, inline: false }
              )
              .setFooter({ text: 'RPCI • Sistema fasce dinamiche' })
              .setTimestamp()
          ],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'imposta_budget') {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '❌ Solo lo staff può impostare il budget.', flags: MessageFlags.Ephemeral });
        }

        const clubNameInput = interaction.options.getString('club').trim();
        const budgetValue = interaction.options.getInteger('budget');
        if (budgetValue < 0) {
          return interaction.reply({ content: '❌ Budget non valido.', flags: MessageFlags.Ephemeral });
        }

        const { data: club } = await supabase
          .from('clubs')
          .select('id, name')
          .eq('status', 'approved')
          .ilike('name', clubNameInput)
          .maybeSingle();

        if (!club) {
          return interaction.reply({ content: '❌ Club non trovato. Scrivi il nome esatto del club approvato.', flags: MessageFlags.Ephemeral });
        }

        const { data: app } = await supabase
          .from('club_applications')
          .select('id')
          .eq('club_id', club.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!app) {
          return interaction.reply({ content: '❌ Non trovo una iscrizione approvata per questo club.', flags: MessageFlags.Ephemeral });
        }

        await supabase
          .from('club_budgets')
          .upsert({
            club_application_id: app.id,
            club_name: club.name,
            season_budget: budgetValue,
            updated_at: new Date().toISOString()
          }, { onConflict: 'club_application_id' });

        return interaction.reply({ content: `✅ Budget impostato: **${club.name}** → **${budgetValue} crediti**.`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.commandName === 'aggiorna_statistiche') {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '❌ Solo lo staff può aggiornare le statistiche.', flags: MessageFlags.Ephemeral });
        }

        const target = interaction.options.getUser('player');
        const payload = {};
        const presenze = interaction.options.getInteger('presenze');
        const gol = interaction.options.getInteger('gol');
        const assist = interaction.options.getInteger('assist');
        const cleanSheet = interaction.options.getInteger('clean_sheet');
        const mvp = interaction.options.getInteger('mvp');
        const potential = interaction.options.getString('potenziale');

        if (presenze !== null) payload.appearances = presenze;
        if (gol !== null) payload.goals = gol;
        if (assist !== null) payload.assists = assist;
        if (cleanSheet !== null) payload.clean_sheets = cleanSheet;
        if (mvp !== null) payload.mvp_awards = mvp;
        if (potential) payload.potential = potential;

        if (Object.keys(payload).length === 0) {
          return interaction.reply({ content: '❌ Inserisci almeno una statistica da aggiornare.', flags: MessageFlags.Ephemeral });
        }

        const { data: rows } = await supabase
          .from('club_application_players')
          .select('*')
          .eq('discord_id', target.id)
          .eq('response_status', 'accepted')
          .order('created_at', { ascending: false })
          .limit(1);

        const player = rows?.[0];
        if (!player) {
          return interaction.reply({ content: '❌ Player non trovato in una rosa attiva.', flags: MessageFlags.Ephemeral });
        }

        await supabase
          .from('club_application_players')
          .update(payload)
          .eq('id', player.id);

        const updated = await recalculatePlayerEconomyByDiscordId(target.id);

        return interaction.reply({
          content:
            `✅ Statistiche aggiornate per <@${target.id}>.\n` +
            `Fascia: **${updated.player_tier}** • Punti: **${updated.performance_points}** • Stipendio: **${updated.salary_per_year} crediti/anno**`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'aggiorna_fasce') {
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.permissions.has('Administrator')) {
          return interaction.reply({ content: '❌ Solo lo staff può aggiornare le fasce.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const count = await recalculateAllPlayerEconomy();
        return interaction.editReply(`✅ Fasce ricalcolate per **${count}** player.`);
      }

      if (interaction.commandName === 'deposita_contratto') {
        if (interaction.channelId !== CONTRACTS_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa questo comando solo nel canale contratti.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono depositare contratti.', flags: MessageFlags.Ephemeral });
        }

        const players = await getFreeAgentProfilesFromGuild(interaction.guild);
        if (players.length === 0) {
          return interaction.reply({ content: '❌ Non ci sono free agent disponibili.', flags: MessageFlags.Ephemeral });
        }

        contractDrafts.set(interaction.user.id, { players, page: 0, selectedPlayer: null, contractYears: null, salary: null });
        const draft = contractDrafts.get(interaction.user.id);

        return interaction.reply({
          embeds: [buildDepositContractEmbed(draft)],
          components: await buildDepositContractComponents(draft),
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.commandName === 'cerco_squadra') {
        if (interaction.channelId !== PLAYER_LOOKING_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa questo comando solo nel canale player cerca squadra.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (member?.roles.cache.has(PLAYER_ROLE_ID)) {
          return interaction.reply({
            content: '❌ Sei già tesserato in una squadra. Per cercare un trasferimento usa `/richiesta_trasferimento` nel canale richieste trasferimento, oppure attendi la scadenza del contratto.',
            flags: MessageFlags.Ephemeral
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('looking_team_modal')
          .setTitle('Cerco squadra');

        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('NOME').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('age').setLabel('ETÀ').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('PS5 / XBOX / PC').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform_id').setLabel('ID CONSOLE').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('overall').setLabel('OVERALL').setStyle(TextInputStyle.Short).setRequired(true))
        );

        return interaction.showModal(modal);
      }

      if (interaction.commandName === 'richiesta_trasferimento') {
        if (interaction.channelId !== TRANSFER_REQUEST_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa questo comando solo nel canale richieste trasferimento.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member?.roles.cache.has(PLAYER_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i player tesserati possono inviare una richiesta trasferimento.', flags: MessageFlags.Ephemeral });
        }

        const currentClub = await getCurrentPlayerClub(interaction.user.id);
        if (!currentClub) {
          return interaction.reply({ content: '❌ Non trovo una squadra attuale collegata al tuo profilo.', flags: MessageFlags.Ephemeral });
        }

        const modal = new ModalBuilder()
          .setCustomId('transfer_request_modal')
          .setTitle('Richiesta trasferimento');

        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('NOME').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('age').setLabel('ETÀ').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform').setLabel('PS5 / XBOX / PC').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('platform_id').setLabel('ID CONSOLE').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('overall').setLabel('OVERALL').setStyle(TextInputStyle.Short).setRequired(true))
        );

        return interaction.showModal(modal);
      }

      if (interaction.commandName === 'squadra_cerca') {
        if (interaction.channelId !== TEAM_LOOKING_CHANNEL_ID) {
          return interaction.reply({ content: '❌ Usa questo comando solo nel canale squadra cerca player.', flags: MessageFlags.Ephemeral });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono usare questo comando.', flags: MessageFlags.Ephemeral });
        }

        const clubInfo = await getCaptainClubInfo(interaction.user.id);
        if (!clubInfo) {
          return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        }

        teamSearchDrafts.set(interaction.user.id, {
          count: null,
          roles: [],
          clubInfo
        });

        const draft = teamSearchDrafts.get(interaction.user.id);

        return interaction.reply({
          embeds: [buildTeamSearchSetupEmbed(draft)],
          components: [buildTeamSearchCountSelect()],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (
        interaction.customId === 'competition_groups_select' ||
        interaction.customId === 'competition_promoted_select' ||
        interaction.customId === 'competition_relegated_select'
      ) {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna competizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const value = Number(interaction.values[0]);

        if (interaction.customId === 'competition_groups_select') {
          draft.settings.gironi = value;
        }

        if (interaction.customId === 'competition_promoted_select') {
          draft.settings.promosse = value;
        }

        if (interaction.customId === 'competition_relegated_select') {
          draft.settings.retrocesse = value;
        }

        return interaction.update({
          embeds: [buildCompetitionEmbed(draft)],
          components: buildCompetitionComponents(draft)
        });
      }

      if (interaction.customId === 'competition_club_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna competizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        for (const clubId of interaction.values) {
          if (!draft.selectedClubIds.includes(clubId)) {
            draft.selectedClubIds.push(clubId);
          }
        }

        return interaction.update({
          embeds: [buildCompetitionEmbed(draft)],
          components: buildCompetitionComponents(draft)
        });
      }

      if (interaction.customId === 'match_report_match_select') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        const matchId = interaction.values[0];
        const match = draft.matches.find(m => m.id === matchId);
        if (!match) return interaction.reply({ content: '❌ Partita non valida.', flags: MessageFlags.Ephemeral });
        const roster = await getClubRoster(match.home_application_id === draft.applicationId ? match.home_club_id : match.away_club_id);
        const directRoster = roster.length ? roster : (await supabase.from('club_application_players').select('*').eq('application_id', draft.applicationId).eq('response_status', 'accepted')).data || [];
        if (!directRoster.length) return interaction.reply({ content: '❌ Non trovo giocatori in rosa per questa squadra.', flags: MessageFlags.Ephemeral });
        draft.matchId = match.id;
        draft.match = match;
        draft.matchLabel = `${match.home_club_name} vs ${match.away_club_name}`;
        draft.roster = directRoster;
        draft.presentPlayers = [];
        draft.goals = [];
        draft.assists = [];
        draft.mvpPlayerId = null;
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'match_report_present_select') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.presentPlayers = interaction.values;
        return updateMatchReportMessage(interaction, draft);
      }

      if (interaction.customId === 'match_report_goal_player_select') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.pendingStatPlayerId = interaction.values[0];
        return interaction.showModal(buildCountModal('match_report_goal_count_modal', 'Gol giocatore', 'Numero gol'));
      }

      if (interaction.customId === 'match_report_assist_player_select') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.pendingStatPlayerId = interaction.values[0];
        return interaction.showModal(buildCountModal('match_report_assist_count_modal', 'Assist giocatore', 'Numero assist'));
      }

      if (interaction.customId === 'match_report_mvp_player_select') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        draft.mvpPlayerId = interaction.values[0];
        return updateMatchReportMessage(interaction, draft);
      }

      if (interaction.customId === 'team_search_count_select') {
        const draft = teamSearchDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna ricerca player in corso.', flags: MessageFlags.Ephemeral });

        const count = Number(interaction.values[0]);
        if (![1, 2, 3, 4, 5].includes(count)) {
          return interaction.reply({ content: '❌ Numero non valido.', flags: MessageFlags.Ephemeral });
        }

        draft.count = count;
        draft.roles = Array(count).fill(null);

        return interaction.update({
          embeds: [buildTeamSearchSetupEmbed(draft)],
          components: buildTeamSearchRolesComponents(draft)
        });
      }

      if (interaction.customId.startsWith('team_search_role_')) {
        const draft = teamSearchDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna ricerca player in corso.', flags: MessageFlags.Ephemeral });

        const index = Number(interaction.customId.replace('team_search_role_', ''));
        const role = interaction.values[0];

        if (Number.isNaN(index) || index < 0 || index >= draft.count || !GAME_ROLES.includes(role)) {
          return interaction.reply({ content: '❌ Ruolo non valido.', flags: MessageFlags.Ephemeral });
        }

        draft.roles[index] = role;

        if (draft.roles.every(Boolean)) {
          return publishTeamSearch(interaction, draft);
        }

        return interaction.update({
          embeds: [buildTeamSearchSetupEmbed(draft)],
          components: buildTeamSearchRolesComponents(draft)
        });
      }

      if (interaction.customId === 'contract_player_select') {
        const draft = contractDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun contratto in corso.', flags: MessageFlags.Ephemeral });
        const player = draft.players.find(p => p.discord_id === interaction.values[0]);
        if (!player) return interaction.reply({ content: '❌ Giocatore non valido.', flags: MessageFlags.Ephemeral });
        draft.selectedPlayer = player;
        draft.contractYears = null;
        draft.salary = null;
        return interaction.update({ embeds: [buildDepositContractEmbed(draft)], components: await buildDepositContractComponents(draft) });
      }

      if (interaction.customId === 'deposit_contract_years_select') {
        const draft = contractDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun contratto in corso.', flags: MessageFlags.Ephemeral });
        draft.contractYears = interaction.values[0];
        return interaction.update({ embeds: [buildDepositContractEmbed(draft)], components: await buildDepositContractComponents(draft) });
      }

      if (interaction.customId === 'transfer_request_role_select') {
        const draft = transferRequestDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta trasferimento in corso.', flags: MessageFlags.Ephemeral });

        const primaryRole = interaction.values[0];
        if (!GAME_ROLES.includes(primaryRole)) {
          return interaction.reply({ content: '❌ Ruolo principale non valido.', flags: MessageFlags.Ephemeral });
        }

        draft.primary_role = primaryRole;
        draft.secondary_role = null;

        return interaction.update({
          content: `✅ Ruolo principale selezionato: **${primaryRole}**.\n\nOra seleziona il **ruolo secondario** oppure **NO**.`,
          components: [buildTransferRequestSecondaryRoleSelect(primaryRole)]
        });
      }

      if (interaction.customId === 'transfer_request_secondary_role_select') {
        const draft = transferRequestDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta trasferimento in corso.', flags: MessageFlags.Ephemeral });

        const secondaryRole = interaction.values[0];
        if (secondaryRole !== 'NO' && !GAME_ROLES.includes(secondaryRole)) {
          return interaction.reply({ content: '❌ Ruolo secondario non valido.', flags: MessageFlags.Ephemeral });
        }
        if (secondaryRole !== 'NO' && secondaryRole === draft.primary_role) {
          return interaction.reply({ content: '❌ Il ruolo secondario non può essere uguale al ruolo principale.', flags: MessageFlags.Ephemeral });
        }

        draft.secondary_role = secondaryRole;

        const modal = new ModalBuilder()
          .setCustomId('transfer_request_description_modal')
          .setTitle('Esperienze');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('DESCRIZIONE ESPERIENZE')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(1000)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'looking_role_select') {
        const draft = lookingDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta cerco squadra in corso.', flags: MessageFlags.Ephemeral });

        const primaryRole = interaction.values[0];

        if (!GAME_ROLES.includes(primaryRole)) {
          return interaction.reply({
            content: '❌ Ruolo principale non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.primary_role = primaryRole;
        draft.secondary_role = null;

        return interaction.update({
          content:
            `✅ Ruolo principale selezionato: **${primaryRole}**.\n\n` +
            'Ora seleziona il **ruolo secondario** oppure **NO**.',
          components: [
            buildLookingSecondaryRoleSelect(primaryRole)
          ]
        });
      }

      if (interaction.customId === 'looking_secondary_role_select') {
        const draft = lookingDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta cerco squadra in corso.', flags: MessageFlags.Ephemeral });

        const secondaryRole = interaction.values[0];

        if (secondaryRole !== 'NO' && !GAME_ROLES.includes(secondaryRole)) {
          return interaction.reply({
            content: '❌ Ruolo secondario non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (secondaryRole !== 'NO' && secondaryRole === draft.primary_role) {
          return interaction.reply({
            content: '❌ Il ruolo secondario non può essere uguale al ruolo principale.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.secondary_role = secondaryRole;

        const modal = new ModalBuilder()
          .setCustomId('looking_description_modal')
          .setTitle('Esperienze');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('description')
              .setLabel('DESCRIZIONE ESPERIENZE')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'offer_club_select') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const clubId = interaction.values[0];
        const club = draft.clubs.find(c => c.id === clubId);

        if (!club) {
          return interaction.reply({
            content: '❌ Squadra non valida.',
            flags: MessageFlags.Ephemeral
          });
        }

        const players = await getClubRoster(clubId);
        const { data: targetApplication } = await supabase
  .from('club_applications')
  .select('id')
  .eq('club_id', clubId)
  .eq('status', 'approved')
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

draft.targetApplicationId = targetApplication?.id || null;

        if (players.length === 0) {
          return interaction.reply({
            content: '❌ Questa squadra non ha giocatori accettati in rosa.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.targetClubId = club.id;
        draft.targetClubName = club.name;
        draft.players = players;
        draft.playerPage = 0;
        draft.selectedApplicationPlayerId = null;
        draft.playerDiscordId = null;
        draft.playerPlatform = null;
        draft.playerPlatformId = null;
        draft.contractYears = null;
        draft.transferFee = null;
        draft.salary = null;

        return updateOfferDraftMessage(interaction, draft);
      }

      if (interaction.customId === 'offer_player_select') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const selectedId = interaction.values[0];
        const player = draft.players.find(p => p.id === selectedId);

        if (!player) {
          return interaction.reply({
            content: '❌ Giocatore non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.selectedApplicationPlayerId = player.id;
        draft.playerDiscordId = player.discord_id;
        draft.playerPlatform = player.platform || 'N/D';
        draft.playerPlatformId = player.platform_id || 'N/D';
        draft.selectedPlayerTier = player.player_tier || 'BASSA';
        draft.contractYears = null;
        draft.transferFee = null;
        draft.salary = null;

        return updateOfferDraftMessage(interaction, draft);
      }

      if (interaction.customId === 'offer_contract_select') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.contractYears = interaction.values[0];
        draft.transferFee = null;
        draft.salary = null;

        return updateOfferDraftMessage(interaction, draft);
      }

      if (interaction.customId === 'primary_role_select') {
        const draft = drafts.get(interaction.user.id);

        if (!draft || !draft.pendingPlayer) {
          return interaction.reply({
            content: '❌ Nessun giocatore in attesa di ruolo.',
            flags: MessageFlags.Ephemeral
          });
        }

        const primaryRole = interaction.values[0];

        if (!GAME_ROLES.includes(primaryRole)) {
          return interaction.reply({
            content: '❌ Ruolo principale non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.pendingPlayer.primary_role = primaryRole;

        return interaction.update({
          content:
            `✅ Ruolo principale selezionato: **${primaryRole}**.

` +
            'Ora seleziona il **ruolo secondario** oppure **NO**.',
          components: [
            buildSecondaryRoleSelect(primaryRole)
          ]
        });
      }

      if (interaction.customId === 'secondary_role_select') {
        const draft = drafts.get(interaction.user.id);

        if (!draft || !draft.pendingPlayer) {
          return interaction.reply({
            content: '❌ Nessun giocatore in attesa di ruolo.',
            flags: MessageFlags.Ephemeral
          });
        }

        const secondaryRole = interaction.values[0];

        if (secondaryRole !== 'NO' && !GAME_ROLES.includes(secondaryRole)) {
          return interaction.reply({
            content: '❌ Ruolo secondario non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (secondaryRole !== 'NO' && secondaryRole === draft.pendingPlayer.primary_role) {
          return interaction.reply({
            content: '❌ Il ruolo secondario non può essere uguale al ruolo principale.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.pendingPlayer.secondary_role = secondaryRole;

        return completePendingRegistrationPlayer(interaction, draft);
      }

      if (interaction.customId === 'roster_select') {
        const draft = drafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna iscrizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.rosterSize = Number(interaction.values[0]);
        draft.players = [];
        draft.pendingPlayer = null;

        return interaction.update({
          content:
            `✅ Hai selezionato **${draft.rosterSize} giocatori in rosa**.\n\n` +
            'Premi il pulsante qui sotto per inserire il primo giocatore.',
          components: [
            buildAddPlayerButton(draft)
          ]
        });
      }
    }


    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'competition_type_select') {
        const type = interaction.values[0];
        if (!['league', 'national_cup', 'european_cup'].includes(type)) {
          return interaction.reply({
            content: '❌ Tipo competizione non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        return openCompetitionModal(interaction, type);
      }

      if (interaction.customId === 'competition_club_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna competizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        for (const clubId of interaction.values) {
          if (!draft.selectedClubIds.includes(clubId)) {
            draft.selectedClubIds.push(clubId);
          }
        }

        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_groups_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });
        }
        draft.settings.gironi = Number(interaction.values[0]);
        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_promoted_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });
        }
        draft.settings.promosse = Number(interaction.values[0]);
        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_relegated_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });
        }
        draft.settings.retrocesse = Number(interaction.values[0]);
        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_level_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });
        }
        draft.settings.livello = interaction.values[0];
        if (draft.settings.livello === 'unico') {
          draft.settings.collegata_a = null;
          draft.settings.collegata_competizione_id = null;
        }
        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_linked_league_select') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });
        }
        const comp = (draft.existingLeagueCompetitions || []).find(c => c.id === interaction.values[0]);
        if (!comp) {
          return interaction.reply({ content: '❌ Campionato collegato non valido.', flags: MessageFlags.Ephemeral });
        }
        draft.settings.collegata_competizione_id = comp.id;
        draft.settings.collegata_a = `${comp.name} (${comp.season})`;
        return updateCompetitionMessage(interaction, draft);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('competition_modal_')) {
        const type = interaction.customId.replace('competition_modal_', '');

        const name = interaction.fields.getTextInputValue('name').trim();
        const season = interaction.fields.getTextInputValue('season').trim();
        const nation = interaction.fields.getTextInputValue('nation')?.trim() || null;

        const defaultSettings = type === 'league'
          ? { gironi: 1, promosse: 0, retrocesse: 0, livello: null, collegata_a: null }
          : parseCompetitionSettings(type, null);

        competitionDrafts.set(interaction.user.id, {
          type,
          name,
          season,
          logoUrl: null,
          nation,
          settings: defaultSettings,
          clubs: [],
          clubPage: 0,
          selectedClubIds: [],
          awaitingLogo: true
        });

        const logoButton = new ButtonBuilder()
          .setCustomId('competition_logo_url_button')
          .setLabel('INSERISCI LOGO')
          .setStyle(ButtonStyle.Primary);

        return interaction.reply({
          content:
            '📎 Ora inserisci il **logo della competizione**.\n\n' +
            'Carica il logo su Discord o dove preferisci, copia il link immagine e premi **INSERISCI LOGO**.',
          components: [new ActionRowBuilder().addComponents(logoButton)],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'competition_logo_url_button') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft || !draft.awaitingLogo) {
          return interaction.reply({
            content: '❌ Nessuna competizione in attesa di logo.',
            flags: MessageFlags.Ephemeral
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('competition_logo_url_modal')
          .setTitle('Logo competizione');

        const logoUrl = new TextInputBuilder()
          .setCustomId('logo_url')
          .setLabel('LINK LOGO IMMAGINE')
          .setPlaceholder('Incolla il link immagine del logo')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(logoUrl));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'competition_prev_page' || interaction.customId === 'competition_next_page') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });

        const totalPages = Math.max(1, Math.ceil((draft.clubs || []).length / COMPETITION_CLUBS_PER_PAGE));
        if (interaction.customId === 'competition_prev_page') {
          draft.clubPage = Math.max(0, (draft.clubPage || 0) - 1);
        } else {
          draft.clubPage = Math.min(totalPages - 1, (draft.clubPage || 0) + 1);
        }

        return updateCompetitionMessage(interaction, draft);
      }

      if (interaction.customId === 'competition_cancel') {
        competitionDrafts.delete(interaction.user.id);
        return interaction.update({
          content: '❌ Creazione competizione annullata.',
          embeds: [],
          components: []
        });
      }

      if (interaction.customId === 'competition_confirm') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna competizione in corso.', flags: MessageFlags.Ephemeral });

        if (!draft.name || !draft.selectedClubIds || draft.selectedClubIds.length < 2) {
          return interaction.reply({
            content: '❌ Inserisci almeno 2 squadre partecipanti.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferUpdate();

        const competition = await saveCompetitionDraft(draft, interaction.user.id);
        competitionDrafts.delete(interaction.user.id);

        return interaction.editReply({
          content: `✅ Competizione **${competition.name}** creata correttamente. Ora puoi usare /genera_calendario.`,
          embeds: [],
          components: []
        });
      }

      if (interaction.customId === 'match_report_set_score') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        const modal = new ModalBuilder().setCustomId('match_report_score_modal').setTitle('Risultato partita');
        const gf = new TextInputBuilder().setCustomId('goals_for').setLabel('Gol fatti dalla tua squadra').setStyle(TextInputStyle.Short).setRequired(true);
        const ga = new TextInputBuilder().setCustomId('goals_against').setLabel('Gol subiti dalla tua squadra').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(gf), new ActionRowBuilder().addComponents(ga));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'match_report_add_goal') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: [buildPlayerForStatSelect(draft, 'goal'), buildReportActionButtons(draft)] });
      }

      if (interaction.customId === 'match_report_add_assist') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: [buildPlayerForStatSelect(draft, 'assist'), buildReportActionButtons(draft)] });
      }

      if (interaction.customId === 'match_report_select_mvp') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: [buildPlayerForStatSelect(draft, 'mvp'), buildReportActionButtons(draft)] });
      }

      if (interaction.customId === 'match_report_confirm') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        if (!draft.scoreSet || !draft.presentPlayers.length) return interaction.reply({ content: '❌ Inserisci risultato e presenti prima di confermare.', flags: MessageFlags.Ephemeral });
        await submitMatchReport(interaction, draft);
        matchReportDrafts.delete(interaction.user.id);
        return interaction.update({ content: '✅ Referto inviato. Le statistiche verranno aggiornate appena anche l’altro capitano invia un referto combaciante.', embeds: [], components: [] });
      }

      if (interaction.customId.startsWith('tr_contact_owner_')) {
        const requestId = interaction.customId.replace('tr_contact_owner_', '');
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono contattare il capitano del club.', flags: MessageFlags.Ephemeral });
        }

        const { data: request } = await supabase
          .from('transfer_requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (!request || request.status !== 'open') {
          return interaction.reply({ content: '❌ Richiesta trasferimento non disponibile.', flags: MessageFlags.Ephemeral });
        }

        const interestedApplication = await getCaptainApprovedApplication(interaction.user.id);
        if (!interestedApplication) {
          return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        }

        if (request.current_captain_discord_id === interaction.user.id) {
          return interaction.reply({ content: '❌ Non puoi contattare te stesso per un tuo giocatore.', flags: MessageFlags.Ephemeral });
        }

        const ownerCaptainId = request.current_captain_discord_id;
        if (!ownerCaptainId) {
          return interaction.reply({ content: '❌ Non trovo il capitano della squadra attuale del player.', flags: MessageFlags.Ephemeral });
        }

        const fromClubName = interestedApplication.clubs?.name || 'Club del capitano';
        const ownerClubName = request.current_club_name || 'Club attuale';

        const { data: contactRow } = await supabase
          .from('transfer_request_contacts')
          .insert({
            transfer_request_id: request.id,
            requester_captain_discord_id: interaction.user.id,
            requester_club_name: fromClubName,
            owner_captain_discord_id: ownerCaptainId,
            owner_club_name: ownerClubName,
            player_discord_id: request.discord_id,
            player_platform_id: request.platform_id,
            status: 'pending'
          })
          .select()
          .single();

        if (!contactRow) {
          return interaction.reply({ content: '❌ Errore nella creazione della richiesta di trattativa.', flags: MessageFlags.Ephemeral });
        }

        const ownerUser = await client.users.fetch(ownerCaptainId).catch(() => null);
        if (ownerUser) {
          await ownerUser.send({
            content:
              `📩 SONO **${interaction.user.tag}** CAPITANO **${fromClubName}**.\n\n` +
              `Ti contatto per il tuo giocatore **${request.platform_id || request.name || 'player'}** ` +
              `(${request.primary_role || 'N/D'}${request.secondary_role && request.secondary_role !== 'NO' ? `/${request.secondary_role}` : ''}).\n\n` +
              `Dato che ha richiesto il trasferimento, sarei interessato a intavolare una trattativa per il giocatore.`,
            embeds: [
              new EmbedBuilder()
                .setTitle('🤝 Richiesta di trattativa')
                .setColor(0xd4af37)
                .addFields(
                  { name: 'Club interessato', value: fromClubName, inline: true },
                  { name: 'Club proprietario', value: ownerClubName, inline: true },
                  { name: 'Player', value: `<@${request.discord_id}>`, inline: true },
                  { name: 'ID Console', value: request.platform_id || 'N/D', inline: true },
                  { name: 'Ruolo', value: `${request.primary_role || 'N/D'}${request.secondary_role && request.secondary_role !== 'NO' ? ` / ${request.secondary_role}` : ''}`, inline: true },
                  { name: 'Contratto rimanente', value: request.contract_years_remaining ? `${request.contract_years_remaining} anno/i` : 'N/D', inline: true }
                )
                .setTimestamp()
            ],
            components: [buildTransferNegotiationButtons(contactRow.id, interaction.user.id)]
          }).catch(() => null);
        }

        return interaction.reply({ content: '✅ Richiesta di trattativa inviata al capitano del club proprietario.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId.startsWith('tr_reject_contact_')) {
        const contactId = interaction.customId.replace('tr_reject_contact_', '');

        const { data: contact } = await supabase
          .from('transfer_request_contacts')
          .select('*')
          .eq('id', contactId)
          .single();

        if (!contact) {
          return interaction.reply({ content: '❌ Richiesta di trattativa non trovata.', flags: MessageFlags.Ephemeral });
        }

        if (contact.owner_captain_discord_id !== interaction.user.id) {
          return interaction.reply({ content: '❌ Solo il capitano del club proprietario può rifiutare questa trattativa.', flags: MessageFlags.Ephemeral });
        }

        await supabase
          .from('transfer_request_contacts')
          .update({ status: 'rejected', responded_at: new Date().toISOString() })
          .eq('id', contactId);

        const requesterUser = await client.users.fetch(contact.requester_captain_discord_id).catch(() => null);
        if (requesterUser) {
          await requesterUser.send(
            `❌ **RICHIESTA DI TRATTATIVA RIFIUTATA** da parte del club **${contact.owner_club_name || 'club proprietario'}**.`
          ).catch(() => null);
        }

        return interaction.update({
          content: '❌ Trattativa rifiutata. L’altro capitano è stato avvisato.',
          embeds: interaction.message.embeds,
          components: []
        });
      }

      if (interaction.customId.startsWith('fa_contact_')) {
        const playerDiscordId = interaction.customId.replace('fa_contact_', '');
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!member.roles.cache.has(CAPTAIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ Solo i capitani possono contattare i free agent.', flags: MessageFlags.Ephemeral });
        }

        const captainApplication = await getCaptainApprovedApplication(interaction.user.id);
        if (!captainApplication) {
          return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        }

        const playerUser = await client.users.fetch(playerDiscordId).catch(() => null);
        if (playerUser) {
          const contactCaptainButton = new ButtonBuilder()
            .setLabel('CONTATTA')
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/users/${interaction.user.id}`);

          await playerUser.send({
            content:
              `📩 Il capitano **${interaction.user.tag}** ti sta contattando per effettuare un provino/acquisto per il club **${captainApplication.clubs?.name || 'Club del capitano'}**.\n\n` +
              `Premi **CONTATTA** per aprire il profilo del capitano e scrivergli in privato.`,
            components: [
              new ActionRowBuilder().addComponents(contactCaptainButton)
            ]
          }).catch(() => null);
        }

        return interaction.reply({ content: '✅ Messaggio di contatto inviato al giocatore con pulsante CONTATTA.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'contract_players_prev' || interaction.customId === 'contract_players_next') {
        const draft = contractDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun contratto in corso.', flags: MessageFlags.Ephemeral });
        const totalPages = Math.max(1, Math.ceil(draft.players.length / PLAYERS_PER_PAGE));
        draft.page = interaction.customId === 'contract_players_prev' ? Math.max(0, draft.page - 1) : Math.min(totalPages - 1, draft.page + 1);
        return interaction.update({ embeds: [buildDepositContractEmbed(draft)], components: await buildDepositContractComponents(draft) });
      }

      if (interaction.customId === 'deposit_contract_cancel') {
        contractDrafts.delete(interaction.user.id);
        return interaction.update({ content: '❌ Deposito contratto annullato.', embeds: [], components: [] });
      }

      if (interaction.customId === 'deposit_salary_modal') {
        const draft = contractDrafts.get(interaction.user.id);
        if (!draft || !draft.selectedPlayer || !draft.contractYears) return interaction.reply({ content: '❌ Completa prima giocatore e anni di contratto.', flags: MessageFlags.Ephemeral });

        const modal = new ModalBuilder().setCustomId('deposit_salary_modal_submit').setTitle('Stipendio contratto');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('salary').setLabel('STIPENDIO').setPlaceholder('Esempio: 100000').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
      }

      if (interaction.customId.startsWith('fa_contract_accept_') || interaction.customId.startsWith('fa_contract_reject_')) {
        const accepted = interaction.customId.startsWith('fa_contract_accept_');
        const offerId = interaction.customId.split('_').pop();
        await finalizeFreeAgentContract(offerId, accepted, interaction);
        return interaction.update({ content: accepted ? '✅ Hai accettato il contratto.' : '❌ Hai rifiutato il contratto.', embeds: interaction.message.embeds, components: [] });
      }

      if (interaction.customId === 'offer_clubs_prev' || interaction.customId === 'offer_clubs_next') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const totalPages = Math.max(1, Math.ceil(draft.clubs.length / CLUBS_PER_PAGE));

        if (interaction.customId === 'offer_clubs_prev') {
          draft.clubPage = Math.max(0, draft.clubPage - 1);
        } else {
          draft.clubPage = Math.min(totalPages - 1, draft.clubPage + 1);
        }

        return updateOfferDraftMessage(interaction, draft);
      }

      if (interaction.customId === 'offer_players_prev' || interaction.customId === 'offer_players_next') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const totalPages = Math.max(1, Math.ceil(draft.players.length / PLAYERS_PER_PAGE));

        if (interaction.customId === 'offer_players_prev') {
          draft.playerPage = Math.max(0, draft.playerPage - 1);
        } else {
          draft.playerPage = Math.min(totalPages - 1, draft.playerPage + 1);
        }

        return updateOfferDraftMessage(interaction, draft);
      }

      if (interaction.customId === 'offer_amounts_modal') {
        const draft = offerDrafts.get(interaction.user.id);
        if (!draft || !draft.contractYears) {
          return interaction.reply({
            content: '❌ Seleziona prima squadra, giocatore e anni di contratto.',
            flags: MessageFlags.Ephemeral
          });
        }

        const modal = new ModalBuilder()
          .setCustomId('offer_amounts_modal_submit')
          .setTitle('Importi offerta');

        const transferFee = new TextInputBuilder()
          .setCustomId('transfer_fee')
          .setLabel('PREZZO ACQUISTO ALLA SQUADRA')
          .setPlaceholder('Minimo 5 • Esempio: 20')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const salary = new TextInputBuilder()
          .setCustomId('salary')
          .setLabel('STIPENDIO AL PLAYER')
          .setPlaceholder('Minimo 2 • Esempio: 10')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(transferFee),
          new ActionRowBuilder().addComponents(salary)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'offer_cancel') {
        offerDrafts.delete(interaction.user.id);

        return interaction.update({
          content: '❌ Offerta annullata.',
          embeds: [],
          components: []
        });
      }

      if (interaction.customId === 'offer_confirm') {
        const draft = offerDrafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (
          !draft.targetClubId ||
          !draft.selectedApplicationPlayerId ||
          !draft.playerDiscordId ||
          !draft.contractYears ||
          draft.transferFee === null ||
          draft.salary === null
        ) {
          return interaction.reply({
            content: '❌ Completa tutti i passaggi prima di inviare l’offerta.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { data: captainApplication } = await supabase
          .from('club_applications')
          .select('*, clubs(*)')
          .eq('captain_discord_id', interaction.user.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const fromClubName = captainApplication?.clubs?.name || 'Club del capitano';

        if (!captainApplication?.id) {
          return interaction.reply({
            content: '❌ Non trovo la tua squadra approvata.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { data: targetApplicationOwner } = await supabase
          .from('club_applications')
          .select('captain_discord_id')
          .eq('id', draft.targetApplicationId)
          .eq('status', 'approved')
          .maybeSingle();

        if (!targetApplicationOwner?.captain_discord_id) {
          return interaction.reply({
            content: '❌ Non trovo il capitano della squadra proprietaria.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { data: offer, error: offerError } = await supabase
          .from('transfer_offers')
          .insert({
  club_name: fromClubName,
  from_club_name: fromClubName,
  target_club_name: draft.targetClubName,
  captain_discord_id: interaction.user.id,

  player_ids: [draft.playerDiscordId],
  player_discord_id: draft.playerDiscordId,
  player_platform: draft.playerPlatform,
  player_platform_id: draft.playerPlatformId,

  contract: `${draft.contractYears} anno/i • Prezzo trasferimento: ${draft.transferFee} crediti • Stipendio: ${draft.salary} crediti/anno`,
  contract_years: Number(draft.contractYears),

  from_application_id: captainApplication?.id || null,
  target_application_id: draft.targetApplicationId,
  application_player_id: draft.selectedApplicationPlayerId,

  status: 'pending'
})
          .select()
          .single();

        if (offerError) throw offerError;

        const { data: offerPlayerRow, error: rowError } = await supabase
          .from('transfer_offer_players')
          .insert({
            offer_id: offer.id,
            discord_id: draft.playerDiscordId,
            response_status: 'pending'
          })
          .select()
          .single();

        if (rowError) throw rowError;

        await sendOfferToOwnerCaptain({
          id: offer.id,
          fromClubName,
          targetClubName: draft.targetClubName,
          ownerCaptainDiscordId: targetApplicationOwner.captain_discord_id,
          captainDiscordId: interaction.user.id,
          playerDiscordId: draft.playerDiscordId,
          platform: draft.playerPlatform,
          platformId: draft.playerPlatformId,
          contractYears: draft.contractYears,
          transferFee: draft.transferFee,
          salary: draft.salary
        });

        offerDrafts.delete(interaction.user.id);

        return interaction.update({
          content:
            '✅ Offerta inviata correttamente al capitano della squadra proprietaria.\n\n' +
            'Se il capitano accetta, l’offerta verrà inviata al giocatore per la risposta finale.',
          embeds: [],
          components: []
        });
      }
            if (
        interaction.customId.startsWith('owner_offer_accept_') ||
        interaction.customId.startsWith('owner_offer_reject_')
      ) {
        const acceptedByOwner = interaction.customId.startsWith('owner_offer_accept_');
        const offerId = interaction.customId.split('_').pop();

        const { data: offer } = await supabase
          .from('transfer_offers')
          .select('*')
          .eq('id', offerId)
          .single();

        if (!offer || offer.status !== 'pending') {
          return interaction.reply({
            content: '❌ Offerta non trovata o già chiusa.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { data: targetApplicationOwner } = await supabase
          .from('club_applications')
          .select('captain_discord_id')
          .eq('id', offer.target_application_id)
          .eq('status', 'approved')
          .maybeSingle();

        if (targetApplicationOwner?.captain_discord_id !== interaction.user.id) {
          return interaction.reply({
            content: '❌ Solo il capitano della squadra proprietaria può rispondere a questa offerta.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (!acceptedByOwner) {
          await supabase
            .from('transfer_offers')
            .update({
              status: 'rejected',
              closed_at: new Date().toISOString()
            })
            .eq('id', offerId);

          return interaction.update({
            content: '❌ Hai rifiutato l’offerta. Il giocatore non riceverà nessuna richiesta.',
            embeds: interaction.message.embeds,
            components: []
          });
        }

        const { data: offerPlayerRow } = await supabase
          .from('transfer_offer_players')
          .select('*')
          .eq('offer_id', offerId)
          .maybeSingle();

        if (!offerPlayerRow) {
          return interaction.reply({
            content: '❌ Riga giocatore offerta non trovata.',
            flags: MessageFlags.Ephemeral
          });
        }

        await sendOfferToPlayer({
          id: offer.id,
          fromClubName: offer.from_club_name || offer.club_name || 'Club offerente',
          targetClubName: offer.target_club_name || 'Club proprietario',
          captainDiscordId: offer.captain_discord_id,
          playerDiscordId: offer.player_discord_id,
          platform: offer.player_platform,
          platformId: offer.player_platform_id,
          contractYears: offer.contract_years,
          transferFee: 0,
          salary: 0
        }, offerPlayerRow);

        return interaction.update({
          content: '✅ Offerta accettata. Ora è stata inviata al giocatore per la risposta finale.',
          embeds: interaction.message.embeds,
          components: []
        });
      }

      if (
        interaction.customId.startsWith('offer_accept_') ||
        interaction.customId.startsWith('offer_reject_')
      ) {
        const accepted = interaction.customId.startsWith('offer_accept_');
        const offerPlayerId = interaction.customId.split('_').pop();

        const { data: offerPlayer } = await supabase
          .from('transfer_offer_players')
          .select('*')
          .eq('id', offerPlayerId)
          .single();

        if (!offerPlayer) {
          return interaction.reply({
            content: '❌ Offerta non trovata.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (offerPlayer.discord_id !== interaction.user.id) {
          return interaction.reply({
            content: '❌ Questa offerta non è destinata a te.',
            flags: MessageFlags.Ephemeral
          });
        }

        await supabase
          .from('transfer_offer_players')
          .update({
            response_status: accepted ? 'accepted' : 'rejected',
            responded_at: new Date().toISOString()
          })
          .eq('id', offerPlayerId);

        await finalizeOfferIfReady(offerPlayer.offer_id);

        return interaction.update({
          content: accepted
            ? '✅ Hai accettato l’offerta di trasferimento.'
            : '❌ Hai rifiutato l’offerta di trasferimento.',
          embeds: interaction.message.embeds,
          components: []
        });
      }

      if (interaction.customId === 'start_registration') {
        if (interaction.channelId !== ALLOWED_REGISTRATION_CHANNEL_ID) {
          return interaction.reply({
            content: '❌ Puoi iniziare l’iscrizione solo nel canale ufficiale.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { player: captainPlayer } = await getOrCreateUserAndPlayer(
          interaction.user
        );

        if (!captainPlayer) {
          return interaction.reply({
            content: '❌ Devi prima registrarti con `/registrati` prima di iscrivere una squadra.',
            flags: MessageFlags.Ephemeral
          });
        }

        drafts.set(interaction.user.id, {
          captainDiscordId: interaction.user.id,
          captainPlayerId: captainPlayer.id,
          teamName: null,
          logoUrl: null,
          rosterSize: null,
          players: [],
          pendingPlayer: null
        });

        const modal = new ModalBuilder()
          .setCustomId('team_modal')
          .setTitle('Iscrizione Squadra');

        const teamInput = new TextInputBuilder()
          .setCustomId('team_name')
          .setLabel('NOME SQUADRA')
          .setPlaceholder('Inserisci il nome della squadra')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(teamInput)
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'add_player') {
        const draft = drafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna iscrizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (!draft.rosterSize) {
          return interaction.reply({
            content: '❌ Devi prima selezionare i giocatori in rosa.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (draft.players.length >= draft.rosterSize) {
          return interaction.reply({
            content: '✅ Hai già inserito tutti i giocatori.',
            flags: MessageFlags.Ephemeral
          });
        }

        const index = draft.players.length + 1;

        const modal = new ModalBuilder()
          .setCustomId('player_modal')
          .setTitle(`Giocatore ${index}/${draft.rosterSize}`);

        const discordId = new TextInputBuilder()
          .setCustomId('discord_id')
          .setLabel('ID DISCORD')
          .setPlaceholder('Modalità sviluppatore ON → tasto destro utente → Copia ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const age = new TextInputBuilder()
          .setCustomId('age')
          .setLabel('ETÀ')
          .setPlaceholder('Esempio: 18')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const platform = new TextInputBuilder()
          .setCustomId('platform')
          .setLabel('CONSOLE')
          .setPlaceholder('Scrivi PS5, XBOX oppure PC')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const platformId = new TextInputBuilder()
          .setCustomId('platform_id')
          .setLabel('ID PS5 / XBOX / PC')
          .setPlaceholder('PSN ID, Gamertag Xbox o ID PC')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const contract = new TextInputBuilder()
          .setCustomId('contract_years')
          .setLabel('CONTRATTO')
          .setPlaceholder('Scrivi 1 oppure 2')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(discordId),
          new ActionRowBuilder().addComponents(age),
          new ActionRowBuilder().addComponents(platform),
          new ActionRowBuilder().addComponents(platformId),
          new ActionRowBuilder().addComponents(contract)
        );

        return interaction.showModal(modal);
      }

      if (
        interaction.customId.startsWith('player_accept_') ||
        interaction.customId.startsWith('player_reject_')
      ) {
        const accepted = interaction.customId.startsWith('player_accept_');
        const applicationPlayerId = interaction.customId.split('_').pop();

        const { data: appPlayer } = await supabase
          .from('club_application_players')
          .select('*')
          .eq('id', applicationPlayerId)
          .single();

        if (!appPlayer) {
          return interaction.reply({
            content: '❌ Richiesta non trovata.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (appPlayer.discord_id !== interaction.user.id) {
          return interaction.reply({
            content: '❌ Questa richiesta non è destinata a te.',
            flags: MessageFlags.Ephemeral
          });
        }

        await supabase
          .from('club_application_players')
          .update({
            response_status: accepted ? 'accepted' : 'rejected'
          })
          .eq('id', applicationPlayerId);

        await updateStaffMessage(appPlayer.application_id);

        return interaction.update({
          content: accepted
            ? '✅ Hai accettato l’iscrizione.'
            : '❌ Hai rifiutato l’iscrizione.',
          components: []
        });
      }

      if (
        interaction.customId.startsWith('staff_accept_') ||
        interaction.customId.startsWith('staff_reject_')
      ) {
        const accepted = interaction.customId.startsWith('staff_accept_');
        const applicationId = interaction.customId.split('_').pop();

        const { data: app } = await supabase
          .from('club_applications')
          .select('*, clubs(*)')
          .eq('id', applicationId)
          .single();

        const { data: players } = await supabase
          .from('club_application_players')
          .select('*')
          .eq('application_id', applicationId);

        await supabase
          .from('club_applications')
          .update({
            status: accepted ? 'approved' : 'rejected',
            reviewed_at: new Date().toISOString()
          })
          .eq('id', applicationId);

        await supabase
          .from('clubs')
          .update({
            status: accepted ? 'approved' : 'rejected'
          })
          .eq('id', app.club_id);

        if (accepted) {
          const guild = interaction.guild;

          const captainMember = await guild.members
            .fetch(app.captain_discord_id)
            .catch(() => null);

          if (captainMember) {
            await captainMember.roles.add(CAPTAIN_ROLE_ID);
          }

          for (const player of players.filter(p => p.response_status === 'accepted')) {
            const member = await guild.members
              .fetch(player.discord_id)
              .catch(() => null);

            if (member) {
              await member.roles.add(PLAYER_ROLE_ID);
            }
          }
        }

        return interaction.update({
          content: accepted
            ? '✅ Iscrizione squadra approvata dallo staff.'
            : '❌ Iscrizione squadra rifiutata dallo staff.',
          embeds: interaction.message.embeds,
          components: []
        });
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'competition_logo_url_modal') {
        const draft = competitionDrafts.get(interaction.user.id);
        if (!draft || !draft.awaitingLogo) {
          return interaction.reply({
            content: '❌ Nessuna competizione in attesa di logo.',
            flags: MessageFlags.Ephemeral
          });
        }

        const logoUrl = interaction.fields.getTextInputValue('logo_url').trim();

        if (!/^https?:\/\//i.test(logoUrl)) {
          return interaction.reply({
            content: '❌ Link logo non valido. Deve iniziare con http:// oppure https://',
            flags: MessageFlags.Ephemeral
          });
        }

        const clubs = await getApprovedClubsWithApplications();
        if (!clubs.length) {
          competitionDrafts.delete(interaction.user.id);
          return interaction.reply({
            content: '❌ Non ci sono club approvati disponibili.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.logoUrl = logoUrl;
        draft.clubs = clubs;
        draft.existingLeagueCompetitions = draft.type === 'league'
          ? await getExistingLeagueCompetitionsForLink(draft.name)
          : [];
        draft.awaitingLogo = false;

        return interaction.reply({
          content: '✅ Logo salvato. Ora imposta le opzioni e seleziona le squadre partecipanti.',
          embeds: [buildCompetitionEmbed(draft)],
          components: buildCompetitionComponents(draft),
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'offer_amounts_modal_submit') {
        const draft = offerDrafts.get(interaction.user.id);
        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna offerta in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const transferFee = Number(interaction.fields.getTextInputValue('transfer_fee').trim());
        const salary = Number(interaction.fields.getTextInputValue('salary').trim());

        if (!Number.isFinite(transferFee) || !Number.isInteger(transferFee) || transferFee < 5) {
          return interaction.reply({
            content: '❌ Prezzo trasferimento non valido. Minimo: **5 crediti**.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (!Number.isFinite(salary) || !Number.isInteger(salary) || salary < 2) {
          return interaction.reply({
            content: '❌ Stipendio non valido. Minimo: **2 crediti/anno**.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.transferFee = transferFee;
        draft.salary = salary;

        return interaction.update({
          embeds: [buildOfferPanelEmbed(draft)],
          components: await buildOfferComponents(draft)
        });
      }


      if (interaction.customId === 'match_report_score_modal') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        const gf = Number(interaction.fields.getTextInputValue('goals_for').trim());
        const ga = Number(interaction.fields.getTextInputValue('goals_against').trim());
        if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0) return interaction.reply({ content: '❌ Risultato non valido.', flags: MessageFlags.Ephemeral });
        draft.goalsFor = gf;
        draft.goalsAgainst = ga;
        draft.scoreSet = true;
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'match_report_goal_count_modal' || interaction.customId === 'match_report_assist_count_modal') {
        const draft = matchReportDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun referto in corso.', flags: MessageFlags.Ephemeral });
        const count = Number(interaction.fields.getTextInputValue('count').trim());
        if (!Number.isInteger(count) || count <= 0 || count > 20) return interaction.reply({ content: '❌ Numero non valido.', flags: MessageFlags.Ephemeral });
        const player = draft.roster.find(p => p.id === draft.pendingStatPlayerId);
        if (!player) return interaction.reply({ content: '❌ Giocatore non valido.', flags: MessageFlags.Ephemeral });
        const row = { playerId: player.id, platformId: player.platform_id || 'ID console', count };
        if (interaction.customId === 'match_report_goal_count_modal') draft.goals.push(row);
        else draft.assists.push(row);
        draft.pendingStatPlayerId = null;
        return interaction.update({ embeds: [buildMatchReportPanelEmbed(draft)], components: buildReportComponents(draft) });
      }

      if (interaction.customId === 'transfer_request_modal') {
        const age = Number(interaction.fields.getTextInputValue('age').trim());
        const overall = Number(interaction.fields.getTextInputValue('overall').trim());
        const platform = interaction.fields.getTextInputValue('platform').trim().toUpperCase();

        if (Number.isNaN(age) || age < 13 || age > 60) return interaction.reply({ content: '❌ Età non valida.', flags: MessageFlags.Ephemeral });
        if (Number.isNaN(overall) || overall < 1 || overall > 99) return interaction.reply({ content: '❌ Overall non valido.', flags: MessageFlags.Ephemeral });
        if (!['PS5', 'XBOX', 'PC'].includes(platform)) return interaction.reply({ content: '❌ Console valida: PS5, XBOX oppure PC.', flags: MessageFlags.Ephemeral });

        const currentClub = await getCurrentPlayerClub(interaction.user.id);
        if (!currentClub) return interaction.reply({ content: '❌ Non trovo il tuo club attuale.', flags: MessageFlags.Ephemeral });

        transferRequestDrafts.set(interaction.user.id, {
          discord_id: interaction.user.id,
          discord_tag: interaction.user.tag,
          name: interaction.fields.getTextInputValue('name').trim(),
          age,
          console: platform,
          platform_id: interaction.fields.getTextInputValue('platform_id').trim(),
          overall,
          primary_role: null,
          secondary_role: null,
          description: null,
          current_club_name: currentClub.clubName,
          current_captain_discord_id: currentClub.ownerCaptainDiscordId,
          contract_years_remaining: currentClub.contractYears,
          appearances: currentClub.row?.appearances || 0,
          goals: currentClub.row?.goals || 0,
          application_player_id: currentClub.row?.id || null
        });

        return interaction.reply({
          content: '✅ Ora seleziona il tuo **ruolo principale**.',
          components: [buildTransferRequestRoleSelect()],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'transfer_request_description_modal') {
        const draft = transferRequestDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta trasferimento in corso.', flags: MessageFlags.Ephemeral });

        draft.description = interaction.fields.getTextInputValue('description').trim();

        await publishTransferRequest({
          ...draft,
          secondary_role: draft.secondary_role || 'NO'
        });

        transferRequestDrafts.delete(interaction.user.id);

        return interaction.reply({
          content: '✅ Richiesta trasferimento pubblicata correttamente.',
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'looking_team_modal') {
        const age = Number(interaction.fields.getTextInputValue('age').trim());
        const overall = Number(interaction.fields.getTextInputValue('overall').trim());
        const platform = interaction.fields.getTextInputValue('platform').trim().toUpperCase();

        if (Number.isNaN(age) || age < 13 || age > 60) return interaction.reply({ content: '❌ Età non valida.', flags: MessageFlags.Ephemeral });
        if (Number.isNaN(overall) || overall < 1 || overall > 99) return interaction.reply({ content: '❌ Overall non valido.', flags: MessageFlags.Ephemeral });
        if (!['PS5', 'XBOX', 'PC'].includes(platform)) return interaction.reply({ content: '❌ Console valida: PS5, XBOX oppure PC.', flags: MessageFlags.Ephemeral });

        lookingDrafts.set(interaction.user.id, {
          discord_id: interaction.user.id,
          discord_tag: interaction.user.tag,
          name: interaction.fields.getTextInputValue('name').trim(),
          age,
          console: platform,
          platform_id: interaction.fields.getTextInputValue('platform_id').trim(),
          overall,
          primary_role: null,
          secondary_role: null,
          description: null
        });

        return interaction.reply({
          content: '✅ Ora seleziona il tuo **ruolo principale**.',
          components: [buildLookingRoleSelect()],
          flags: MessageFlags.Ephemeral
        });
      }

      if (interaction.customId === 'looking_description_modal') {
        const draft = lookingDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessuna richiesta cerco squadra in corso.', flags: MessageFlags.Ephemeral });

        draft.description = interaction.fields.getTextInputValue('description').trim();

        const currentClub = await getCurrentPlayerClub(interaction.user.id);
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

        if (!currentClub && member) {
          await member.roles.add(FREE_AGENT_ROLE_ID).catch(() => null);
        }

        const profile = await upsertFreeAgentProfile({
          ...draft,
          secondary_role: draft.secondary_role || 'NO',
current_status: currentClub ? 'player' : 'free_agent',
          current_club_name: currentClub?.clubName || null,
          contract_years_remaining: currentClub?.contractYears || null,
          application_player_id: currentClub?.row?.id || null
        });

        await publishFreeAgentProfile({ ...profile, name: draft.name });
        lookingDrafts.delete(interaction.user.id);

        return interaction.reply({ content: '✅ La tua scheda è stata pubblicata.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'deposit_salary_modal_submit') {
        const draft = contractDrafts.get(interaction.user.id);
        if (!draft) return interaction.reply({ content: '❌ Nessun contratto in corso.', flags: MessageFlags.Ephemeral });

        const salary = Number(interaction.fields.getTextInputValue('salary').trim());
        if (Number.isNaN(salary) || salary < 0) return interaction.reply({ content: '❌ Stipendio non valido.', flags: MessageFlags.Ephemeral });

        const minSalary = getSalaryByTier(draft.selectedPlayer?.player_tier || 'BASSA');
        if (salary < minSalary) {
          return interaction.reply({ content: `❌ Stipendio troppo basso. Minimo per fascia **${draft.selectedPlayer?.player_tier || 'BASSA'}**: **${minSalary} crediti/anno**.`, flags: MessageFlags.Ephemeral });
        }

        const captainApplication = await getCaptainApprovedApplication(interaction.user.id);
        if (!captainApplication) return interaction.reply({ content: '❌ Non trovo una squadra approvata collegata a questo capitano.', flags: MessageFlags.Ephemeral });
        const budgetInfo = await getClubBudgetInfo(captainApplication.id, captainApplication.clubs?.name || 'Club del capitano');
        const totalCost = salary * Number(draft.contractYears || 1);
        if (budgetInfo.remaining < totalCost) {
          return interaction.reply({ content: `❌ Budget insufficiente. Costo contratto: **${totalCost} crediti** • Residuo: **${budgetInfo.remaining} crediti**.`, flags: MessageFlags.Ephemeral });
        }

        draft.salary = salary;
        await sendContractOfferToFreeAgent(interaction, draft);
        contractDrafts.delete(interaction.user.id);

        return interaction.reply({ content: '✅ Contratto inviato al giocatore in privato.', flags: MessageFlags.Ephemeral });
      }


      if (interaction.customId === 'team_modal') {
        const draft = drafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna iscrizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.teamName = interaction.fields
          .getTextInputValue('team_name')
          .trim();

        const { data: existingClubName } = await supabase
          .from('clubs')
          .select('id, name, status')
          .ilike('name', draft.teamName)
          .maybeSingle();

        if (existingClubName) {
          drafts.delete(interaction.user.id);
          return interaction.reply({
            content:
              '❌ Questo nome club è già in uso.\n\n' +
              'Scegli un nome diverso e ricomincia l’iscrizione.',
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.reply({
          content:
            '📎 Ora carica il **logo PNG** della squadra.\n\n' +
            'Clicca il **+** in basso a sinistra, scegli il file `.png` e invia il messaggio.\n' +
            'Hai 2 minuti di tempo.',
          flags: MessageFlags.Ephemeral
        });

        const filter = message =>
          message.author.id === interaction.user.id &&
          message.attachments.size > 0;

        try {
          const collected = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 120000,
            errors: ['time']
          });

          const message = collected.first();
          const file = message.attachments.first();

          // Cancella il messaggio pubblico del capitano con il logo,
          // così il canale iscrizioni resta pulito.
          await message.delete().catch(() => null);

          if (!file.name.toLowerCase().endsWith('.png')) {
            drafts.delete(interaction.user.id);

            return interaction.followUp({
              content: '❌ Il logo deve essere in formato PNG. Ricomincia l’iscrizione.',
              flags: MessageFlags.Ephemeral
            });
          }

          draft.logoUrl = file.url;

          return interaction.followUp({
            content:
              '✅ Logo ricevuto.\n\n' +
              'Ora seleziona i **giocatori in rosa**.',
            components: [
              buildRosterSelect()
            ],
            flags: MessageFlags.Ephemeral
          });

        } catch {
          drafts.delete(interaction.user.id);

          return interaction.followUp({
            content: '❌ Tempo scaduto. Ricomincia l’iscrizione.',
            flags: MessageFlags.Ephemeral
          });
        }
      }

      if (interaction.customId === 'player_modal') {
        const draft = drafts.get(interaction.user.id);

        if (!draft) {
          return interaction.reply({
            content: '❌ Nessuna iscrizione in corso.',
            flags: MessageFlags.Ephemeral
          });
        }

        const discordId = interaction.fields
          .getTextInputValue('discord_id')
          .trim();

        const age = Number(
          interaction.fields.getTextInputValue('age').trim()
        );

        const platform = interaction.fields
          .getTextInputValue('platform')
          .trim()
          .toUpperCase();

        const platformId = interaction.fields
          .getTextInputValue('platform_id')
          .trim();

        const contractYears = Number(
          interaction.fields.getTextInputValue('contract_years').trim()
        );

        if (!/^\d{15,25}$/.test(discordId)) {
          return interaction.reply({
            content: '❌ ID Discord non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        const memberExists = await interaction.guild.members
          .fetch(discordId)
          .catch(() => null);

        if (!memberExists) {
          return interaction.reply({
            content: '❌ Questo ID Discord non esiste oppure il giocatore non è presente nel server.',
            flags: MessageFlags.Ephemeral
          });
        }

        const { data: existingPlayer } = await supabase
          .from('club_application_players')
          .select('*')
          .eq('discord_id', discordId)
          .in('response_status', ['pending', 'accepted'])
          .maybeSingle();

        if (existingPlayer) {
          return interaction.reply({
            content: '❌ Questo giocatore risulta già registrato oppure ha già una richiesta attiva con un altro club.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (draft.players.some(player => player.discord_id === discordId)) {
          return interaction.reply({
            content: '❌ Questo giocatore è già stato inserito.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (Number.isNaN(age) || age < 13 || age > 60) {
          return interaction.reply({
            content: '❌ Età non valida.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (!['PS5', 'XBOX', 'PC'].includes(platform)) {
          return interaction.reply({
            content: '❌ Console non valida. Scrivi solo PS5, XBOX oppure PC.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (!platformId || platformId.length < 2) {
          return interaction.reply({
            content: '❌ ID PS5 / XBOX / PC non valido.',
            flags: MessageFlags.Ephemeral
          });
        }

        if (![1, 2].includes(contractYears)) {
          return interaction.reply({
            content: '❌ Il contratto può essere solo di 1 o 2 anni.',
            flags: MessageFlags.Ephemeral
          });
        }

        draft.pendingPlayer = {
          discord_id: discordId,
          age,
          platform,
          platform_id: platformId,
          contract_years: contractYears,
          primary_role: null,
          secondary_role: null,
          response_status: 'pending'
        };

        return interaction.reply({
          content:
            `✅ Dati giocatore ricevuti.\n\n` +
            `Ora seleziona il **ruolo principale** per **${platformId}**.`,
          components: [
            buildPrimaryRoleSelect()
          ],
          flags: MessageFlags.Ephemeral
        });
      }
    }

  } catch (error) {
    console.error('Errore interactionCreate:', error?.message || error, error);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply('❌ Errore interno del bot.');
    }

    return interaction.reply({
      content: '❌ Errore interno del bot.',
      flags: MessageFlags.Ephemeral
    });
  }
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const protectedChannels = [
    OFFERS_CHANNEL_ID,
    CONTRACTS_CHANNEL_ID,
    PLAYER_LOOKING_CHANNEL_ID,
    TEAM_LOOKING_CHANNEL_ID,
    TRANSFER_REQUEST_CHANNEL_ID,
    MATCH_REPORTS_CHANNEL_ID,
    MATCH_RESULTS_CHANNEL_ID,
    APPEALS_CHANNEL_ID,
    FREE_AGENT_CHANNEL_ID,
    TRANSFER_LOG_CHANNEL_ID,
    BOT_LOG_CHANNEL_ID
  ];

  if (protectedChannels.includes(message.channelId)) {
    await message.delete().catch(() => null);
  }
});



// =====================================================
// STEP 2 COMPETIZIONI - GENERAZIONE CALENDARI
// =====================================================

const CALENDAR_COMPETITIONS_PER_PAGE = 25;

async function getCompetitionsForCalendar() {
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .in('status', ['setup', 'calendar_generated'])
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

function buildCalendarCompetitionSelect(draft) {
  const competitions = draft.competitions || [];
  const page = draft.page || 0;
  const start = page * CALENDAR_COMPETITIONS_PER_PAGE;
  const pageItems = competitions.slice(start, start + CALENDAR_COMPETITIONS_PER_PAGE);

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('calendar_competition_select')
      .setPlaceholder('Seleziona competizione')
      .addOptions(pageItems.map(c => ({
        label: `${c.name} • ${competitionTypeLabel(c.type)}`.slice(0, 100),
        description: `Stagione ${c.season} • Stato ${c.status}`.slice(0, 100),
        value: c.id
      })))
  );
}

function buildCalendarButtons(draft) {
  const totalPages = Math.max(1, Math.ceil((draft.competitions || []).length / CALENDAR_COMPETITIONS_PER_PAGE));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('calendar_prev_page')
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.page || 0) <= 0),
    new ButtonBuilder()
      .setCustomId('calendar_next_page')
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled((draft.page || 0) >= totalPages - 1),
    new ButtonBuilder()
      .setCustomId('calendar_confirm_generate')
      .setLabel('GENERA CALENDARIO')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!draft.competitionId),
    new ButtonBuilder()
      .setCustomId('calendar_cancel')
      .setLabel('ANNULLA')
      .setStyle(ButtonStyle.Danger)
  );
}

function buildCalendarEmbed(draft) {
  const selected = draft.selectedCompetition;
  return new EmbedBuilder()
    .setTitle('📅 Generazione calendario competizione')
    .setColor(0xd4af37)
    .setDescription('Seleziona una competizione già creata nello Step 1, poi conferma la generazione automatica.')
    .addFields(
      { name: 'Competizione selezionata', value: selected ? `${selected.name} (${competitionTypeLabel(selected.type)})` : 'Nessuna' },
      { name: 'Stagione', value: selected?.season || 'N/D', inline: true },
      { name: 'Stato', value: selected?.status || 'N/D', inline: true }
    )
    .setFooter({ text: 'RPCI • Step 2 calendario' })
    .setTimestamp();
}

async function updateCalendarMessage(interaction, draft) {
  return interaction.update({
    embeds: [buildCalendarEmbed(draft)],
    components: [buildCalendarCompetitionSelect(draft), buildCalendarButtons(draft)]
  });
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildRoundRobinRounds(participants) {
  const teams = [...participants];
  if (teams.length % 2 === 1) teams.push(null);
  const n = teams.length;
  const rounds = [];
  let arr = [...teams];

  for (let round = 0; round < n - 1; round++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        const swap = round % 2 === 1;
        matches.push({ home: swap ? b : a, away: swap ? a : b });
      }
    }
    rounds.push(matches);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  return rounds;
}

function knockoutRoundName(teamCount) {
  if (teamCount <= 2) return 'Finale';
  if (teamCount <= 4) return 'Semifinale';
  if (teamCount <= 8) return 'Quarti di finale';
  if (teamCount <= 16) return 'Ottavi di finale';
  if (teamCount <= 32) return 'Sedicesimi di finale';
  return `Turno ${teamCount} squadre`;
}

async function clearExistingCompetitionMatches(competitionId) {
  await supabase
    .from('matches')
    .delete()
    .eq('competition_id', competitionId)
    .in('status', ['scheduled', 'calendar_generated']);
}

function matchRow(competition, home, away, roundName, matchday, legNumber = 1, groupName = null) {
  return {
    competition_id: competition.id,
    group_name: groupName,
    round_name: roundName,
    leg_number: legNumber,
    matchday,
    home_application_id: home.application_id,
    away_application_id: away.application_id,
    home_club_name: home.club_name,
    away_club_name: away.club_name,
    status: 'scheduled'
  };
}

async function generateLeagueCalendar(competition, participants) {
  const settings = competition.settings || {};
  const groupsCount = Math.max(1, Number(settings.gironi || settings.groups || 1));
  const shuffled = shuffleArray(participants);
  const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: groupsCount > 1 ? `Girone ${String.fromCharCode(65 + i)}` : 'Girone Unico', teams: [] }));

  shuffled.forEach((team, i) => groups[i % groupsCount].teams.push(team));

  const rows = [];
  let globalMatchday = 1;

  for (const group of groups) {
    await supabase.from('competition_groups').upsert({ competition_id: competition.id, name: group.name, level_order: groups.indexOf(group) + 1 }, { onConflict: 'competition_id,name' }).catch(() => null);

    for (const team of group.teams) {
      await supabase
        .from('competition_participants')
        .update({ group_name: group.name })
        .eq('competition_id', competition.id)
        .eq('club_id', team.club_id);
    }

    const rounds = buildRoundRobinRounds(group.teams);
    rounds.forEach((matches, idx) => {
      for (const m of matches) rows.push(matchRow(competition, m.home, m.away, `Andata • ${group.name}`, idx + 1, 1, group.name));
    });
    rounds.forEach((matches, idx) => {
      for (const m of matches) rows.push(matchRow(competition, m.away, m.home, `Ritorno • ${group.name}`, rounds.length + idx + 1, 2, group.name));
    });
    globalMatchday += rounds.length * 2;
  }

  return rows;
}

async function generateNationalCupCalendar(competition, participants) {
  const teams = shuffleArray(participants);
  const roundName = knockoutRoundName(teams.length);
  const rows = [];
  let matchday = 1;

  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i];
    const away = teams[i + 1];
    if (!home || !away) continue;

    const isFinal = teams.length <= 2;
    rows.push(matchRow(competition, home, away, roundName, matchday, 1, null));
    if (!isFinal) rows.push(matchRow(competition, away, home, `${roundName} • Ritorno`, matchday + 1, 2, null));
    matchday += isFinal ? 1 : 2;
  }

  return rows;
}

async function generateEuropeanCupCalendar(competition, participants) {
  const settings = competition.settings || {};
  const groupsCount = Math.max(1, Number(settings.gironi || settings.groups || 4));
  const shuffled = shuffleArray(participants);
  const groups = Array.from({ length: groupsCount }, (_, i) => ({ name: `Girone ${String.fromCharCode(65 + i)}`, teams: [] }));

  shuffled.forEach((team, i) => groups[i % groupsCount].teams.push(team));

  const rows = [];
  for (const group of groups) {
    await supabase.from('competition_groups').upsert({ competition_id: competition.id, name: group.name, level_order: groups.indexOf(group) + 1 }, { onConflict: 'competition_id,name' }).catch(() => null);

    for (const team of group.teams) {
      await supabase
        .from('competition_participants')
        .update({ group_name: group.name })
        .eq('competition_id', competition.id)
        .eq('club_id', team.club_id);
    }

    const rounds = buildRoundRobinRounds(group.teams);
    rounds.forEach((matches, idx) => {
      for (const m of matches) rows.push(matchRow(competition, m.home, m.away, `Fase a gironi • ${group.name}`, idx + 1, 1, group.name));
    });
    rounds.forEach((matches, idx) => {
      for (const m of matches) rows.push(matchRow(competition, m.away, m.home, `Fase a gironi ritorno • ${group.name}`, rounds.length + idx + 1, 2, group.name));
    });
  }

  return rows;
}

async function generateCompetitionCalendar(competitionId) {
  const { data: competition, error: compError } = await supabase
    .from('competitions')
    .select('*')
    .eq('id', competitionId)
    .single();

  if (compError || !competition) throw new Error('Competizione non trovata.');

  const { data: participants, error: partError } = await supabase
    .from('competition_participants')
    .select('*')
    .eq('competition_id', competitionId)
    .order('seed_number', { ascending: true });

  if (partError) throw partError;
  if (!participants || participants.length < 2) throw new Error('Servono almeno 2 squadre partecipanti.');
  if (participants.some(p => !p.application_id)) throw new Error('Una o più squadre non hanno application_id approvato.');

  await clearExistingCompetitionMatches(competitionId);

  let rows = [];
  if (competition.type === 'league') rows = await generateLeagueCalendar(competition, participants);
  if (competition.type === 'national_cup') rows = await generateNationalCupCalendar(competition, participants);
  if (competition.type === 'european_cup') rows = await generateEuropeanCupCalendar(competition, participants);

  if (!rows.length) throw new Error('Nessuna partita generata. Controlla tipo competizione e partecipanti.');

  const { error: insertError } = await supabase.from('matches').insert(rows);
  if (insertError) throw insertError;

  await supabase
    .from('competitions')
    .update({ status: 'calendar_generated' })
    .eq('id', competitionId);

  return { competition, matchesCreated: rows.length, participantsCount: participants.length };
}

async function sendCalendarGeneratedLog(interaction, result) {
  const embed = new EmbedBuilder()
    .setTitle('📅 Calendario generato')
    .setColor(0x2ecc71)
    .addFields(
      { name: 'Competizione', value: result.competition.name },
      { name: 'Tipo', value: competitionTypeLabel(result.competition.type), inline: true },
      { name: 'Squadre', value: String(result.participantsCount), inline: true },
      { name: 'Partite create', value: String(result.matchesCreated), inline: true }
    )
    .setTimestamp();

  const logChannel = await client.channels.fetch(BOT_LOG_CHANNEL_ID).catch(() => null);
  if (logChannel) await logChannel.send({ embeds: [embed] }).catch(() => null);
}

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'genera_calendario') {
      await logBotCommand(interaction).catch(() => null);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (!isStaffMember(member)) {
        return interaction.reply({ content: '❌ Solo lo staff può generare calendari.', flags: MessageFlags.Ephemeral });
      }

      const competitions = await getCompetitionsForCalendar();
      if (!competitions.length) {
        return interaction.reply({ content: '❌ Non ci sono competizioni disponibili. Crea prima una competizione con `/crea_competizione`.', flags: MessageFlags.Ephemeral });
      }

      calendarDrafts.set(interaction.user.id, { competitions, page: 0, competitionId: null, selectedCompetition: null });
      const draft = calendarDrafts.get(interaction.user.id);
      return interaction.reply({ embeds: [buildCalendarEmbed(draft)], components: [buildCalendarCompetitionSelect(draft), buildCalendarButtons(draft)], flags: MessageFlags.Ephemeral });
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'calendar_competition_select') {
      const draft = calendarDrafts.get(interaction.user.id);
      if (!draft) return interaction.reply({ content: '❌ Nessuna generazione calendario in corso.', flags: MessageFlags.Ephemeral });
      const id = interaction.values[0];
      const comp = draft.competitions.find(c => c.id === id);
      if (!comp) return interaction.reply({ content: '❌ Competizione non valida.', flags: MessageFlags.Ephemeral });
      draft.competitionId = id;
      draft.selectedCompetition = comp;
      return updateCalendarMessage(interaction, draft);
    }

    if (interaction.isButton() && (interaction.customId === 'calendar_prev_page' || interaction.customId === 'calendar_next_page')) {
      const draft = calendarDrafts.get(interaction.user.id);
      if (!draft) return interaction.reply({ content: '❌ Nessuna generazione calendario in corso.', flags: MessageFlags.Ephemeral });
      const totalPages = Math.max(1, Math.ceil((draft.competitions || []).length / CALENDAR_COMPETITIONS_PER_PAGE));
      if (interaction.customId === 'calendar_prev_page') draft.page = Math.max(0, draft.page - 1);
      else draft.page = Math.min(totalPages - 1, draft.page + 1);
      return updateCalendarMessage(interaction, draft);
    }

    if (interaction.isButton() && interaction.customId === 'calendar_cancel') {
      calendarDrafts.delete(interaction.user.id);
      return interaction.update({ content: '❌ Generazione calendario annullata.', embeds: [], components: [] });
    }

    if (interaction.isButton() && interaction.customId === 'calendar_confirm_generate') {
      const draft = calendarDrafts.get(interaction.user.id);
      if (!draft || !draft.competitionId) return interaction.reply({ content: '❌ Seleziona prima una competizione.', flags: MessageFlags.Ephemeral });

      await interaction.deferUpdate();
      const result = await generateCompetitionCalendar(draft.competitionId);
      await sendCalendarGeneratedLog(interaction, result);
      calendarDrafts.delete(interaction.user.id);

      return interaction.editReply({
        content: `✅ Calendario generato per **${result.competition.name}**.\nPartite create: **${result.matchesCreated}**.`,
        embeds: [],
        components: []
      });
    }
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply('❌ Errore generazione calendario: ' + error.message);
    }
    return interaction.reply({ content: '❌ Errore generazione calendario: ' + error.message, flags: MessageFlags.Ephemeral });
  }
});


client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

client.login(process.env.DISCORD_TOKEN);
