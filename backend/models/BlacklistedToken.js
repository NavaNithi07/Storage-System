const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');

class BlacklistedToken extends Model {}

BlacklistedToken.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    },
  },
}, {
  sequelize,
  modelName: 'BlacklistedToken',
  tableName: 'blacklisted_tokens',
  timestamps: true,
});

module.exports = BlacklistedToken;
