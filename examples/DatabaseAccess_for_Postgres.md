# MySQL

Example using [pg](https://www.npmjs.com/package/pg):

```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";
import {Client, Pool} from "pg";

const db = new Client({
	host: HOST,
	port: PORT,
	database: DATABASE,
	user: USER,
	password: PASSWORD
});
await db.connect();

const dbAccess: DatabaseAccess = {
	runReadStatement: async (query: string) => {
		return (await client.query(query)).rows;
	},
	runWriteStatement: async (query: string) => await client.query(query),
	runTransaction: async (query: string) => {
		const pool = new Pool({connectionString: container.getConnectionUri()});
		const poolClient = await pool.connect();
		
		try {
			await poolClient.query('BEGIN');
			await poolClient.query(query);
			await poolClient.query('COMMIT');
		}
		catch (e) {
			await poolClient.query('ROLLBACK');
			throw e;
		}
		finally {
			poolClient.release();
		}
	}
}
```