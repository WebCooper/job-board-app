const { EntitySchema } = require('typeorm');

const User = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true
    },
    auth0_sub: {
      type: 'varchar',
      length: 255,
      unique: true,
      nullable: false
    },
    role: {
      type: 'varchar',
      length: 50,
      nullable: false
    },
    created_at: {
      type: 'timestamp with time zone',
      default: () => 'CURRENT_TIMESTAMP'
    }
  }
});

module.exports = { User };
