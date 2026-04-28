const { EntitySchema } = require('typeorm');

const JobEntity = new EntitySchema({
    name: 'Job',
    tableName: 'jobs',
    indices: [
        {
            columns: ['employer_id']
        }
    ],
    columns: {
        id: {
            type: 'uuid',
            primary: true,
            default: () => 'gen_random_uuid()'
        },
        employer_id: {
            type: String,
            length: 255
        },
        title: {
            type: String,
            length: 255
        },
        description: {
            type: 'text'
        },
        salary_min: {
            type: 'numeric',
            precision: 10,
            scale: 2,
            nullable: true
        },
        salary_max: {
            type: 'numeric',
            precision: 10,
            scale: 2,
            nullable: true
        },
        status: {
            type: String,
            length: 50,
            default: 'DRAFT'
        },
        created_at: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP'
        }
    }
});

module.exports = { JobEntity };
