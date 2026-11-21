import mongoose from 'mongoose';
import app from './app.js';
import config, { assertBootConfig } from './config/index.js';

assertBootConfig(); // creates storage dir, warns about missing optional config, fatal if no DB URI

const start = async () => {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
    });
    console.log('[db] MongoDB connected');
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    console.error('[db] Check MONGODB_URI in backend/.env (see .env.example). Exiting.');
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] Research Agent backend listening on http://localhost:${config.port}`);
    console.log(`[server] Frontend expected at ${config.frontendUrl}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down…`);
    server.close(async () => {
      await mongoose.connection.close(false);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();
