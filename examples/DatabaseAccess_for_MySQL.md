# MySQL

Example using [mysql2](https://www.npmjs.com/package/mysql2):

```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
	host: HOST,
	port: PORT,
	database: DATABASE,
	user: USER,
	password: PASSWORD,
	multipleStatements : true,
});
await db.connect();

const dbAccess: DatabaseAccess = {
	runReadStatement: async (query: string) => {
		const [results, _fields] = await db.query(query);
		return results as any[];
	},
	runWriteStatement: async (query: string) => await db.query(query),
	runTransaction: async (query: string) => {
		try {
			await db.beginTransaction();
			await db.query(query);
			await db.commit();
		}
		catch(e) {
			await db.rollback();
			throw e;
		}
	}
}
```