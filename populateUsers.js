const faker = require('faker');
const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'facultate'
});

db.connect();

const BATCH_SIZE = 1000;
const TOTAL = 100000;
let inserted = 0;

function insertBatch() {
  if (inserted >= TOTAL) {
    console.log('Done!');
    db.end();
    return;
  }
  const values = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    values.push([
      faker.name.findName(),
      faker.internet.email(),
      faker.random.arrayElement(['admin', 'user']),
      faker.image.avatar()
    ]);
  }
  db.query(
    'INSERT INTO users (name, email, type, image) VALUES ?',
    [values],
    (err) => {
      if (err) throw err;
      inserted += BATCH_SIZE;
      console.log(`Inserted: ${inserted}`);
      insertBatch();
    }
  );
}

insertBatch();