const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');

class StorageHistory extends Model {}

StorageHistory.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  date: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  storageUsed: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  storageRemaining: {
    type: DataTypes.BIGINT,
    defaultValue: 5 * 1024 * 1024 * 1024,
  },
  totalFiles: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    },
  },
}, {
  sequelize,
  modelName: 'StorageHistory',
  tableName: 'storage_histories',
  timestamps: true,
});

module.exports = StorageHistory;
