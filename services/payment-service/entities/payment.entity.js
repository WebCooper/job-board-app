const { EntitySchema } = require('typeorm');

const PaymentEntity = new EntitySchema({
    name: 'Payment',
    tableName: 'payments',
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
        job_id: {
            type: String,
            length: 255
        },
        amount: {
            type: 'numeric',
            precision: 10,
            scale: 2,
            nullable: true
        },
        status: {
            type: String,
            length: 50,
            nullable: true
        },
        created_at: {
            type: 'timestamp',
            default: () => 'CURRENT_TIMESTAMP'
        }
    }
});

module.exports = { PaymentEntity };
