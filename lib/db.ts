import 'server-only'
import { Pool } from 'pg'

const databaseUrl =process.env.DATABASE_URL   // Getting the Database URL here 
if (!databaseUrl){
    throw new Error("DATABASE_URL is not configured")
}

//Creating the pool.  Basically a database connection manager using our address and making it available to other server files

export const pool = new Pool({
    connectionString: databaseUrl,
    max:5,
    connectionTimeoutMillis: 5000,

})

