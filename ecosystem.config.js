module.exports = {
  apps: [
    {
      name: 'consumer',
      script: 'src/commands/consumer.command.js',
    },
    {
      name: 'consumerCallback',
      script: 'src/commands/consumerCallback.command.js',
    },
  ],
};
