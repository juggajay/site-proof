/**
 * Check lots with area zones
 */
const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, '..', 'dev.db'))

const lots = db.prepare(`
  SELECT lot_number, area_zone, description
  FROM lots
  WHERE lot_number LIKE 'AREA-FILTER%'
`).all()

console.log('Lots with AREA-FILTER prefix:')
lots.forEach(lot => {
  console.log(`  ${lot.lot_number}: area_zone="${lot.area_zone || 'NULL'}"`)
})

// Also check all lots with non-null area_zone
const lotsWithArea = db.prepare(`
  SELECT lot_number, area_zone
  FROM lots
  WHERE area_zone IS NOT NULL
  LIMIT 10
`).all()

console.log('\nLots with non-null area_zone:')
lotsWithArea.forEach(lot => {
  console.log(`  ${lot.lot_number}: "${lot.area_zone}"`)
})

db.close()
