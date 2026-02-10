import SqliteDialect from "./dialects/SqliteDialect";
import PostgresDialect from "./dialects/PostgresDialect";
import MySqlDialect from "./dialects/MySqlDialect";
import DatabaseInstructions from "./typings/DatabaseInstructions";
import {DatabaseAccess} from "./typings/DatabaseAccess";
import DefaultSql from "./dialects/DefaultSql";

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