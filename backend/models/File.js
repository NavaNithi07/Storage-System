const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');
const { encrypt, decrypt } = require('../utils/encryption');

class File extends Model {}

File.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  filename: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('filename');
      return raw ? decrypt(raw) : raw;
    },
    set(value) {
      if (value) this.setDataValue('filename', encrypt(value));
    },
  },
  fileUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() {
      const raw = this.getDataValue('fileUrl');
      return raw ? decrypt(raw) : raw;
    },
    set(value) {
      if (value) this.setDataValue('fileUrl', encrypt(value));
    },
  },
  fileType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('images', 'videos', 'documents'),
    allowNull: false,
  },
  size: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isShared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  shareToken: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('shareToken');
      return raw ? decrypt(raw) : raw;
    },
    set(value) {
      this.setDataValue('shareToken', value || null);
    },
  },
  shareExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  sharePassword: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  shareViewLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  shareViews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  shareDownloadLimit: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  shareDownloads: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sha256Hash: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  downloadCount: {
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
  modelName: 'File',
  tableName: 'files',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isDeleted'] },
    { fields: ['userId', 'category', 'isDeleted'] },
    { fields: ['shareToken'] },
  ],
});

module.exports = File;
