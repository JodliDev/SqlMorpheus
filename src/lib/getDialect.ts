import SqliteDialect from "./dialects/SqliteDialect.ts";
import PostgresDialect from "./dialects/PostgresDialect.ts";
import MySqlDialect from "./dialects/MySqlDialect.ts";
import DatabaseInstructions from "./typings/DatabaseInstructions.ts";
import {DatabaseAccess} from "./typings/DatabaseAccess.ts";
import DefaultSql from "./dialects/DefaultSql.ts";

export default function getDialect(db: DatabaseAccess, dialect: DatabaseInstructions["dialect"]): DefaultSql {
	switch(dialect) {
		case "Sqlite":
			return new SqliteDialect(db);
		case "Postgres":
			return new PostgresDialect(db);
		case "MySql":
			return new MySqlDialect(db);
		default:
			throw new Error(`Unknown dialect ${dialect}`);
	}
}