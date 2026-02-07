# SQLite
Example using [better-sqlite3](https://www.npmjs.com/package/better-sqlite3):

```typescript
import {DatabaseAccess, runMigration} from "sqlmorpheus";
import BetterSqlite3 from "better-sqlite3";

const db = new BetterSqlite3(":memory:");
const dbAccess: DatabaseAccess = {
	runReadStatement: async (query: string) => db.prepare(query).all(),
	runWriteStatement: async (query: string) => db.prepare(query).run(),
	runTransaction: async (query: string) => {
		const transaction = db.transaction(() => db.exec(query));
		transaction();
	}
}
```