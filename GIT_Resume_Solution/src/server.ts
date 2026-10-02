import app from './app';
import env from './config/env';

const startServer = () => {
  app.listen(env.port, () => {
    console.log(`Resume RAG backend running on port ${env.port}`);
  });
};

startServer();
