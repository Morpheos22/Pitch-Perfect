const { Client } = require('pg');

async function test(config, label) {
  const client = new Client({ ...config, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT current_user as user');
    console.log(label + ' OK:', res.rows);
    await client.end();
    return true;
  } catch(err) {
    console.log(label + ' FAILED:', err.message.substring(0,120));
    try { await client.end(); } catch(e) {}
    return false;
  }
}

(async () => {
  // Session pooler with simpler password
  await test({
    host: 'aws-1-eu-west-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.iwbshmshegewmctfucaz',
    password: 'PitchPerfect2026',
  }, 'SessionPooler');

  // Transaction pooler
  await test({
    host: 'aws-1-eu-west-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.iwbshmshegewmctfucaz',
    password: 'PitchPerfect2026',
  }, 'TxnPooler');
})();
