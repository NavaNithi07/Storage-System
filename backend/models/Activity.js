const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');

class Activity extends Model {}

Activity.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fileId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  ipAddress: {
    type: DataTypes.STRING,
    defaultValue: 'unknown',
  },
  device: {
    type: DataTypes.STRING,
    defaultValue: 'unknown',
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    },
  },
}, {
  sequelize,
  modelName: 'Activity',
  tableName: 'activities',
  timestamps: true,
});

module.exports = Activity;
