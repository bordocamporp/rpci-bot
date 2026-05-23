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

const CLUBS_PER_PAGE = 25;
const PLAYERS_PER_PAGE = 25;

const drafts = new Map();
const offerDrafts = new Map();

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
    .setDescription('Crea una offerta di trasferimento')
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

client.once('ready', () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
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

    return `${icon} **${index + 1}.** <@${player.discord_id}> | Età: ${player.age} | ${player.platform}: ${player.platform_id || 'N/D'} | Contratto: ${player.contract_years} anno/i`;
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

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {

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
          contractYears: null
        });

        const draft = offerDrafts.get(interaction.user.id);

        return interaction.reply({
          embeds: [buildOfferPanelEmbed(draft)],
          components: await buildOfferComponents(draft),
          flags: MessageFlags.Ephemeral
        });
      }
    }

    if (interaction.isStringSelectMenu()) {
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
        draft.contractYears = null;

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

        return updateOfferDraftMessage(interaction, draft);
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

    if (interaction.isButton()) {
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
          !draft.contractYears
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

        const { data: offer, error: offerError } = await supabase
          .from('transfer_offers')
          .insert({
  from_club_name: fromClubName,
  target_club_name: draft.targetClubName,
  captain_discord_id: interaction.user.id,

  player_discord_id: draft.playerDiscordId,
  player_platform: draft.playerPlatform,
  player_platform_id: draft.playerPlatformId,

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

        await sendOfferToPlayer({
          id: offer.id,
          fromClubName,
          targetClubName: draft.targetClubName,
          captainDiscordId: interaction.user.id,
          playerDiscordId: draft.playerDiscordId,
          platform: draft.playerPlatform,
          platformId: draft.playerPlatformId,
          contractYears: draft.contractYears
        }, offerPlayerRow);

        offerDrafts.delete(interaction.user.id);

        return interaction.update({
          content:
            '✅ Offerta inviata correttamente al giocatore.\n\n' +
            'La trattativa si concluderà quando il giocatore accetta/rifiuta oppure automaticamente dopo 24h senza risposta.',
          embeds: [],
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
          players: []
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

        draft.players.push({
          discord_id: discordId,
          age,
          platform,
          platform_id: platformId,
          contract_years: contractYears,
          response_status: 'pending'
        });

        if (draft.players.length < draft.rosterSize) {
          return interaction.reply({
            content:
              `✅ Giocatore inserito.\n\n` +
              `Progresso: **${draft.players.length}/${draft.rosterSize}**\n` +
              `Mancano **${draft.rosterSize - draft.players.length}** giocatori.`,
            components: [
              buildAddPlayerButton(draft)
            ],
            flags: MessageFlags.Ephemeral
          });
        }

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        await finalizeApplication(interaction, draft);

        return interaction.editReply(
          '✅ Iscrizione squadra inviata correttamente allo staff.\n\n' +
          'I giocatori riceveranno la conferma in privato.'
        );
      }
    }

  } catch (error) {
    console.error(error);

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

  if (message.channelId === OFFERS_CHANNEL_ID) {
    await message.delete().catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN);
