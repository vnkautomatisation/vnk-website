/**
 * VNK — Migration v4 → v5
 * Ajoute request_status à la table messages
 * 
 * Utilisation (depuis F:\Logiciel\Developpement\GIT\vnk-website) :
 *   node migrate.js
 */
require('dotenv').config();
const pool = require('./backend/db');

async function migrate() {
    console.log('🔄 Migration VNK v4 → v5 — request_status...\n');

    try {
        // 1. Ajouter la colonne
        await pool.query(`
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS request_status VARCHAR(20) DEFAULT NULL
        `);
        console.log('✅ Colonne request_status ajoutée à messages');

        // 2. Créer l'index
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_request_status 
            ON messages(request_status) 
            WHERE request_status IS NOT NULL
        `);
        console.log('✅ Index idx_messages_request_status créé');

        // 3. Initialiser les demandes existantes
        const result = await pool.query(`
            UPDATE messages 
            SET request_status = 'new'
            WHERE content LIKE '%NOUVELLE DEMANDE DE PROJET%' 
              AND request_status IS NULL
        `);
        console.log(`✅ ${result.rowCount} demande(s) initialisée(s) à 'new'`);

        // 4. Vérification
        const check = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'request_status'
        `);

        if (check.rows.length > 0) {
            console.log('\n✅ Migration réussie !');
            console.log('   Colonne:', check.rows[0].column_name);
            console.log('   Type:', check.rows[0].data_type);
            console.log('   Défaut:', check.rows[0].column_default);
        }

        console.log('\n📋 Prochaine étape :');
        console.log('   1. Remplacer backend/routes/messages.js par le fichier livré');
        console.log('   2. Redémarrer Node.js avec : node server.js');

    } catch (e) {
        console.error('❌ Erreur migration:', e.message);
    } finally {
        await pool.end();
    }
}

migrate();