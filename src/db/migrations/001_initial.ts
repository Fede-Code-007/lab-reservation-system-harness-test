export const id = '001_initial';

export const up = `
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  requester TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CANCELLED')),
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  FOREIGN KEY (equipment_id) REFERENCES equipment (id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_equipment_id ON reservations (equipment_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);
`;
