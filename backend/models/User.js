const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/sequelize');
const bcrypt = require('bcrypt');

class User extends Model {
  // Match user entered password to hashed password in database
  async matchPassword(enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
  }

  // Check if account is locked
  isLocked() {
    return !!(this.lockUntil && new Date(this.lockUntil) > new Date());
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  firstName: {
    type: DataTypes.STRING,
  },
  lastName: {
    type: DataTypes.STRING,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
    set(value) {
      if (value) this.setDataValue('email', value.toLowerCase().trim());
    },
  },
  mobile: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  birthday: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say', ''),
    defaultValue: '',
  },
  bio: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  avatar: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },
  isSuspended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lockUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refreshTokens: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  provider: {
    type: DataTypes.ENUM('local', 'google', 'vibna'),
    defaultValue: 'local',
  },
  googleId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  vibnaEmail: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
    set(value) {
      if (value) this.setDataValue('vibnaEmail', value.toLowerCase().trim());
    },
  },
  googleEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Virtual field _id for Mongoose backward-compatibility in API responses
  _id: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.id;
    },
  },
}, {
  sequelize,
  modelName: 'User',
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && user.password && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

module.exports = User;
