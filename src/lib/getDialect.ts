import SqliteDialect from "./dialects/SqliteDialect";
import PostgresDialect from "./dialects/PostgresDialect";
import MsSqlDialect from "./dialects/MsSqlDialect";
import MySqlDialect from "./dialects/MySqlDialect";
import DatabaseInstructions from "./typings/DatabaseInstructions";
import {DatabaseAccess} from "./typings/DatabaseAccess";
import DefaultSql from "./dialects/DefaultSql";

export default function getDialect(db: DatabaseAccess, dbInstructions: DatabaseInstructions): DefaultSql {
	switch(dbInstructions.dialect) {
		case "Sqlite":
			return new SqliteDialect(db);
		case "Postgres":
			return new PostgresDialect(db);
		case "MsSql":
			return new MsSqlDialect(db);
		case "MySql":
			return new MySqlDialect(db);
		default:
			throw new Error(`Unknown dialect ${dbInstructions.dialect}`);
	}
}