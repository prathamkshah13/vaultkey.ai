CREATE TABLE scan (
    id text PRIMARY KEY,

    owner_id text NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP

);

CREATE TABLE finding (

    id text PRIMARY KEY,

    scan_id text NOT NULL REFERENCES scan(id),

    provider text  NOT NULL,

    masked_value text NOT NULL,

    severity text NOT NULL,
     CHECK (severity IN ('low' , 'medium' , 'high')),

    line_number INTEGER NOT NULL CHECK (line_number >= 1),

    review_status TEXT NOT NULL DEFAULT 'open',
    CHECK (review_status IN ('open', 'resolved', 'ignored'))

);