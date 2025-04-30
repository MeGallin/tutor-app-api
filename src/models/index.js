import { Sequelize } from 'sequelize';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create the data directory if it doesn't exist
const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info(`Created data directory: ${dataDir}`);
}

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: config.dbPath,
  logging: (msg) => logger.debug(msg),
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = (await import('./user.model.js')).default(
  sequelize,
  Sequelize.DataTypes,
);

// Add model for tracking blacklisted (invalidated) tokens
db.BlacklistedToken = sequelize.define('BlacklistedToken', {
  id: {
    type: Sequelize.DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  token: {
    type: Sequelize.DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  userId: {
    type: Sequelize.DataTypes.INTEGER,
    allowNull: false,
  },
  expiresAt: {
    type: Sequelize.DataTypes.DATE,
    allowNull: false,
  },
  createdAt: {
    type: Sequelize.DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
});

// Add model for storing tutor conversations
db.TutorSession = sequelize.define('TutorSession', {
  id: {
    type: Sequelize.DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: Sequelize.DataTypes.STRING,
    allowNull: false,
    defaultValue: 'New Session',
  },
  subject: {
    type: Sequelize.DataTypes.STRING,
    allowNull: true,
  },
  startedAt: {
    type: Sequelize.DataTypes.DATE,
    defaultValue: Sequelize.NOW,
  },
  endedAt: {
    type: Sequelize.DataTypes.DATE,
    allowNull: true,
  },
  userId: {
    type: Sequelize.DataTypes.INTEGER,
    allowNull: false,
  },
});

db.Message = sequelize.define('Message', {
  id: {
    type: Sequelize.DataTypes.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  content: {
    type: Sequelize.DataTypes.TEXT,
    allowNull: false,
  },
  role: {
    type: Sequelize.DataTypes.ENUM('system', 'user', 'assistant'),
    allowNull: false,
  },
  metadata: {
    type: Sequelize.DataTypes.JSON,
    allowNull: true,
  },
  sessionId: {
    type: Sequelize.DataTypes.UUID,
    allowNull: false,
  },
});

// Establish relationships between models with proper referential integrity
db.User.hasMany(db.TutorSession, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});
db.TutorSession.belongsTo(db.User, { foreignKey: 'userId' });

db.TutorSession.hasMany(db.Message, {
  foreignKey: 'sessionId',
  onDelete: 'CASCADE',
});
db.Message.belongsTo(db.TutorSession, { foreignKey: 'sessionId' });

// Relationship for BlacklistedToken
db.User.hasMany(db.BlacklistedToken, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
});
db.BlacklistedToken.belongsTo(db.User, { foreignKey: 'userId' });

export default db;
