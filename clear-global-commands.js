// One-off script: removes ALL global slash commands for the bot.
// This cleans up duplicate commands that appear alongside guild-scoped commands.
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./src/config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);
    // Overwrite global commands with an empty array -> deletes them all.
    await client.application.commands.set([]);
    console.log('All global slash commands removed.');
  } catch (err) {
    console.error('Failed to clear global commands:', err.message);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(config.discord.token);
