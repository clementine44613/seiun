// Diagnostic: check the approval channel config and the bot's permissions in it.
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const config = require('./src/config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log('Logged in as', client.user.tag);
  const channelId = config.discord.approvalChannelId;
  console.log('Approval channel ID from config:', channelId || '(not set)');

  if (!channelId) {
    console.log('No approval channel configured.');
    client.destroy();
    process.exit(0);
  }

  try {
    const channel = await client.channels.fetch(channelId);
    console.log('Channel found:', channel ? channel.name : 'null');
    console.log('Channel type:', channel ? channel.type : 'unknown');
    if (channel) {
      console.log('Channel guild:', channel.guild ? channel.guild.name : 'unknown');
      const me = channel.guild ? await channel.guild.members.fetch(client.user.id) : null;
      if (me) {
        const perms = channel.permissionsFor(me);
        console.log('Send Messages:', perms ? perms.has(PermissionsBitField.Flags.SendMessages) : 'n/a');
        console.log('View Channel:', perms ? perms.has(PermissionsBitField.Flags.ViewChannel) : 'n/a');
        console.log('Embed Links:', perms ? perms.has(PermissionsBitField.Flags.EmbedLinks) : 'n/a');
      } else {
        console.log('Bot is NOT a member of this guild.');
      }
    }
  } catch (err) {
    console.error('Could not fetch channel:', err.message);
  }

  client.destroy();
  process.exit(0);
});

client.login(config.discord.token);
