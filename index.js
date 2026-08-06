const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
} = require('discord.js');
const config = require('./src/config');
const { createWhitelistService } = require('./src/whitelist');

const EPHEMERAL = MessageFlags.Ephemeral;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

const whitelist = createWhitelistService(config);
const bindings = require('./src/bindings');
const Rcon = require('rcon-srcds');

// Track pending verification requests: userId -> { username, code, timer }
const pending = new Map();
// Track pending approval requests: approval messageId -> { userId, username, timer }
const pendingApprovals = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isValidMinecraftUsername(name) {
  // Minecraft usernames: 3-16 chars, letters, numbers, and underscore
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

async function logToChannel(message) {
  if (!config.discord.logChannelId) return;
  try {
    const channel = await client.channels.fetch(config.discord.logChannelId);
    if (channel) await channel.send(message);
  } catch (err) {
    console.error('Failed to post to log channel:', err.message);
  }
}

function logCommand(command, user, details = '') {
  const time = new Date().toLocaleString();
  console.log(`[CMD] ${time} | ${user.tag} | /${command}${details ? ' | ' + details : ''}`);
}

async function pushBindingsToMcServer() {
  if (!config.rcon || !config.rcon.password) return;
  try {
    const raw = JSON.stringify(bindings.loadBindings(), null, 2);
    await whitelist.sftp.writeFile('/bindings.json', raw);
    console.log('Pushed bindings.json to MC server.');
  } catch (err) {
    console.error('Failed to push bindings.json to MC server:', err.message);
  }
}

async function grantVerifiedRole(member) {
  if (!config.discord.verifiedRoleId) return;
  try {
    await member.roles.add(config.discord.verifiedRoleId);
  } catch (err) {
    console.error('Failed to add verified role:', err.message);
  }
}

// Is this user allowed to moderate approval requests?
function isModerator(member) {
  if (!member) return false;
  // Admins always count as moderators.
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  // Otherwise they need the moderator role (if configured).
  if (config.discord.moderatorRoleId) {
    return member.roles.cache.has(config.discord.moderatorRoleId);
  }
  return false;
}

// Convert an SFTP error into a friendly message explaining likely causes.
function sftpErrorText(err) {
  const msg = (err && err.message) || String(err);
  console.error('SFTP error details:', msg);

  if (msg.includes('ECONNREFUSED')) {
    return 'Could not connect to the server (connection refused). Check the SFTP host and that it is reachable.';
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('Timed out') || msg.includes('timed out')) {
    return 'Could not reach the server (connection timed out). Check the SFTP host and port.';
  }
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    return 'Could not resolve the SFTP host address. Check SFTP_HOST in your .env file.';
  }
  if (msg.includes('authenticat') || msg.includes('password') || msg.includes('All configured authentication methods failed')) {
    return 'SFTP authentication failed. Check SFTP_USERNAME and SFTP_PASSWORD in your .env file.';
  }
  if (msg.includes('EPERM') || msg.includes('Permission denied') || msg.includes('EACCES')) {
    return 'Permission denied while accessing the server files. Check the SFTP user has write access to whitelist.json.';
  }
  if (msg.includes('No such file') || msg.includes('ENOENT') || msg.includes('not found')) {
    return 'The whitelist.json file was not found. Make sure whitelist mode is enabled on the server.';
  }
  // Fallback: include the raw error so we can diagnose.
  return `Could not update the whitelist. (${msg})`;
}

// Mark an approval message's buttons as disabled after it's been acted on.
async function disableApprovalButtons(message) {
  try {
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('approve_yes')
        .setLabel('✅ Approve')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('approve_no')
        .setLabel('❌ Deny')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true)
    );
    await message.edit({ components: [disabledRow] });
  } catch (err) {
    console.error('Failed to disable approval buttons:', err.message);
  }
}

// ---- Register slash commands ----
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await client.user.setActivity('/seiun-help', { type: ActivityType.Playing });

  const commands = [
    new SlashCommandBuilder()
      .setName('whitelist')
      .setDescription('Add yourself to the Minecraft server whitelist')
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('Your Minecraft username')
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Confirm the verification code to finalize your whitelist'),
    new SlashCommandBuilder()
      .setName('verify-keepalive')
      .setDescription('Refresh your verification heartbeat to stay online on the Minecraft server'),
    new SlashCommandBuilder()
      .setName('whitelist-status')
      .setDescription('Check if you are whitelisted on the Minecraft server'),
    new SlashCommandBuilder()
      .setName('whitelist-remove')
      .setDescription('[Admin] Remove a player from the whitelist')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .addStringOption((opt) =>
        opt
          .setName('username')
          .setDescription('Minecraft username to remove')
          .setRequired(true)
),
    new SlashCommandBuilder()
      .setName('whitelist-list')
      .setDescription('[Admin] List all whitelisted players')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
new SlashCommandBuilder()
      .setName('seiun-help')
      .setDescription('Show all available commands and how to use them'),
  ];

try {
    // Register commands to the specific guild for instant sync.
    // (Global registration can take up to an hour to propagate.)
    if (config.discord.guildId) {
      const guild = client.guilds.cache.get(config.discord.guildId);
      if (guild) {
        await guild.commands.set(commands);
        console.log(`Slash commands registered to guild ${config.discord.guildId}.`);
      } else {
        await client.application.commands.set(commands);
        console.log('Slash commands registered globally.');
      }
    } else {
      await client.application.commands.set(commands);
      console.log('Slash commands registered globally.');
    }
  } catch (err) {
    console.error('Failed to register commands:', err.message);
  }
});

// ---- Command handling ----
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'whitelist') {
        const username = interaction.options.getString('username');
        logCommand('whitelist', interaction.user, `username=${username}`);

        const boundUsername = bindings.getBoundUsername(interaction.user.id);
        if (boundUsername && boundUsername.toLowerCase() !== username.toLowerCase()) {
          return interaction.reply({
            content: `You are already bound to Minecraft username **${boundUsername}**. You can only whitelist that username.`,
            flags: EPHEMERAL,
          });
        }

        if (!isValidMinecraftUsername(username)) {
          return interaction.reply({
            content: 'Invalid Minecraft username. Use 3-16 characters (letters, numbers, underscores only).',
            flags: EPHEMERAL,
          });
        }

        // Defer immediately so we don't hit the 3-second interaction window.
        await interaction.deferReply({ flags: EPHEMERAL });

        try {
          const already = await whitelist.isPlayerWhitelisted(username);
          if (already) {
            return interaction.editReply({
              content: `**${username}** is already whitelisted. Enjoy the game!`,
            });
          }
        } catch (err) {
          console.error('Whitelist check failed:', err.message);
          return interaction.editReply({
            content: sftpErrorText(err),
          });
        }

        const code = generateCode();

        // Clear any existing pending request for this user
        const existing = pending.get(interaction.user.id);
        if (existing) clearTimeout(existing.timer);

        const timer = setTimeout(() => {
          pending.delete(interaction.user.id);
        }, config.verifyTimeoutSeconds * 1000);

        pending.set(interaction.user.id, { username, code, timer });

        const embed = new EmbedBuilder()
          .setTitle('Minecraft Whitelist Verification')
          .setDescription(
            `To verify that you own the Minecraft account **${username}**:\n\n` +
            `1. Copy this code:\n` +
            `\`\`\`${code}\`\`\`\n` +
            `2. Click the **Verify** button below within ${config.verifyTimeoutSeconds / 60} minutes and enter the code.`
          )
          .setColor(0x00ff00)
          .setFooter({ text: 'This code expires soon.' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_verify')
            .setLabel('Enter verification code')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      if (commandName === 'verify') {
        logCommand('verify', interaction.user);
        const entry = pending.get(interaction.user.id);

        const boundUsername = bindings.getBoundUsername(interaction.user.id);
        if (boundUsername && entry && boundUsername.toLowerCase() !== entry.username.toLowerCase()) {
          return interaction.reply({
            content: `You can only verify for your bound Minecraft username **${boundUsername}**.`,
            flags: EPHEMERAL,
          });
        }

        if (!entry) {
          return interaction.reply({
            content: 'You have no pending verification. Use `/whitelist <username>` to start.',
            flags: EPHEMERAL,
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('Verification Code')
          .setDescription(
            `Your code is:\n\n\`\`\`${entry.code}\`\`\`\n` +
            `Click the button below and enter this code to verify.`
          )
          .setColor(0x00ff00);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_verify')
            .setLabel('Enter verification code')
            .setStyle(ButtonStyle.Success)
        );

        return interaction.reply({ embeds: [embed], components: [row], flags: EPHEMERAL });
      }

      if (commandName === 'verify-keepalive') {
        logCommand('verify-keepalive', interaction.user);
        const boundUsername = bindings.getBoundUsername(interaction.user.id);
        if (!boundUsername) {
          return interaction.reply({
            content: 'You are not bound to any Minecraft username. Use `/whitelist <username>` to start.',
            flags: EPHEMERAL,
          });
        }
        bindings.updateLastVerified(interaction.user.id);
        await pushBindingsToMcServer().catch(() => {});
        return interaction.reply({
          content: `Heartbeat refreshed for **${boundUsername}**. You are now verified for another ${Math.floor(config.heartbeatTimeoutSeconds / 60)} minutes.`,
          flags: EPHEMERAL,
        });
      }

      if (commandName === 'whitelist-status') {
        logCommand('whitelist-status', interaction.user);
        return interaction.reply({
          content: 'Please use `/whitelist <username>` — if it says you are already whitelisted, you are good to go!',
          flags: EPHEMERAL,
        });
      }

      if (commandName === 'whitelist-remove') {
        const username = interaction.options.getString('username');
        logCommand('whitelist-remove', interaction.user, `username=${username}`);
        await interaction.deferReply({ flags: EPHEMERAL });
        try {
          const result = await whitelist.removePlayer(username);
          await logToChannel(`${interaction.user} removed ${username} from whitelist.`);
          return interaction.editReply({ content: result.message });
        } catch (err) {
          console.error('Remove failed:', err.message);
          return interaction.editReply({
            content: sftpErrorText(err),
          });
        }
      }

if (commandName === 'whitelist-list') {
        logCommand('whitelist-list', interaction.user);
        await interaction.deferReply({ flags: EPHEMERAL });
        try {
          const list = await whitelist.listWhitelisted();
          return interaction.editReply({ content: list || 'No players whitelisted.' });
        } catch (err) {
          console.error('List failed:', err.message);
          return interaction.editReply({
            content: sftpErrorText(err),
          });
        }
      }

if (commandName === 'seiun-help') {
        logCommand('seiun-help', interaction.user);
        const isAdmin = isModerator(interaction.member);

        const embed = new EmbedBuilder()
          .setTitle('🐱 Meow Server — Help')
          .setDescription('Here are all the commands available for this bot:')
          .setColor(0x00bfff)
          .addFields(
            { name: '`/seiun-help`', value: 'Show this help message with all commands.', inline: false },
            { name: '`/whitelist <username>`', value: 'Apply to be added to the Minecraft server whitelist. You get a verification code, then a moderator approves you.', inline: false },
            { name: '`/verify`', value: 'Re-show your verification code if you lost it during the whitelist process.', inline: false },
            { name: '`/whitelist-status`', value: 'Check if you are already whitelisted on the Minecraft server.', inline: false }
          );

        if (isAdmin) {
          embed.addFields(
            { name: '`/whitelist-remove <username>`', value: '**[Admin]** Remove a player from the whitelist.', inline: false },
            { name: '`/whitelist-list`', value: '**[Admin]** List all whitelisted players.', inline: false }
          );
        } else {
          embed.addFields(
            { name: '`/whitelist-remove <username>`', value: '*(Admin only)*', inline: false },
            { name: '`/whitelist-list`', value: '*(Admin only)*', inline: false }
          );
        }

        return interaction.reply({ embeds: [embed], flags: EPHEMERAL });
      }
    }

    // ---- Player clicks "I have set the code" ----
    if (interaction.isButton() && interaction.customId === 'confirm_verify') {
      const entry = pending.get(interaction.user.id);

      if (!entry) {
        return interaction.reply({
          content: 'This verification has expired or was already completed. Please use `/whitelist <username>` again.',
          flags: EPHEMERAL,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('verify_code_modal')
        .setTitle('Enter Verification Code')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('verify_code_input')
              .setLabel('Enter the 6-character code')
              .setPlaceholder('ABC123')
              .setStyle(TextInputStyle.Short)
              .setMaxLength(6)
              .setMinLength(6)
              .setRequired(true)
          )
        );

      return interaction.showModal(modal);
    }

    // ---- Player submits verification code via modal ----
    if (interaction.isModalSubmit() && interaction.customId === 'verify_code_modal') {
      const entry = pending.get(interaction.user.id);
      const input = interaction.fields.getTextInputValue('verify_code_input').trim().toUpperCase();

      if (!entry) {
        return interaction.reply({
          content: 'This verification has expired or was already completed. Please use `/whitelist <username>` again.',
          flags: EPHEMERAL,
        });
      }

      logCommand('verify-code', interaction.user, `code=${input}`);

      if (input !== entry.code) {
        return interaction.reply({
          content: `Incorrect code. The correct code was: \`${entry.code}\`. Please use \`/verify\` to see it again, then restart with \`/whitelist ${entry.username}\`.`,
          flags: EPHEMERAL,
        });
      }

      clearTimeout(entry.timer);
      pending.delete(interaction.user.id);
      await interaction.deferReply({ flags: EPHEMERAL });

      bindings.updateLastVerified(interaction.user.id);
      await pushBindingsToMcServer().catch(() => {});

      // If no approval channel is configured, add the player directly.
      if (!config.discord.approvalChannelId) {
        try {
          const result = await whitelist.addPlayer(entry.username);
          if (result.added || result.already) {
            await grantVerifiedRole(interaction.member);
            await bindings.setBinding(interaction.user.id, entry.username);
            await pushBindingsToMcServer().catch(() => {});
            await logToChannel(
              `✅ **${interaction.user.tag}** verified as **${entry.username}** and was ${result.already ? 'already ' : ''}whitelisted.`
            );
          }
          return interaction.editReply({ content: result.message });
        } catch (err) {
          console.error('Whitelist add failed:', err.message);
          return interaction.editReply({ content: sftpErrorText(err) });
        }
      }

      // Otherwise, create an approval request for a moderator.
      try {
        const approvalChannel = await client.channels.fetch(config.discord.approvalChannelId);
        if (!approvalChannel) {
          return interaction.editReply({
            content: 'The approval channel is not available. Please contact a server admin.',
          });
        }

        const approvalEmbed = new EmbedBuilder()
          .setTitle('🛡️ Whitelist Approval Request')
          .setDescription(
            `**Player:** ${interaction.user.tag} (<@${interaction.user.id}>)\n` +
            `**Minecraft username:** \`${entry.username}\`\n` +
            `**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`
          )
          .setColor(0xffaa00)
          .setFooter({
            text: `Approval expires in ${Math.floor(config.approvalTimeoutSeconds / 60)} minutes.`,
          });

        const approvalRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('approve_yes')
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('approve_no')
            .setLabel('❌ Deny')
            .setStyle(ButtonStyle.Danger)
        );

// Try sending as an embed first. If the bot lacks the Embed Links
        // permission in the channel, fall back to a plain text message so the
        // approval still works.
        let approvalMsg;
        try {
          approvalMsg = await approvalChannel.send({
            embeds: [approvalEmbed],
            components: [approvalRow],
          });
        } catch (embedErr) {
          console.error('Embed send failed, falling back to text:', embedErr.message);
          const text =
            `🛡️ **Whitelist Approval Request**\n` +
            `**Player:** ${interaction.user.tag} (<@${interaction.user.id}>)\n` +
            `**Minecraft username:** \`${entry.username}\`\n` +
            `**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>\n` +
            `*Approval expires in ${Math.floor(config.approvalTimeoutSeconds / 60)} minutes.*`;
          approvalMsg = await approvalChannel.send({
            content: text,
            components: [approvalRow],
          });
        }

        // Store the approval so approve/deny buttons can find it.
        const approvalTimer = setTimeout(async () => {
          const rec = pendingApprovals.get(approvalMsg.id);
          if (rec) {
            pendingApprovals.delete(approvalMsg.id);
            await disableApprovalButtons(approvalMsg);
            // Notify the requester that their request expired.
            try {
              const requester = await client.users.fetch(rec.userId);
              await requester.send(
                `Your whitelist request for **${rec.username}** expired because no moderator approved it in time.`
              );
            } catch (e) {
              console.error('Could not DM requester about expired approval:', e.message);
            }
          }
        }, config.approvalTimeoutSeconds * 1000);

        pendingApprovals.set(approvalMsg.id, {
          userId: interaction.user.id,
          username: entry.username,
          timer: approvalTimer,
          message: approvalMsg,
        });

        return interaction.editReply({
          content:
            `Your verification for **${entry.username}** has been submitted. ` +
            `A moderator will review and approve your request. You'll be notified here.`,
        });
      } catch (err) {
        console.error('Failed to create approval request:', err.message);
        return interaction.editReply({
          content: 'Failed to create an approval request. Please contact a server admin.',
        });
      }
    }

    // ---- Moderator approves ----
    if (interaction.isButton() && interaction.customId === 'approve_yes') {
      const rec = pendingApprovals.get(interaction.message.id);

      if (!isModerator(interaction.member)) {
        return interaction.reply({
          content: 'Only moderators can approve whitelist requests.',
          flags: EPHEMERAL,
        });
      }
      if (!rec) {
        return interaction.reply({
          content: 'This approval request is no longer active (it may have expired).',
          flags: EPHEMERAL,
        });
      }

      clearTimeout(rec.timer);
      pendingApprovals.delete(interaction.message.id);
      await disableApprovalButtons(interaction.message);

      await interaction.deferReply({ flags: EPHEMERAL });

      try {
        const result = await whitelist.addPlayer(rec.username);

        // Notify the requester.
        try {
          const requester = await client.users.fetch(rec.userId);
          if (result.added) {
            await requester.send(
              `✅ Your whitelist request for **${rec.username}** was **approved** by ${interaction.user}. You can now join the server!`
            );
          } else if (result.already) {
            await requester.send(
              `ℹ️ **${rec.username}** was already whitelisted, so you're all set!`
            );
          } else {
            await requester.send(
              `⚠️ There was an issue adding **${rec.username}**: ${result.message}`
            );
          }
        } catch (e) {
          console.error('Could not DM requester about approval:', e.message);
        }

        if (result.added || result.already) {
          // Grant the verified role to the requester if configured.
          try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(rec.userId);
            await grantVerifiedRole(member);
          } catch (e) {
            console.error('Could not grant verified role to requester:', e.message);
          }
          try {
            bindings.setBinding(rec.userId, rec.username);
          } catch (e) {
            console.error('Failed to save binding:', e.message);
          }
          await pushBindingsToMcServer().catch(() => {});
          await logToChannel(
            `✅ Moderator ${interaction.user} approved **${rec.username}** (requested by ${rec.userId}).`
          );
        }

        return interaction.editReply({ content: result.message });
      } catch (err) {
        console.error('Approval add failed:', err.message);
        return interaction.editReply({ content: sftpErrorText(err) });
      }
    }

    // ---- Moderator denies ----
    if (interaction.isButton() && interaction.customId === 'approve_no') {
      const rec = pendingApprovals.get(interaction.message.id);

      if (!isModerator(interaction.member)) {
        return interaction.reply({
          content: 'Only moderators can deny whitelist requests.',
          flags: EPHEMERAL,
        });
      }
      if (!rec) {
        return interaction.reply({
          content: 'This approval request is no longer active (it may have expired).',
          flags: EPHEMERAL,
        });
      }

      clearTimeout(rec.timer);
      pendingApprovals.delete(interaction.message.id);
      await disableApprovalButtons(interaction.message);

      await interaction.deferReply({ flags: EPHEMERAL });

      // Notify the requester.
      try {
        const requester = await client.users.fetch(rec.userId);
        await requester.send(
          `❌ Your whitelist request for **${rec.username}** was **denied** by a moderator.`
        );
      } catch (e) {
        console.error('Could not DM requester about denial:', e.message);
      }

      await logToChannel(
        `❌ Moderator ${interaction.user} denied **${rec.username}** (requested by ${rec.userId}).`
      );

      return interaction.editReply({
        content: `Denied **${rec.username}**. The requester has been notified.`,
      });
    }
  } catch (err) {
    // Safety net: never crash the bot on an interaction error.
    console.error('Unhandled interaction error:', err);
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: 'Something went wrong. Please try again.' });
      } else if (!interaction.replied) {
        await interaction.reply({ content: 'Something went wrong. Please try again.', flags: EPHEMERAL });
      }
    } catch (replyErr) {
      console.error('Could not send error reply:', replyErr.message);
    }
  }
});

// Global safety net so the process never crashes on unexpected errors.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await whitelist.sftp.disconnect().catch(() => {});
  client.destroy();
  process.exit(0);
});

// RCON heartbeat: kicks players whose Discord owner hasn't verified recently
async function runHeartbeat() {
  if (!config.rcon || !config.rcon.password) return;
  const rcon = new Rcon({
    host: config.rcon.host,
    port: config.rcon.port,
    timeout: 10000,
  });
  try {
    await rcon.connect();
    const authed = await rcon.authenticate(config.rcon.password);
    if (!authed) {
      console.error('Heartbeat: RCON auth failed');
      return;
    }
    const listOutput = await rcon.execute('list');
    const onlineMatch = listOutput && listOutput.match(/players online:\s*([^\n]+)/i);
    if (!onlineMatch) return;
    const names = onlineMatch[1].split(',').map((n) => n.trim()).filter(Boolean);
    const bindingsMap = bindings.loadBindings();
    const now = Date.now();
    for (const name of names) {
      const binding = Object.values(bindingsMap).find((b) => b.username && b.username.toLowerCase() === name.toLowerCase());
      if (!binding) {
        await rcon.execute(`kick ${name} Not whitelisted`);
        console.log(`Heartbeat kicked ${name} (no binding)`);
        continue;
      }
      const last = binding.lastVerified || 0;
      if (now - last > config.heartbeatTimeoutSeconds * 1000) {
        await rcon.execute(`kick ${name} Verification expired. Use /verify-keepalive in Discord.`);
        console.log(`Heartbeat kicked ${name} (verification expired)`);
      }
    }
  } catch (err) {
    console.error('Heartbeat error:', err.message);
  } finally {
    await rcon.disconnect().catch(() => {});
  }
}

if (config.rcon && config.rcon.password) {
  setInterval(runHeartbeat, config.heartbeatIntervalSeconds * 1000);
  console.log(`Heartbeat enabled: every ${config.heartbeatIntervalSeconds}s, timeout ${config.heartbeatTimeoutSeconds}s`);
} else {
  console.log('Heartbeat disabled: RCON not configured');
}

client.login(config.discord.token);
