import dotenv from 'dotenv';

dotenv.config();

const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGODB_DB_NAME || 'resume_rag',
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB || 5),
  useLlmParser: process.env.USE_LLM_PARSER === 'true',
};

export default env;
