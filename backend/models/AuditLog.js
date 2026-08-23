const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');

class AuditLog extends Model {}

AuditLog.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  ipAddress: {
    type: DataTypes.STRING,
    defaultValue: 'unknown',
  },
  userAgent: {
    type: DataTypes.STRING,
    defaultValue: 'unknown',
  },
  result: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE'),
    defaultValue: 'SUCCESS',
  },
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    },
  },
}, {
  sequelize,
  modelName: 'AuditLog',
  tableName: 'audit_logs',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['email'] },
    { fields: ['action'] },
  ],
});

module.exports = AuditLog;
